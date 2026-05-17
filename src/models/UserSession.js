const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const UserSession = sequelize.define('UserSession', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: integerType,
    allowNull: false,
  },
  token_hash: {
    type: DataTypes.CHAR(64),
    allowNull: false,
    unique: true,
  },
  device_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'user_sessions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['expires_at'] },
    { fields: ['revoked_at'] },
    { fields: ['user_id', 'revoked_at'] },
  ],
});

UserSession.associate = (models) => {
  UserSession.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = UserSession;
