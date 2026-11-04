const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trip = sequelize.define('Trip', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vehicle_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vehicles', key: 'id' }
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'drivers', key: 'id' }
  },
  source: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  cargo_weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  planned_distance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Draft',
    validate: {
      isIn: [['Draft', 'Dispatched', 'Completed', 'Cancelled']]
    }
  },
  final_odometer: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  fuel_consumed_liters: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  dispatched_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_shared: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  price_quote: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  route_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'routes', key: 'id' }
  },
  tracking_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
    unique: true
  },
  estimated_fuel_liters: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  carrier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'carriers', key: 'id' }
  }
}, {
  tableName: 'trips',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['vehicle_id'] },
    { fields: ['driver_id'] },
    { fields: ['status'] },
    { fields: ['vehicle_id', 'status'] }
  ]
});

module.exports = Trip;
