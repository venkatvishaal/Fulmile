const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  registration_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
  },
  model_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  vehicle_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['bike', 'van', 'truck', 'mini_truck', 'container_truck']]
    }
  },
  max_load_capacity_kg: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  odometer: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 }
  },
  acquisition_cost: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Available',
    validate: {
      isIn: [['Available', 'On Trip', 'In Shop', 'Retired']]
    }
  },
  carrier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'carriers', key: 'id' }
  }
}, {
  tableName: 'vehicles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['region'] },
    { fields: ['vehicle_type'] }
  ]
});

module.exports = Vehicle;
