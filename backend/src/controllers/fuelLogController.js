const { FuelLog, Vehicle, Trip } = require('../models');

const fuelLogController = {
  getAll: async (req, res) => {
    try {
      const { vehicle_id, trip_id } = req.query;
      const where = {};
      if (vehicle_id) where.vehicle_id = vehicle_id;
      if (trip_id) where.trip_id = trip_id;

      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const vehicleWhere = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };

      const logs = await FuelLog.findAll({
        where,
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
            where: vehicleWhere,
            required: Boolean(req.user?.role !== 'admin' || req.user?.carrierId),
            attributes: ['id', 'registration_number', 'model_name']
          },
          { model: Trip, as: 'trip', attributes: ['id', 'source', 'destination', 'status'] }
        ],
        order: [['date', 'DESC']]
      });
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('Get fuel logs error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch fuel logs' });
    }
  },

  create: async (req, res) => {
    try {
      const { vehicle_id, trip_id, liters, cost, date } = req.body;

      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const log = await FuelLog.create({ vehicle_id, trip_id, liters, cost, date });
      res.status(201).json({ success: true, message: 'Fuel log created', data: log });
    } catch (error) {
      console.error('Create fuel log error:', error);
      res.status(500).json({ success: false, message: 'Failed to create fuel log' });
    }
  }
};

module.exports = fuelLogController;
