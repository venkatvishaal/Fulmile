const { Vehicle, Route, Trip, Driver, FreightBooking } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Shared Fleet Controller
 * Handles route publishing, capacity search, and shared booking
 */
const sharedBookingController = {
  /**
   * Publish a route for a vehicle (Fleet Manager publishes active transit path)
   * POST /api/vehicles/:id/publish-route
   */
  publishRoute: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { source, destination, intermediate_points, departure_time, estimated_arrival, price_per_kg } = req.body;

      if (!source || !destination) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Source and destination are required' });
      }

      const vehicle = await Vehicle.findByPk(id, { transaction });
      if (!vehicle) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      // Only allow publishing for vehicles that are currently "On Trip" or "Available"
      if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot publish route for vehicle in "${vehicle.status}" status`
        });
      }

      // Mark old routes as inactive
      await Route.update(
        { is_active: false },
        { where: { vehicle_id: id, is_active: true }, transaction }
      );

      // Create new active route
      const route = await Route.create({
        vehicle_id: id,
        source,
        destination,
        intermediate_points: intermediate_points || [],
        departure_time,
        estimated_arrival,
        price_per_kg: price_per_kg || 0
      }, { transaction });

      await transaction.commit();

      // Broadcast route publication via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to('fleet').emit('route_published', {
          vehicle_id: id,
          registration_number: vehicle.registration_number,
          route
        });
      }

      res.status(201).json({
        success: true,
        message: 'Route published successfully',
        data: route
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Publish route error:', error);
      res.status(500).json({ success: false, message: 'Failed to publish route', error: error.message });
    }
  },

  /**
   * Search available vehicles with capacity on matching routes
   * GET /api/vehicles/search?pickup=X&destination=Y&weight=Z
   */
  searchAvailableSpace: async (req, res) => {
    try {
      const { pickup, destination, weight } = req.query;

      if (!pickup || !destination || !weight) {
        return res.status(400).json({
          success: false,
          message: 'Pickup, destination and weight are required'
        });
      }

      const reqWeight = parseFloat(weight);
      if (isNaN(reqWeight) || reqWeight <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Weight must be a positive number'
        });
      }

      // Find all active routes with their vehicles
      const activeRoutes = await Route.findAll({
        where: { is_active: true },
        include: [{
          model: Vehicle,
          as: 'vehicle',
          where: {
            status: { [Op.in]: ['Available', 'On Trip'] }
          }
        }]
      });

      // Filter routes using sequential string matching
      const matchingRoutes = activeRoutes.filter(route => {
        // Route match check
        let intermediate = route.intermediate_points || [];
        if (typeof intermediate === 'string') {
          try { intermediate = JSON.parse(intermediate); } catch (e) { intermediate = []; }
        }

        const allPoints = [
          route.source.toLowerCase(),
          ...intermediate.map(p => p.toLowerCase()),
          route.destination.toLowerCase()
        ];

        const pickupIdx = allPoints.indexOf(pickup.toLowerCase());
        const destIdx = allPoints.indexOf(destination.toLowerCase());

        // Pickup must exist and must be before destination in the route sequence
        return pickupIdx !== -1 && destIdx !== -1 && pickupIdx < destIdx;
      });

      // Calculate remaining capacity for each matching route
      const results = [];
      for (const route of matchingRoutes) {
        const vehicle = route.vehicle;

        // Sum cargo_weight of all active trips on this vehicle
        const activeTripsWeight = await Trip.sum('cargo_weight', {
          where: {
            vehicle_id: vehicle.id,
            status: { [Op.in]: ['Draft', 'Dispatched'] }
          }
        }) || 0;

        const remainingCapacity = parseFloat(vehicle.max_load_capacity_kg) - parseFloat(activeTripsWeight);

        if (remainingCapacity >= reqWeight) {
          results.push({
            route_id: route.id,
            vehicle: {
              id: vehicle.id,
              registration_number: vehicle.registration_number,
              model_name: vehicle.model_name,
              vehicle_type: vehicle.vehicle_type,
              max_load_capacity_kg: vehicle.max_load_capacity_kg,
              status: vehicle.status
            },
            source: route.source,
            destination: route.destination,
            intermediate_points: route.intermediate_points,
            departure_time: route.departure_time,
            estimated_arrival: route.estimated_arrival,
            price_per_kg: route.price_per_kg,
            remaining_capacity: remainingCapacity.toFixed(2)
          });
        }
      }

      res.json({
        success: true,
        count: results.length,
        data: results
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Search failed', error: error.message });
    }
  },

  /**
   * Create a shared booking on a vehicle route
   * POST /api/vehicles/shared-booking
   */
  requestSharedSpace: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { route_id, pickup_location, delivery_location, weight, planned_distance, price_quote } = req.body;

      if (!route_id || !pickup_location || !delivery_location || !weight || !planned_distance) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'route_id, pickup_location, delivery_location, weight, and planned_distance are required'
        });
      }

      const route = await Route.findByPk(route_id, {
        include: [{ model: Vehicle, as: 'vehicle' }],
        transaction
      });

      if (!route || !route.is_active) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Route not found or inactive' });
      }

      const vehicle = route.vehicle;
      const reqWeight = parseFloat(weight);

      // Calculate remaining capacity
      const activeTripsWeight = await Trip.sum('cargo_weight', {
        where: {
          vehicle_id: vehicle.id,
          status: { [Op.in]: ['Draft', 'Dispatched'] }
        },
        transaction
      }) || 0;

      const remainingCapacity = parseFloat(vehicle.max_load_capacity_kg) - parseFloat(activeTripsWeight);

      if (remainingCapacity < reqWeight) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient capacity. Available: ${remainingCapacity.toFixed(2)} kg, Requested: ${reqWeight} kg`
        });
      }

      // Find the driver currently assigned to this vehicle (from active trip)
      const activeTrip = await Trip.findOne({
        where: {
          vehicle_id: vehicle.id,
          status: { [Op.in]: ['Dispatched'] }
        },
        transaction
      });

      // If no dispatched trip, find any available driver
      let driverId;
      if (activeTrip) {
        driverId = activeTrip.driver_id;
      } else {
        const availableDriver = await Driver.findOne({
          where: { status: 'Available' },
          transaction
        });
        if (!availableDriver) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'No available driver for this shared booking'
          });
        }
        driverId = availableDriver.id;
      }

      // Single Dispatch Rule: if truck is already en route, attach directly onto it in-place
      let assignedTrip = activeTrip;
      if (activeTrip) {
        await activeTrip.update({
          cargo_weight: parseFloat(activeTrip.cargo_weight) + reqWeight
        }, { transaction });
      } else {
        assignedTrip = await Trip.create({
          vehicle_id: vehicle.id,
          driver_id: driverId,
          carrier_id: vehicle.carrier_id,
          source: pickup_location,
          destination: delivery_location,
          cargo_weight: reqWeight,
          planned_distance: parseFloat(planned_distance),
          status: 'Draft',
          is_shared: true,
          price_quote: price_quote || (parseFloat(route.price_per_kg) * reqWeight),
          route_id: route.id
        }, { transaction });
      }

      // If booked by a shipper, also record as a FreightBooking so it appears in "My Shipments"
      if (req.user && String(req.user.role || '').toLowerCase() === 'shipper') {
        await FreightBooking.create({
          shipper_id: req.user.id,
          pickup_address: pickup_location,
          delivery_address: delivery_location,
          cargo_type: 'General Goods (Shared)',
          cargo_weight: reqWeight,
          estimated_distance_km: parseFloat(planned_distance),
          carrier_id: vehicle.carrier_id,
          trip_id: assignedTrip.id,
          is_shared: true,
          price_quote: price_quote || (parseFloat(route.price_per_kg) * reqWeight),
          status: activeTrip ? 'In Transit' : 'Accepted'
        }, { transaction });
      }

      await transaction.commit();

      // Broadcast shared booking via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to('fleet').emit('shared_booking_created', {
          trip_id: assignedTrip.id,
          vehicle_registration: vehicle.registration_number,
          cargo_weight: reqWeight
        });
      }

      res.status(201).json({
        success: true,
        message: activeTrip
          ? `Booked onto ${vehicle.registration_number}, which is already en route. The shipment is on its way.`
          : 'Booked. The shipment goes out with this vehicle\'s next dispatch.',
        data: assignedTrip
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Shared booking error:', error);
      res.status(500).json({ success: false, message: 'Booking failed', error: error.message });
    }
  },

  /**
   * Get active routes for a vehicle
   * GET /api/vehicles/:id/routes
   */
  getVehicleRoutes: async (req, res) => {
    try {
      const { id } = req.params;
      const routes = await Route.findAll({
        where: { vehicle_id: id, is_active: true },
        include: [{ model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] }]
      });
      res.json({ success: true, data: routes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch routes', error: error.message });
    }
  }
};

module.exports = sharedBookingController;
