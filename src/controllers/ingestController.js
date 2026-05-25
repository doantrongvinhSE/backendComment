const ingestService = require('../services/ingestService');

async function ingestCommentsBulk(req, res, next) {
  try {
    const result = await ingestService.ingestCommentsBulk(req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listPosts(req, res, next) {
  try {
    const result = await ingestService.listPostsForIngest(req.query);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updatePostLastCount(req, res, next) {
  try {
    const result = await ingestService.updatePostLastCount(req.params.fbPostId, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deletePost(req, res, next) {
  try {
    const result = await ingestService.deletePostByFbPostId(req.params.fbPostId);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  ingestCommentsBulk,
  listPosts,
  updatePostLastCount,
  deletePost,
};
