const { FreightBooking, User, Carrier, Trip, Vehicle, Driver } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const freightBookingController = {
  // POST /api/freight-bookings — Shipper creates a new freight booking
  create: async (req, res, next) => {
    try {
      const {
        pickup_address, delivery_address, cargo_type, cargo_description,
        cargo_weight, estimated_distance_km, estimated_fuel_liters,
        preferred_pickup_date, preferred_delivery_date, carrier_id, notes
      } = req.body;

      if (!pickup_address || !delivery_address || !cargo_weight) {
        return res.status(400).json({
          success: false,
          message: 'pickup_address, delivery_address, and cargo_weight are required'
        });
      }

      const booking = await FreightBooking.create({
        shipper_id: req.user.id,
        pickup_address,
        delivery_address,
        cargo_type: cargo_type || 'General Goods',
        cargo_description: cargo_description || null,
        cargo_weight: parseFloat(cargo_weight),
        estimated_distance_km: estimated_distance_km ? parseFloat(estimated_distance_km) : null,
        estimated_fuel_liters: estimated_fuel_liters ? parseFloat(estimated_fuel_liters) : null,
        preferred_pickup_date: preferred_pickup_date || null,
        preferred_delivery_date: preferred_delivery_date || null,
        carrier_id: carrier_id || null,
        notes: notes || null,
        status: 'Pending'
      });

      res.status(201).json({
        success: true,
        message: `Freight booking created. Shipment ID: ${booking.shipment_id}`,
        data: booking
      });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/freight-bookings — List bookings (shipper sees own, carrier sees carrier's)
  list: async (req, res, next) => {
    try {
      const userRole = String(req.user.role || '').toLowerCase();
      let where = {};

      if (userRole === 'shipper') {
        where.shipper_id = req.user.id;
      } else if (req.user.carrierId) {
        where.carrier_id = req.user.carrierId;
      } else {
        // Fleet managers without a carrier see pending unassigned bookings
        where.status = 'Pending';
      }

      if (req.query.status) {
        where.status = req.query.status;
      }

      const bookings = await FreightBooking.findAll({
        where,
        include: [
          { model: User, as: 'shipper', attributes: ['id', 'name', 'email', 'company_name'] },
          { model: Carrier, as: 'carrier', attributes: ['id', 'company_name'] },
          { model: Trip, as: 'trip', attributes: ['id', 'tracking_id', 'status', 'source', 'destination'] }
        ],
        order: [['created_at', 'DESC']]
      });

      // Auto-backfill price quote for any merged shared cargo that was accepted/delivered without explicit quote
      for (const b of bookings) {
        if ((!b.price_quote || parseFloat(b.price_quote) <= 0) && ['Accepted', 'In Transit', 'Delivered'].includes(b.status)) {
          const estDist = parseFloat(b.estimated_distance_km) || 500;
          const weight = parseFloat(b.cargo_weight) || 250;
          const computedPrice = Math.round(Math.max(2500, (weight * 6) + (estDist * 4)));
          await b.update({ price_quote: computedPrice });
          b.price_quote = computedPrice;
        }
      }

      res.json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/freight-bookings/available — Fleet managers browse unassigned or pending bookings
  listAvailable: async (req, res, next) => {
    try {
      const carrierId = req.user?.carrierId;
      const whereConditions = [
        { carrier_id: null, status: 'Pending' }
      ];
      if (carrierId) {
        whereConditions.push({ carrier_id: carrierId });
      }

      const bookings = await FreightBooking.findAll({
        where: { [Op.or]: whereConditions },
        include: [
          { model: User, as: 'shipper', attributes: ['id', 'name', 'email', 'company_name', 'phone'] },
          { model: Carrier, as: 'carrier', attributes: ['id', 'company_name'] },
          { model: Trip, as: 'trip', attributes: ['id', 'tracking_id', 'status'] }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/freight-bookings/accepted-for-dispatch — Carrier retrieves accepted bookings ready for dispatch
  listAcceptedForDispatch: async (req, res, next) => {
    try {
      const carrierId = req.user?.carrierId;
      const whereConditions = [
        { status: 'Accepted', trip_id: null }
      ];
      if (carrierId) {
        whereConditions.push({ carrier_id: carrierId, status: 'Accepted', trip_id: null });
      }

      const bookings = await FreightBooking.findAll({
        where: {
          status: 'Accepted',
          trip_id: null,
          ...(carrierId ? { carrier_id: carrierId } : {})
        },
        include: [
          { model: User, as: 'shipper', attributes: ['id', 'name', 'email', 'company_name', 'phone'] },
          { model: Carrier, as: 'carrier', attributes: ['id', 'company_name'] }
        ],
        order: [['updated_at', 'DESC']]
      });

      res.json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/freight-bookings/:id/accept-quote — Shipper accepts carrier's price quote
  acceptQuote: async (req, res, next) => {
    try {
      const booking = await FreightBooking.findByPk(req.params.id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Freight booking not found' });
      }

      // Must be the owner shipper
      if (booking.shipper_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only accept quotes for your own shipments.' });
      }

      if (booking.status !== 'Quoted') {
        return res.status(400).json({
          success: false,
          message: `Cannot accept quote when status is "${booking.status}". Only "Quoted" bookings can be accepted.`
        });
      }

      if (!booking.price_quote || parseFloat(booking.price_quote) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid price quote has been set by the carrier yet.'
        });
      }

      await booking.update({
        status: 'Accepted'
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('fleet:update', {
          event: 'quote_accepted',
          bookingId: booking.id,
          carrierId: booking.carrier_id,
          shipmentId: booking.shipment_id
        });
      }

      res.json({
        success: true,
        message: `Price quote of ₹${parseFloat(booking.price_quote).toLocaleString()} accepted! Order confirmed and ready for carrier dispatch.`,
        data: booking
      });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/freight-bookings/:id — Get booking details
  getById: async (req, res, next) => {
    try {
      const booking = await FreightBooking.findByPk(req.params.id, {
        include: [
          { model: User, as: 'shipper', attributes: ['id', 'name', 'email', 'company_name', 'phone'] },
          { model: Carrier, as: 'carrier', attributes: ['id', 'company_name', 'contact_phone', 'contact_email'] },
          {
            model: Trip, as: 'trip',
            attributes: ['id', 'tracking_id', 'status', 'source', 'destination', 'cargo_weight',
                         'planned_distance', 'dispatched_at', 'completed_at'],
            include: [
              { model: Vehicle, as: 'vehicle', attributes: ['id', 'registration_number', 'model_name'] },
              { model: Driver, as: 'driver', attributes: ['id', 'name', 'contact_number'] }
            ]
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Access check
      const userRole = String(req.user.role || '').toLowerCase();
      if (userRole === 'shipper' && booking.shipper_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      res.json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/freight-bookings/:id/quote — Fleet manager sets price quote
  setQuote: async (req, res, next) => {
    try {
      const booking = await FreightBooking.findByPk(req.params.id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const { price_quote } = req.body;
      if (!price_quote || parseFloat(price_quote) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid price quote is required' });
      }

      await booking.update({
        price_quote: parseFloat(price_quote),
        carrier_id: req.user.carrierId || booking.carrier_id,
        status: 'Quoted'
      });

      res.json({ success: true, message: 'Quote submitted', data: booking });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/freight-bookings/:id/accept — Fleet manager accepts booking
  // If trip_id is provided, merge into existing active trip (SINGLE DISPATCH RULE)
  accept: async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const booking = await FreightBooking.findByPk(req.params.id, { transaction: t, lock: true });
      if (!booking) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (!['Pending', 'Quoted', 'Accepted'].includes(booking.status)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot merge or accept a booking with status "${booking.status}". This shipment is already en route or delivered.`
        });
      }

      if (booking.trip_id) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'This shipment is already assigned to an active trip corridor.'
        });
      }

      const { trip_id, price_quote } = req.body;

      if (trip_id) {
        // ── MERGE INTO EXISTING ACTIVE TRIP (shared cargo — single dispatch rule) ──
        const trip = await Trip.findByPk(trip_id, { transaction: t });

        if (!trip) {
          await t.rollback();
          return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const vehicle = await Vehicle.findByPk(trip.vehicle_id, { transaction: t });
        const reqWeight = parseFloat(booking.cargo_weight);

        // Check active trips weight on this vehicle
        const activeWeight = await Trip.sum('cargo_weight', {
          where: { vehicle_id: trip.vehicle_id, status: { [Op.in]: ['Draft', 'Dispatched'] } },
          transaction: t
        }) || 0;

        const remaining = parseFloat(vehicle.max_load_capacity_kg) - parseFloat(activeWeight);
        if (reqWeight > remaining) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient capacity. Available: ${remaining.toFixed(2)} kg, Requested: ${reqWeight.toFixed(2)} kg`
          });
        }

        // Determine quote for this shared booking
        let quoteToSet = booking.price_quote;
        if (price_quote && parseFloat(price_quote) > 0) {
          quoteToSet = parseFloat(price_quote);
        } else if (!quoteToSet || parseFloat(quoteToSet) <= 0) {
          const estDist = parseFloat(booking.estimated_distance_km) || 500;
          const weight = parseFloat(booking.cargo_weight) || 100;
          quoteToSet = Math.round(Math.max(2500, (weight * 6) + (estDist * 4)));
        }

        // Update the active trip's cargo weight IN-PLACE (no duplicate trip created!)
        await trip.update({
          cargo_weight: parseFloat(trip.cargo_weight) + reqWeight
        }, { transaction: t });

        // Link booking to the existing trip
        await booking.update({
          trip_id: trip.id,
          carrier_id: req.user.carrierId || trip.carrier_id,
          price_quote: quoteToSet,
          is_shared: true,
          status: trip.status === 'Dispatched' ? 'In Transit' : 'Accepted'
        }, { transaction: t });

        await t.commit();

        const io = req.app.get('io');
        if (io) io.emit('fleet:update', { event: 'shared_cargo_merged', tripId: trip.id, bookingId: booking.id });

        return res.json({
          success: true,
          message: `Booking merged into active trip (${trip.tracking_id || trip.id}). Cargo weight updated in-place.`,
          data: booking
        });
      }

      // Accept without assigning to trip yet
      await booking.update({
        carrier_id: req.user.carrierId || booking.carrier_id,
        status: 'Accepted'
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, message: 'Booking accepted', data: booking });
    } catch (error) {
      await t.rollback();
      next(error);
    }
  },

  // PUT /api/freight-bookings/:id/cancel — Cancel booking
  cancel: async (req, res, next) => {
    try {
      const booking = await FreightBooking.findByPk(req.params.id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const userRole = String(req.user.role || '').toLowerCase();
      if (userRole === 'shipper' && booking.shipper_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      if (['Delivered', 'Cancelled'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: `Cannot cancel a booking with status "${booking.status}"` });
      }

      await booking.update({ status: 'Cancelled' });
      res.json({ success: true, message: 'Booking cancelled', data: booking });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/freight-bookings/track/:code — Public tracking lookup by shipment ID or tracking ID
  trackByCode: async (req, res, next) => {
    try {
      const { code } = req.params;

      // 1. Try FreightBooking by shipment_id
      const booking = await FreightBooking.findOne({
        where: { shipment_id: code },
        include: [
          { model: Carrier, as: 'carrier', attributes: ['id', 'company_name'] },
          {
            model: Trip, as: 'trip',
            attributes: ['id', 'tracking_id', 'status', 'source', 'destination', 'dispatched_at', 'completed_at'],
            include: [
              { model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] },
              { model: Driver, as: 'driver', attributes: ['name', 'contact_number'] }
            ]
          }
        ]
      });

      if (booking) {
        return res.json({ success: true, data: booking });
      }

      // 2. Try Trip by tracking_id
      const trip = await Trip.findOne({
        where: { tracking_id: code },
        include: [
          { model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] },
          { model: Driver, as: 'driver', attributes: ['name', 'contact_number'] },
          { model: FreightBooking, as: 'freight_bookings' }
        ]
      });

      if (trip) {
        return res.json({ success: true, data: { trip, bookings: trip.freight_bookings } });
      }

      return res.status(404).json({ success: false, message: 'No shipment or tracking record found for this code' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = freightBookingController;
