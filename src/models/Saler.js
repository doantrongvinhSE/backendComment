const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const Saler = sequelize.define('Saler', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: integerType,
    allowNull: false,
  },
  name_saler: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  username_saler: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'salers',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { unique: true, fields: ['user_id', 'username_saler'] },
  ],
});

Saler.associate = (models) => {
  Saler.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = Saler;
