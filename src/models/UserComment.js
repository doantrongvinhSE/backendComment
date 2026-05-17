const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const integerType = process.env.NODE_ENV === 'test' ? DataTypes.INTEGER : DataTypes.INTEGER.UNSIGNED;

const UserComment = sequelize.define('UserComment', {
  id: {
    type: integerType,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: integerType,
    allowNull: false,
  },
  comment_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('normal', 'fail', 'success', 'is_calling'),
    allowNull: false,
    defaultValue: 'normal',
  },
}, {
  tableName: 'user_comments',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'comment_id'],
    },
    { fields: ['comment_id'] },
    { fields: ['user_id', 'status'] },
  ],
});

UserComment.associate = (models) => {
  UserComment.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  UserComment.belongsTo(models.Comment, {
    foreignKey: 'comment_id',
    targetKey: 'id',
    as: 'comment',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });
};

module.exports = UserComment;
