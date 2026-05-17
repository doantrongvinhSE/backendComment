const sequelize = require('../config/database');
const User = require('./User');
const UserSession = require('./UserSession');
const Post = require('./Post');
const UserPost = require('./UserPost');
const Comment = require('./Comment');
const UserComment = require('./UserComment');
const Order = require('./Order');

const models = { User, UserSession, Post, UserPost, Comment, UserComment, Order };

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  User,
  UserSession,
  Post,
  UserPost,
  Comment,
  UserComment,
  Order,
};
