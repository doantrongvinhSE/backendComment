const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const User = sequelize.define('User', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('ADMIN', 'USER'),
    allowNull: false,
    defaultValue: 'USER',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
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
  tableName: 'users',
  timestamps: false,
});

User.associate = (models) => {
  User.hasMany(models.UserSession, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  User.hasMany(models.UserPost, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'userPosts',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  User.hasMany(models.UserComment, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'userComments',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  User.hasMany(models.Saler, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'salers',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  User.hasMany(models.Order, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'orders',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });
};

module.exports = User;
