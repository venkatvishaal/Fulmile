const { Tracking, Trip, Driver, Vehicle } = require('../models');
const AppError = require('../utils/AppError');

const trackingController = {
  addTracking: async (req, res, next) => {
    try {
      const { trip_id, location, latitude, longitude, status, notes } = req.body;

      if (!trip_id || !location || latitude === undefined || longitude === undefined) {
        return next(new AppError('Please provide trip_id, location, latitude, and longitude', 400));
      }

      // Check if trip exists
      const trip = await Trip.findByPk(trip_id, {
        include: [
          { model: Driver, as: 'driver' },
          { model: Vehicle, as: 'vehicle' }
        ]
      });

      if (!trip) {
        return next(new AppError('Trip not found', 404));
      }

      // Authorization Check: normalize role to lowercase for consistent comparison
      const userRole = String(req.user.role || '').trim().toLowerCase();

      if (userRole === 'driver') {
        // Drivers can only log for their assigned trip
        const driver = await Driver.findOne({ where: { user_id: req.user.id } });
        if (driver && trip.driver_id !== driver.id) {
          return next(new AppError('Only the assigned driver can log checkpoints for this trip', 403));
        }
        // If no driver record found (e.g. a driver-role user not yet linked), allow anyway
      } else if (userRole !== 'fleet_manager' && userRole !== 'safety_officer' && userRole !== 'financial_analyst') {
        return next(new AppError('Access denied. Only fleet managers and drivers can log tracking checkpoints.', 403));
      }
      // fleet_manager, safety_officer, financial_analyst: always allowed

      // Create tracking checkpoint
      const tracking = await Tracking.create({
        trip_id,
        location,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || 'in_transit',
        notes,
        timestamp: new Date()
      });

      // Update trip status & vehicle location if status matches completion or changes
      if (status && trip.status !== status) {
        // Only allow status machine updates that are valid (or just sync status)
        // If status is 'Completed', we want to allow standard completion flow, but for basic tracking sync we can update status
        if (status === 'Completed' || status === 'Cancelled') {
          // Keep standard lifecycles, or just let status update
          trip.status = status;
          await trip.save();
        }
      }

      // ── Socket.io Real-Time Broadcast ──
      const io = req.app.get('io');
      if (io) {
        io.to(trip_id).emit('trackingUpdated', tracking);
      }

      res.status(201).json({
        success: true,
        message: 'Tracking checkpoint added successfully',
        data: tracking
      });
    } catch (error) {
      next(error);
    }
  },

  getTrackingHistory: async (req, res, next) => {
    try {
      const { tripId } = req.params;

      // Resolve tripId: could be UUID, tracking_id (TRK-...), or shipment_id (SHP-...)
      let trip;
      if (tripId.startsWith('TRK-')) {
        trip = await Trip.findOne({
          where: { tracking_id: tripId },
          include: [
            { model: Driver, as: 'driver', attributes: ['name', 'contact_number'] },
            { model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] }
          ]
        });
      } else if (tripId.startsWith('SHP-')) {
        const { FreightBooking } = require('../models');
        const booking = await FreightBooking.findOne({ where: { shipment_id: tripId } });
        if (booking && booking.trip_id) {
          trip = await Trip.findByPk(booking.trip_id, {
            include: [
              { model: Driver, as: 'driver', attributes: ['name', 'contact_number'] },
              { model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] }
            ]
          });
        }
      } else {
        trip = await Trip.findByPk(tripId, {
          include: [
            { model: Driver, as: 'driver', attributes: ['name', 'contact_number'] },
            { model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] }
          ]
        });
      }

      if (!trip) {
        return next(new AppError('Trip not found', 404));
      }

      const checkpoints = await Tracking.findAll({
        where: { trip_id: trip.id },
        order: [['timestamp', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          trip,
          checkpoints
        }
      });
    } catch (error) {
      next(error);
    }
  },

  getLatestCheckpoint: async (req, res, next) => {
    try {
      const { tripId } = req.params;

      const checkpoint = await Tracking.findOne({
        where: { trip_id: tripId },
        order: [['timestamp', 'DESC']]
      });

      if (!checkpoint) {
        return res.json({
          success: true,
          message: 'No tracking data available for this trip yet',
          data: null
        });
      }

      res.json({
        success: true,
        data: checkpoint
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = trackingController;
