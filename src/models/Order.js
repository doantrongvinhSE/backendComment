const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const Order = sequelize.define('Order', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: integerType,
    allowNull: false,
  },
  product_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  avatar_customer: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  staff: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },
  total_price: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: 'orders',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'status'] },
    { fields: ['created_at'] },
  ],
});

Order.associate = (models) => {
  Order.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });
};

module.exports = Order;
