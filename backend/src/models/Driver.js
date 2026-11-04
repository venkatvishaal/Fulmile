const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  license_category: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  license_expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  contact_number: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  safety_score: {
    type: DataTypes.DECIMAL(3, 1),
    allowNull: false,
    defaultValue: 5.0,
    validate: { min: 0, max: 10 }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Available',
    validate: {
      isIn: [['Available', 'On Trip', 'Off Duty', 'Suspended']]
    }
  },
  carrier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'carriers', key: 'id' }
  }
}, {
  tableName: 'drivers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['license_expiry_date'] }
  ]
});

module.exports = Driver;
