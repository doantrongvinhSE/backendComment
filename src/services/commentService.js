const { Op } = require('sequelize');
const { Comment, UserComment, UserPost } = require('../models');
const { getPagination, paginationMeta } = require('../utils/pagination');
const realtimeService = require('./realtimeService');
const { vietnamTodayRange } = require('../utils/vietnamTime');

function notFoundResponse() {
  return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
}

const COMMENT_STATUSES = ['normal', 'fail', 'success', 'is_calling'];

function presentComment(comment, userPost, statusByCommentId) {
  return {
    id: comment.id,
    post_title: userPost.title,
    post_original_link: userPost.original_link,
    uid: comment.uid,
    fb_name: comment.fb_name,
    avatar_user: comment.avatar_user,
    content: comment.content,
    phone: comment.phone,
    timestamp: comment.timestamp,
    status: statusByCommentId.get(comment.id) || 'normal',
  };
}

async function buildStatusMap(userId, commentIds) {
  if (commentIds.length === 0) {
    return new Map();
  }

  const userComments = await UserComment.findAll({
    where: {
      user_id: userId,
      comment_id: commentIds,
    },
  });

  return new Map(userComments.map((userComment) => [userComment.comment_id, userComment.status]));
}

async function listCommentsByUserPost(userId, userPostId, query) {
  const pagination = getPagination(query);

  if (pagination.error) {
    return pagination.error;
  }

  const userPost = await UserPost.findOne({ where: { id: userPostId, user_id: userId } });

  if (!userPost) {
    return notFoundResponse();
  }

  const where = { post_id: userPost.post_id };
  const total = await Comment.count({ where });
  const comments = await Comment.findAll({
    where,
    order: [['timestamp', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const statusByCommentId = await buildStatusMap(userId, comments.map((comment) => comment.id));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comments: comments.map((comment) => presentComment(comment, userPost, statusByCommentId)),
      },
      pagination: paginationMeta(pagination.page, pagination.limit, total),
    },
  };
}

async function listAllUserComments(userId, query) {
  const pagination = getPagination(query);

  if (pagination.error) {
    return pagination.error;
  }

  const userPosts = await UserPost.findAll({ where: { user_id: userId } });
  const userPostByPostId = new Map(userPosts.map((userPost) => [userPost.post_id, userPost]));
  const postIds = userPosts.map((userPost) => userPost.post_id);

  if (postIds.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        data: { comments: [] },
        pagination: paginationMeta(pagination.page, pagination.limit, 0),
      },
    };
  }

  const where = { post_id: postIds };
  if (query.search) {
    where.phone = { [Op.like]: `%${query.search}%` };
  }
  if (query.phone === 'true') {
    where.phone = { [Op.ne]: null, [Op.not]: '' };
  }

  const total = await Comment.count({ where });
  const comments = await Comment.findAll({
    where,
    order: [['timestamp', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const statusByCommentId = await buildStatusMap(userId, comments.map((comment) => comment.id));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comments: comments.map((comment) => presentComment(
          comment,
          userPostByPostId.get(comment.post_id),
          statusByCommentId,
        )),
      },
      pagination: paginationMeta(pagination.page, pagination.limit, total),
    },
  };
}

async function countTodayUserComments(userId) {
  const userPosts = await UserPost.findAll({ where: { user_id: userId } });
  const postIds = userPosts.map((userPost) => userPost.post_id);

  if (postIds.length === 0) {
    return { status: 200, body: { success: true, data: { count: 0 } } };
  }

  const { start, end } = vietnamTodayRange();
  const count = await Comment.count({
    where: {
      post_id: postIds,
      timestamp: { [Op.gte]: start, [Op.lt]: end },
    },
  });

  return { status: 200, body: { success: true, data: { count } } };
}

async function updateCommentStatus(userId, commentId, status) {
  if (!COMMENT_STATUSES.includes(status)) {
    return { status: 400, body: { success: false, message: 'Trạng thái không hợp lệ' } };
  }

  const comment = await Comment.findByPk(commentId);

  if (!comment) {
    return { status: 404, body: { success: false, message: 'Comment không tồn tại' } };
  }

  const userPost = await UserPost.findOne({ where: { user_id: userId, post_id: comment.post_id } });

  if (!userPost) {
    return { status: 404, body: { success: false, message: 'Comment không tồn tại' } };
  }

  const [userComment] = await UserComment.findOrCreate({
    where: { user_id: userId, comment_id: commentId },
    defaults: { status },
  });

  if (userComment.status !== status) {
    await userComment.update({ status });
  }

  realtimeService.emitToRoom(`user:${userId}`, 'comment.status_updated', {
    comment: {
      id: commentId,
      user_post_id: userPost.id,
      post_title: userPost.title,
      post_original_link: userPost.original_link,
      status,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comment_id: commentId,
        status,
      },
    },
  };
}

module.exports = {
  listCommentsByUserPost,
  listAllUserComments,
  countTodayUserComments,
  updateCommentStatus,
};
