const postService = require('../services/postService');

async function createUserPost(req, res, next) {
  try {
    const result = await postService.createUserPost(req.ownerId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listUserPosts(req, res, next) {
  try {
    const result = await postService.listUserPosts(req.ownerId, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function countTodayCommentedPosts(req, res, next) {
  try {
    const result = await postService.countTodayCommentedPosts(req.ownerId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listPublicPosts(req, res, next) {
  try {
    const result = await postService.listPublicPosts(req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getUserPost(req, res, next) {
  try {
    const result = await postService.getUserPost(req.ownerId, req.params.userPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updateUserPost(req, res, next) {
  try {
    const result = await postService.updateUserPost(req.ownerId, req.params.userPostId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteUserPost(req, res, next) {
  try {
    const result = await postService.deleteUserPost(req.ownerId, req.params.userPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserPost,
  listUserPosts,
  countTodayCommentedPosts,
  listPublicPosts,
  getUserPost,
  updateUserPost,
  deleteUserPost,
};
