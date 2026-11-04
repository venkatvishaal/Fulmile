const { Trip, Vehicle, Driver, FuelLog, FreightBooking } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

// A truck can carry several shipments at once; it (and its driver) only frees up
// when the last Dispatched trip ends. Call after the finishing trip's status changed.
const releaseIfIdle = async (trip, t) => {
  const stillOut = (where) => Trip.count({ where: { ...where, status: 'Dispatched' }, transaction: t });
  const freed = { vehicle: false, driver: false };
  if (!(await stillOut({ vehicle_id: trip.vehicle_id }))) {
    await Vehicle.update({ status: 'Available' }, { where: { id: trip.vehicle_id, status: 'On Trip' }, transaction: t });
    freed.vehicle = true;
  }
  if (!(await stillOut({ driver_id: trip.driver_id }))) {
    await Driver.update({ status: 'Available' }, { where: { id: trip.driver_id, status: 'On Trip' }, transaction: t });
    freed.driver = true;
  }
  return freed;
};

const tripController = {
  getAll: async (req, res) => {
    try {
      const { status } = req.query;
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };
      if (status) where.status = status;

      // Single Dispatch Rule: Reconcile active running corridor trips with any attached shared cargos
      try {
        const dispatchedTrips = await Trip.findAll({
          where: { ...where, status: 'Dispatched' }
        });

        for (const dt of dispatchedTrips) {
          // Find in-transit shared bookings for this carrier that need corridor attachment
          const orphanBookings = await FreightBooking.findAll({
            where: {
              carrier_id: dt.carrier_id,
              status: 'In Transit',
              [Op.or]: [
                { trip_id: { [Op.ne]: dt.id } },
                { trip_id: null }
              ]
            }
          });

          for (const ob of orphanBookings) {
            if (ob.trip_id) {
              const oldTrip = await Trip.findByPk(ob.trip_id);
              if (oldTrip && oldTrip.vehicle_id === dt.vehicle_id && oldTrip.id !== dt.id) {
                await ob.update({ trip_id: dt.id });
                await oldTrip.destroy();
              }
            } else {
              await ob.update({ trip_id: dt.id });
            }
          }

          // Keep running trip cargo weight in sync with sum of all attached shipments
          const totalWeight = await FreightBooking.sum('cargo_weight', {
            where: { trip_id: dt.id }
          });
          if (totalWeight && parseFloat(totalWeight) > 0 && parseFloat(dt.cargo_weight) !== parseFloat(totalWeight)) {
            await dt.update({ cargo_weight: parseFloat(totalWeight) });
          }
        }
      } catch (reconcileErr) {
        console.warn('Corridor reconcile warning:', reconcileErr);
      }

      const trips = await Trip.findAll({
        where,
        include: [
          { model: Vehicle, as: 'vehicle', attributes: ['id', 'registration_number', 'model_name', 'max_load_capacity_kg', 'status'] },
          { model: Driver, as: 'driver', attributes: ['id', 'name', 'license_number', 'status'] },
          {
            model: FreightBooking,
            as: 'freight_bookings',
            attributes: ['id', 'shipment_id', 'pickup_address', 'delivery_address', 'cargo_weight', 'cargo_type', 'status', 'price_quote', 'is_shared']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, data: trips });
    } catch (error) {
      console.error('Get trips error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch trips' });
    }
  },

  create: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, estimated_fuel_liters, booking_id } = req.body;

      // ① Fetch and validate vehicle
      const vehicle = await Vehicle.findByPk(vehicle_id, { transaction: t, lock: true });
      if (!vehicle) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      if (req.user?.carrierId && vehicle.carrier_id && vehicle.carrier_id !== req.user.carrierId) {
        await t.rollback();
        return res.status(403).json({ success: false, message: 'You can only assign vehicles from your own carrier fleet' });
      }
      if (vehicle.status !== 'Available') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Vehicle is currently "${vehicle.status}" and cannot be assigned to a trip`
        });
      }

      // ② Validate cargo capacity
      if (parseFloat(cargo_weight) > parseFloat(vehicle.max_load_capacity_kg)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Cargo weight (${cargo_weight}kg) exceeds vehicle capacity (${vehicle.max_load_capacity_kg}kg)`,
          errors: [{ field: 'cargo_weight', message: `Maximum capacity is ${vehicle.max_load_capacity_kg}kg` }]
        });
      }

      // ③ Fetch and validate driver
      const driver = await Driver.findByPk(driver_id, { transaction: t, lock: true });
      if (!driver) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      if (req.user?.carrierId && driver.carrier_id && driver.carrier_id !== req.user.carrierId) {
        await t.rollback();
        return res.status(403).json({ success: false, message: 'You can only assign drivers from your own carrier fleet' });
      }
      if (driver.status === 'Suspended') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Driver is suspended and cannot be assigned to trips'
        });
      }
      if (driver.status !== 'Available') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Driver is currently "${driver.status}" and cannot be assigned`
        });
      }

      // ④ Check license expiry
      const today = new Date().toISOString().split('T')[0];
      if (driver.license_expiry_date < today) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Driver's license expired on ${driver.license_expiry_date}. Cannot assign to trip.`
        });
      }

      // ⑤ Create trip with status Draft
      let tripPriceQuote = parseFloat(req.body.price_quote) || 0;
      let linkedBooking = null;
      if (booking_id) {
        linkedBooking = await FreightBooking.findByPk(booking_id, { transaction: t });
        if (linkedBooking && !tripPriceQuote && linkedBooking.price_quote) {
          tripPriceQuote = parseFloat(linkedBooking.price_quote) || 0;
        }
      }

      const trip = await Trip.create({
        source, destination, vehicle_id, driver_id,
        cargo_weight, planned_distance,
        price_quote: tripPriceQuote,
        estimated_fuel_liters: estimated_fuel_liters || null,
        carrier_id: req.user?.carrierId || null,
        status: 'Draft'
      }, { transaction: t });

      // If linked to an accepted freight booking, attach the trip
      if (linkedBooking) {
        await linkedBooking.update({
          trip_id: trip.id,
          carrier_id: req.user?.carrierId || linkedBooking.carrier_id
        }, { transaction: t });
      }

      await t.commit();

      // Fetch full trip with associations for response
      const fullTrip = await Trip.findByPk(trip.id, {
        include: [
          { model: Vehicle, as: 'vehicle', attributes: ['id', 'registration_number', 'model_name'] },
          { model: Driver, as: 'driver', attributes: ['id', 'name'] }
        ]
      });

      res.status(201).json({ success: true, message: 'Trip created as Draft', data: fullTrip });
    } catch (error) {
      await t.rollback();
      console.error('Create trip error:', error);
      res.status(500).json({ success: false, message: 'Failed to create trip' });
    }
  },

  dispatch: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const trip = await Trip.findByPk(req.params.id, { transaction: t, lock: true });
      if (!trip) { await t.rollback(); return res.status(404).json({ success: false, message: 'Trip not found' }); }
      if (trip.status !== 'Draft') {
        await t.rollback();
        return res.status(400).json({ success: false, message: `Cannot dispatch a trip with status "${trip.status}". Only Draft trips can be dispatched.` });
      }

      // Re-validate vehicle and driver (race-condition safe)
      const vehicle = await Vehicle.findByPk(trip.vehicle_id, { transaction: t, lock: true });
      const driver = await Driver.findByPk(trip.driver_id, { transaction: t, lock: true });

      // A truck already on the road can carry this trip too (shared load),
      // as long as the same driver is driving it and there is room left.
      const onBoard = vehicle.status === 'On Trip'
        ? await Trip.findAll({
          where: { vehicle_id: vehicle.id, status: 'Dispatched' },
          include: [{ model: Driver, as: 'driver', attributes: ['name'] }],
          transaction: t
        })
        : [];
      const joining = onBoard.length > 0;

      if (joining) {
        const other = onBoard.find((x) => x.driver_id !== trip.driver_id);
        if (other) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: `${vehicle.registration_number} is on the road with ${other.driver?.name || 'another driver'}. Assign this trip to that driver or wait until the truck is back.`
          });
        }
        const load = onBoard.reduce((sum, x) => sum + parseFloat(x.cargo_weight), 0);
        const free = parseFloat(vehicle.max_load_capacity_kg) - load;
        if (parseFloat(trip.cargo_weight) > free) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: `Only ${Math.max(free, 0).toFixed(2)} kg free on ${vehicle.registration_number} right now (this trip needs ${parseFloat(trip.cargo_weight).toFixed(2)} kg).`
          });
        }
      } else {
        if (vehicle.status !== 'Available') {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Vehicle is now "${vehicle.status}" and cannot be dispatched` });
        }
        if (driver.status !== 'Available') {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Driver is now "${driver.status}" and cannot be dispatched` });
        }
      }

      // Atomic state transition
      const trackingId = trip.tracking_id || `TRK-${crypto.randomInt(100000, 999999)}`;
      await trip.update({
        status: 'Dispatched',
        dispatched_at: new Date(),
        tracking_id: trackingId
      }, { transaction: t });
      await vehicle.update({ status: 'On Trip' }, { transaction: t });
      await driver.update({ status: 'On Trip' }, { transaction: t });

      // Update any associated freight bookings to In Transit
      await FreightBooking.update(
        { status: 'In Transit' },
        { where: { trip_id: trip.id }, transaction: t }
      );

      await t.commit();

      // Emit Socket.io event
      const io = req.app.get('io');
      if (io) io.emit('fleet:update', { event: 'trip_dispatched', tripId: trip.id, trackingId });

      res.json({
        success: true,
        message: joining
          ? `Trip dispatched on ${vehicle.registration_number}, which is already en route with this driver. Tracking ID: ${trackingId}`
          : `Trip dispatched. Tracking ID: ${trackingId}. Vehicle and driver are now On Trip.`,
        data: trip
      });
    } catch (error) {
      await t.rollback();
      console.error('Dispatch trip error:', error);
      res.status(500).json({ success: false, message: 'Failed to dispatch trip' });
    }
  },

  complete: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { final_odometer, fuel_consumed_liters } = req.body;
      const trip = await Trip.findByPk(req.params.id, { transaction: t, lock: true });
      if (!trip) { await t.rollback(); return res.status(404).json({ success: false, message: 'Trip not found' }); }
      if (trip.status !== 'Dispatched') {
        await t.rollback();
        return res.status(400).json({ success: false, message: `Cannot complete a trip with status "${trip.status}". Only Dispatched trips can be completed.` });
      }

      const vehicle = await Vehicle.findByPk(trip.vehicle_id, { transaction: t, lock: true });

      // Update trip
      await trip.update({
        status: 'Completed', completed_at: new Date(),
        final_odometer, fuel_consumed_liters
      }, { transaction: t });

      // Shared loads finish in any order; never wind the odometer back.
      await vehicle.update({ odometer: Math.max(parseFloat(vehicle.odometer), parseFloat(final_odometer)) }, { transaction: t });
      const freed = await releaseIfIdle(trip, t);

      // Auto-create fuel log entry
      await FuelLog.create({
        vehicle_id: trip.vehicle_id,
        trip_id: trip.id,
        liters: fuel_consumed_liters,
        cost: parseFloat(fuel_consumed_liters) * 100, // placeholder rate
        date: new Date().toISOString().split('T')[0]
      }, { transaction: t });

      // Update any associated freight bookings to Delivered
      await FreightBooking.update(
        { status: 'Delivered' },
        { where: { trip_id: trip.id }, transaction: t }
      );

      await t.commit();

      const io = req.app.get('io');
      if (io) io.emit('fleet:update', { event: 'trip_completed', tripId: trip.id });

      res.json({
        success: true,
        message: freed.vehicle
          ? 'Trip completed. Vehicle odometer updated. Driver and vehicle restored to Available.'
          : 'Trip completed. The vehicle stays On Trip: it still has other shipments on board.',
        data: trip
      });
    } catch (error) {
      await t.rollback();
      console.error('Complete trip error:', error);
      res.status(500).json({ success: false, message: 'Failed to complete trip' });
    }
  },

  cancel: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const trip = await Trip.findByPk(req.params.id, { transaction: t, lock: true });
      if (!trip) { await t.rollback(); return res.status(404).json({ success: false, message: 'Trip not found' }); }
      if (!['Draft', 'Dispatched'].includes(trip.status)) {
        await t.rollback();
        return res.status(400).json({ success: false, message: `Cannot cancel a trip with status "${trip.status}"` });
      }

      const wasDispatched = trip.status === 'Dispatched';
      await trip.update({ status: 'Cancelled' }, { transaction: t });

      // Only restore if was Dispatched (vehicle/driver were locked)
      if (wasDispatched) await releaseIfIdle(trip, t);

      await t.commit();

      const io = req.app.get('io');
      if (io) io.emit('fleet:update', { event: 'trip_cancelled', tripId: trip.id });

      res.json({ success: true, message: 'Trip cancelled.', data: trip });
    } catch (error) {
      await t.rollback();
      console.error('Cancel trip error:', error);
      res.status(500).json({ success: false, message: 'Failed to cancel trip' });
    }
  }
};

module.exports = tripController;
