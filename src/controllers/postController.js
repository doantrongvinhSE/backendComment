const postService = require('../services/postService');

async function createUserPost(req, res, next) {
  try {
    const result = await postService.createUserPost(req.user.id, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listUserPosts(req, res, next) {
  try {
    const result = await postService.listUserPosts(req.user.id, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function countTodayCommentedPosts(req, res, next) {
  try {
    const result = await postService.countTodayCommentedPosts(req.user.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getUserPost(req, res, next) {
  try {
    const result = await postService.getUserPost(req.user.id, req.params.userPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updateUserPost(req, res, next) {
  try {
    const result = await postService.updateUserPost(req.user.id, req.params.userPostId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteUserPost(req, res, next) {
  try {
    const result = await postService.deleteUserPost(req.user.id, req.params.userPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserPost,
  listUserPosts,
  countTodayCommentedPosts,
  getUserPost,
  updateUserPost,
  deleteUserPost,
};
