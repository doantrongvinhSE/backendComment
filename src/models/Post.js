const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const Post = sequelize.define('Post', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  fb_post_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  last_count: {
    type: integerType,
    allowNull: false,
    defaultValue: 0,
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
  tableName: 'posts',
  timestamps: false,
});

Post.associate = (models) => {
  Post.hasMany(models.UserPost, {
    foreignKey: 'post_id',
    sourceKey: 'id',
    as: 'userPosts',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  Post.hasMany(models.Comment, {
    foreignKey: 'post_id',
    sourceKey: 'id',
    as: 'comments',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = Post;
