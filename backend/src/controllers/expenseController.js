const { Expense, Vehicle } = require('../models');

const expenseController = {
  getAll: async (req, res) => {
    try {
      const { vehicle_id, type } = req.query;
      const where = {};
      if (vehicle_id) where.vehicle_id = vehicle_id;
      if (type) where.type = type;

      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const vehicleWhere = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };

      const expenses = await Expense.findAll({
        where,
        include: [{
          model: Vehicle,
          as: 'vehicle',
          where: vehicleWhere,
          required: Boolean(req.user?.role !== 'admin' || req.user?.carrierId),
          attributes: ['id', 'registration_number', 'model_name']
        }],
        order: [['date', 'DESC']]
      });
      res.json({ success: true, data: expenses });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
    }
  },

  create: async (req, res) => {
    try {
      const { vehicle_id, type, cost, date, description } = req.body;

      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const expense = await Expense.create({ vehicle_id, type, cost, date, description });
      res.status(201).json({ success: true, message: 'Expense recorded', data: expense });
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ success: false, message: 'Failed to create expense' });
    }
  }
};

module.exports = expenseController;
