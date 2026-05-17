const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const UserPost = sequelize.define('UserPost', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: integerType,
    allowNull: false,
  },
  post_id: {
    type: integerType,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  original_link: {
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
  tableName: 'user_posts',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'post_id'],
    },
    { fields: ['user_id'] },
    { fields: ['post_id'] },
  ],
});

UserPost.associate = (models) => {
  UserPost.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  UserPost.belongsTo(models.Post, {
    foreignKey: 'post_id',
    targetKey: 'id',
    as: 'post',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = UserPost;
