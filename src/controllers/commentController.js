const commentService = require('../services/commentService');

async function listCommentsByUserPost(req, res, next) {
  try {
    const result = await commentService.listCommentsByUserPost(req.user.id, req.params.userPostId, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listAllUserComments(req, res, next) {
  try {
    const result = await commentService.listAllUserComments(req.user.id, req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function countTodayUserComments(req, res, next) {
  try {
    const result = await commentService.countTodayUserComments(req.user.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updateCommentStatus(req, res, next) {
  try {
    const result = await commentService.updateCommentStatus(req.user.id, req.params.commentId, req.body.status);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCommentsByUserPost,
  listAllUserComments,
  countTodayUserComments,
  updateCommentStatus,
};
