const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
  },
  uid: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fb_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  avatar_user: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  post_id: {
    type: integerType,
    allowNull: false,
  },
}, {
  tableName: 'comments',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['post_id', 'id'],
    },
    { fields: ['post_id', 'timestamp'] },
    { fields: ['phone'] },
  ],
});

Comment.associate = (models) => {
  Comment.belongsTo(models.Post, {
    foreignKey: 'post_id',
    targetKey: 'id',
    as: 'post',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  Comment.hasMany(models.UserComment, {
    foreignKey: 'comment_id',
    sourceKey: 'id',
    as: 'userComments',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = Comment;
