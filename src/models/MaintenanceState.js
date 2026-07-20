const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaintenanceState = sequelize.define('MaintenanceState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'maintenance_states',
  timestamps: false,
});

module.exports = MaintenanceState;
