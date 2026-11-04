const { MaintenanceLog, Vehicle } = require('../models');
const sequelize = require('../config/database');

const maintenanceController = {
  getAll: async (req, res) => {
    try {
      const { status, vehicle_id } = req.query;
      const where = {};
      if (status) where.status = status;
      if (vehicle_id) where.vehicle_id = vehicle_id;

      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const vehicleWhere = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };

      const logs = await MaintenanceLog.findAll({
        where,
        include: [{
          model: Vehicle,
          as: 'vehicle',
          where: vehicleWhere,
          required: Boolean(req.user?.role !== 'admin' || req.user?.carrierId),
          attributes: ['id', 'registration_number', 'model_name']
        }],
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('Get maintenance logs error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch maintenance logs' });
    }
  },

  create: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { vehicle_id, type, description, cost, scheduled_date } = req.body;

      const vehicle = await Vehicle.findByPk(vehicle_id, { transaction: t });
      if (!vehicle) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      if (vehicle.status === 'On Trip') {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Cannot open maintenance for a vehicle currently on a trip' });
      }

      const log = await MaintenanceLog.create({
        vehicle_id, type, description, cost: cost || 0,
        scheduled_date, status: 'open'
      }, { transaction: t });

      // Set vehicle to In Shop
      await vehicle.update({ status: 'In Shop' }, { transaction: t });

      await t.commit();

      const io = req.app.get('io');
      if (io) io.emit('fleet:update', { event: 'maintenance_opened', vehicleId: vehicle_id });

      const fullLog = await MaintenanceLog.findByPk(log.id, {
        include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'registration_number', 'model_name'] }]
      });

      res.status(201).json({ success: true, message: 'Maintenance opened. Vehicle is now In Shop.', data: fullLog });
    } catch (error) {
      await t.rollback();
      console.error('Create maintenance error:', error);
      res.status(500).json({ success: false, message: 'Failed to open maintenance' });
    }
  },

  close: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const log = await MaintenanceLog.findByPk(req.params.id, {
        include: [{ model: Vehicle, as: 'vehicle' }],
        transaction: t
      });

      if (!log) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Maintenance log not found' });
      }
      if (log.status === 'closed') {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Maintenance is already closed' });
      }

      const completedDate = new Date().toISOString().split('T')[0];
      const { cost } = req.body;

      await log.update({
        status: 'closed',
        completed_date: completedDate,
        cost: cost !== undefined ? cost : log.cost
      }, { transaction: t });

      // Restore vehicle only if not Retired
      const vehicle = await Vehicle.findByPk(log.vehicle_id, { transaction: t });
      if (vehicle && vehicle.status !== 'Retired') {
        await vehicle.update({ status: 'Available' }, { transaction: t });
      }

      await t.commit();

      const io = req.app.get('io');
      if (io) io.emit('fleet:update', { event: 'maintenance_closed', vehicleId: log.vehicle_id });

      res.json({ success: true, message: 'Maintenance closed. Vehicle restored to Available.', data: log });
    } catch (error) {
      await t.rollback();
      console.error('Close maintenance error:', error);
      res.status(500).json({ success: false, message: 'Failed to close maintenance' });
    }
  }
};

module.exports = maintenanceController;
