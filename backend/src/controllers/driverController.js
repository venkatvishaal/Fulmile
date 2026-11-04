const { Driver } = require('../models');
const { Op } = require('sequelize');

const driverController = {
  getAll: async (req, res) => {
    try {
      const { status } = req.query;
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };
      if (status) where.status = status;

      const drivers = await Driver.findAll({ where, order: [['name', 'ASC']] });
      res.json({ success: true, data: drivers });
    } catch (error) {
      console.error('Get drivers error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch drivers' });
    }
  },

  getById: async (req, res) => {
    try {
      const driver = await Driver.findByPk(req.params.id);
      if (!driver || (req.user?.carrierId && driver.carrier_id && driver.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      res.json({ success: true, data: driver });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch driver' });
    }
  },

  create: async (req, res) => {
    try {
      const { name, license_number, license_category,
              license_expiry_date, contact_number, safety_score } = req.body;

      const existing = await Driver.findOne({ where: { license_number } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A driver with this license number already exists'
        });
      }

      const driver = await Driver.create({
        name, license_number, license_category,
        license_expiry_date, contact_number,
        safety_score: safety_score || 5.0,
        status: 'Available',
        carrier_id: req.user?.carrierId || null
      });

      res.status(201).json({ success: true, message: 'Driver added successfully', data: driver });
    } catch (error) {
      console.error('Create driver error:', error);
      res.status(500).json({ success: false, message: 'Failed to add driver' });
    }
  },

  update: async (req, res) => {
    try {
      const driver = await Driver.findByPk(req.params.id);
      if (!driver || (req.user?.carrierId && driver.carrier_id && driver.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const allowedFields = ['name', 'license_number', 'license_category',
                             'license_expiry_date', 'contact_number', 'safety_score', 'status'];
      const updateData = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

      if (updateData.status && driver.status === 'On Trip' && updateData.status !== 'On Trip') {
        return res.status(400).json({
          success: false,
          message: `${driver.name} is on a trip. Their status changes automatically when the trip ends.`,
          errors: [{ field: 'status', message: 'Driver is on a trip' }]
        });
      }
      const expiry = updateData.license_expiry_date || driver.license_expiry_date;
      const nextStatus = updateData.status || driver.status;
      const touchesAvailability = updateData.status === 'Available' || updateData.license_expiry_date;
      if (touchesAvailability && nextStatus === 'Available' && expiry < new Date().toISOString().split('T')[0]) {
        return res.status(400).json({
          success: false,
          message: `License expired on ${expiry}. Enter the renewed expiry date before making ${driver.name} available.`,
          errors: [{ field: 'license_expiry_date', message: 'License is expired' }]
        });
      }

      await driver.update(updateData);
      res.json({ success: true, message: 'Driver updated', data: driver });
    } catch (error) {
      console.error('Update driver error:', error);
      res.status(500).json({ success: false, message: 'Failed to update driver' });
    }
  },

  delete: async (req, res) => {
    try {
      const driver = await Driver.findByPk(req.params.id);
      if (!driver || (req.user?.carrierId && driver.carrier_id && driver.carrier_id !== req.user.carrierId)) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      await driver.destroy();
      res.json({ success: true, message: 'Driver removed' });
    } catch (error) {
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete driver with trip history. Mark as Suspended instead.'
        });
      }
      res.status(500).json({ success: false, message: 'Failed to delete driver' });
    }
  },

  getEligibleForDispatch: async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = {
        status: 'Available',
        license_expiry_date: { [Op.gte]: today }
      };
      if (req.user?.role !== 'admin' || req.user?.carrierId) {
        where.carrier_id = carrierId;
      }

      const drivers = await Driver.findAll({
        where,
        order: [['name', 'ASC']]
      });
      res.json({ success: true, data: drivers });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch eligible drivers' });
    }
  }
};

module.exports = driverController;
