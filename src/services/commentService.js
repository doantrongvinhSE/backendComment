const { Op, QueryTypes } = require('sequelize');
const { sequelize, Comment, UserComment, UserPost } = require('../models');
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

  const replacements = {
    userId,
    limit: pagination.limit,
    offset: pagination.offset,
  };
  const filters = [];

  if (query.search) {
    filters.push('c.phone LIKE :search');
    replacements.search = `%${query.search}%`;
  }
  if (query.phone === 'true') {
    filters.push('c.phone > :emptyPhone');
    replacements.emptyPhone = '';
  }

  const filterSql = filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '';
  const fromSql = `
    FROM comments c
    INNER JOIN user_posts up
      ON up.post_id = c.post_id
      AND up.user_id = :userId
    WHERE 1 = 1${filterSql}
  `;
  const countSql = query.phone === 'true' || query.search
    ? `
      SELECT COUNT(*) AS total
      ${fromSql}
    `
    : `
      SELECT /* comments_default_count */ COUNT(*) AS total
      FROM user_posts up
      INNER JOIN comments c
        ON c.post_id = up.post_id
      WHERE up.user_id = :userId
    `;
  const commentsSql = query.phone === 'true' || query.search
    ? `
      SELECT
        c.id,
        up.title AS post_title,
        up.original_link AS post_original_link,
        c.uid,
        c.fb_name,
        c.avatar_user,
        c.content,
        c.phone,
        c.timestamp
      ${fromSql}
      ORDER BY c.timestamp DESC
      LIMIT :limit OFFSET :offset
    `
    : `
      SELECT /* comments_default_page */
        c.id,
        up.title AS post_title,
        up.original_link AS post_original_link,
        c.uid,
        c.fb_name,
        c.avatar_user,
        c.content,
        c.phone,
        c.timestamp
      FROM comments c
      INNER JOIN user_posts up
        ON up.post_id = c.post_id
        AND up.user_id = :userId
      ORDER BY c.timestamp DESC
      LIMIT :limit OFFSET :offset
    `;
  const [[{ total }], comments] = await Promise.all([
    sequelize.query(countSql, {
      replacements,
      type: QueryTypes.SELECT,
    }),
    sequelize.query(commentsSql, {
      replacements,
      type: QueryTypes.SELECT,
    }),
  ]);
  const statusByCommentId = await buildStatusMap(userId, comments.map((comment) => comment.id));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comments: comments.map((comment) => ({
          id: comment.id,
          post_title: comment.post_title,
          post_original_link: comment.post_original_link,
          uid: comment.uid,
          fb_name: comment.fb_name,
          avatar_user: comment.avatar_user,
          content: comment.content,
          phone: comment.phone,
          timestamp: comment.timestamp,
          status: statusByCommentId.get(comment.id) || 'normal',
        })),
      },
      pagination: paginationMeta(pagination.page, pagination.limit, Number(total)),
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
