const { Vehicle } = require('../models');
const { Op } = require('sequelize');

const vehicleController = {
  getAll: async (req, res) => {
    try {
      const { status, vehicle_type, region } = req.query;
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };
      if (status) where.status = status;
      if (vehicle_type) where.vehicle_type = vehicle_type;
      if (region) where.region = { [Op.iLike]: `%${region}%` };

      const vehicles = await Vehicle.findAll({ where, order: [['created_at', 'DESC']] });
      res.json({ success: true, data: vehicles });
    } catch (error) {
      console.error('Get vehicles error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch vehicles' });
    }
  },

  getById: async (req, res) => {
    try {
      const vehicle = await Vehicle.findByPk(req.params.id);
      if (!vehicle || (req.user?.carrierId && vehicle.carrier_id && vehicle.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      res.json({ success: true, data: vehicle });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch vehicle' });
    }
  },

  create: async (req, res) => {
    try {
      const { registration_number, model_name, vehicle_type,
              max_load_capacity_kg, odometer, acquisition_cost, region } = req.body;

      // Check unique registration
      const existing = await Vehicle.findOne({ where: { registration_number } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A vehicle with this registration number already exists'
        });
      }

      const vehicle = await Vehicle.create({
        registration_number, model_name, vehicle_type,
        max_load_capacity_kg, odometer: odometer || 0,
        acquisition_cost, region, status: 'Available',
        carrier_id: req.user?.carrierId || null
      });

      res.status(201).json({ success: true, message: 'Vehicle registered successfully', data: vehicle });
    } catch (error) {
      console.error('Create vehicle error:', error);
      res.status(500).json({ success: false, message: 'Failed to register vehicle' });
    }
  },

  update: async (req, res) => {
    try {
      const vehicle = await Vehicle.findByPk(req.params.id);
      if (!vehicle || (req.user?.carrierId && vehicle.carrier_id && vehicle.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const allowedFields = ['model_name', 'vehicle_type', 'max_load_capacity_kg',
                             'odometer', 'acquisition_cost', 'region', 'status'];
      const updateData = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

      await vehicle.update(updateData);
      res.json({ success: true, message: 'Vehicle updated', data: vehicle });
    } catch (error) {
      console.error('Update vehicle error:', error);
      res.status(500).json({ success: false, message: 'Failed to update vehicle' });
    }
  },

  delete: async (req, res) => {
    try {
      const vehicle = await Vehicle.findByPk(req.params.id);
      if (!vehicle || (req.user?.carrierId && vehicle.carrier_id && vehicle.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      await vehicle.destroy();
      res.json({ success: true, message: 'Vehicle removed' });
    } catch (error) {
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete vehicle with existing trip history. Mark it as Retired instead.'
        });
      }
      res.status(500).json({ success: false, message: 'Failed to delete vehicle' });
    }
  },

  getEligibleForDispatch: async (req, res) => {
    try {
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = { status: 'Available' };
      if (req.user?.role !== 'admin' || req.user?.carrierId) {
        where.carrier_id = carrierId;
      }

      const vehicles = await Vehicle.findAll({
        where,
        order: [['registration_number', 'ASC']]
      });
      res.json({ success: true, data: vehicles });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch eligible vehicles' });
    }
  }
};

module.exports = vehicleController;
