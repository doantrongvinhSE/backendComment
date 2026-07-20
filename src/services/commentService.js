const { Op, QueryTypes } = require('sequelize');
const { sequelize, Comment, UserComment, UserPost } = require('../models');
const { getPagination, paginationMeta } = require('../utils/pagination');
const realtimeService = require('./realtimeService');
const { vietnamTodayRange } = require('../utils/vietnamTime');

function notFoundResponse() {
  return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
}

const COMMENT_STATUSES = ['normal', 'fail', 'success', 'is_calling'];

function presentOrderInfo(userComment) {
  if (!userComment || userComment.order_customer_name == null) {
    return null;
  }

  return {
    customer_name: userComment.order_customer_name,
    phone: userComment.order_phone,
    address: userComment.order_address,
    cod: userComment.order_cod,
    note: userComment.order_note,
  };
}

function presentComment(comment, userPost, userCommentByCommentId) {
  const userComment = userCommentByCommentId.get(comment.id);

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
    status: userComment ? userComment.status : 'normal',
    order_info: presentOrderInfo(userComment),
  };
}

async function buildUserCommentMap(userId, commentIds) {
  if (commentIds.length === 0) {
    return new Map();
  }

  const userComments = await UserComment.findAll({
    where: {
      user_id: userId,
      comment_id: commentIds,
    },
  });

  return new Map(userComments.map((userComment) => [userComment.comment_id, userComment]));
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
  const userCommentByCommentId = await buildUserCommentMap(userId, comments.map((comment) => comment.id));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comments: comments.map((comment) => presentComment(comment, userPost, userCommentByCommentId)),
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
  const isMysql = sequelize.getDialect() === 'mysql';
  const countCommentsTable = isMysql && query.phone === 'true'
    ? 'comments c FORCE INDEX (idx_comments_post_phone_timestamp)'
    : 'comments c';
  const pageCommentsTable = isMysql
    ? 'comments c FORCE INDEX (idx_comments_timestamp_post)'
    : 'comments c';
  const countFromSql = `
    FROM ${countCommentsTable}
    INNER JOIN user_posts up
      ON up.post_id = c.post_id
      AND up.user_id = :userId
    WHERE 1 = 1${filterSql}
  `;
  const countSql = query.phone === 'true' || query.search
    ? `
      SELECT COUNT(*) AS total
      ${countFromSql}
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
      FROM ${pageCommentsTable}
      INNER JOIN user_posts up
        ON up.post_id = c.post_id
        AND up.user_id = :userId
      WHERE 1 = 1${filterSql}
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
      FROM ${pageCommentsTable}
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
  const userCommentByCommentId = await buildUserCommentMap(userId, comments.map((comment) => comment.id));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comments: comments.map((comment) => {
          const userComment = userCommentByCommentId.get(comment.id);

          return {
            id: comment.id,
            post_title: comment.post_title,
            post_original_link: comment.post_original_link,
            uid: comment.uid,
            fb_name: comment.fb_name,
            avatar_user: comment.avatar_user,
            content: comment.content,
            phone: comment.phone,
            timestamp: comment.timestamp,
            status: userComment ? userComment.status : 'normal',
            order_info: presentOrderInfo(userComment),
          };
        }),
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

function normalizeOrderInfo(orderInfo) {
  if (orderInfo === undefined || orderInfo === null) {
    return { fields: null };
  }

  if (typeof orderInfo !== 'object' || Array.isArray(orderInfo)) {
    return { error: 'Thông tin đơn hàng không hợp lệ' };
  }

  return {
    fields: {
      order_customer_name: orderInfo.customer_name === undefined ? null : orderInfo.customer_name,
      order_phone: orderInfo.phone === undefined ? null : orderInfo.phone,
      order_address: orderInfo.address === undefined ? null : orderInfo.address,
      order_cod: orderInfo.cod === undefined ? null : orderInfo.cod,
      order_note: orderInfo.note === undefined ? null : orderInfo.note,
    },
  };
}

async function updateCommentStatus(userId, commentId, status, orderInfo) {
  if (!COMMENT_STATUSES.includes(status)) {
    return { status: 400, body: { success: false, message: 'Trạng thái không hợp lệ' } };
  }

  const normalized = normalizeOrderInfo(orderInfo);

  if (normalized.error) {
    return { status: 400, body: { success: false, message: normalized.error } };
  }

  const comment = await Comment.findByPk(commentId);

  if (!comment) {
    return { status: 404, body: { success: false, message: 'Comment không tồn tại' } };
  }

  const userPost = await UserPost.findOne({ where: { user_id: userId, post_id: comment.post_id } });

  if (!userPost) {
    return { status: 404, body: { success: false, message: 'Comment không tồn tại' } };
  }

  const updates = { status, ...(normalized.fields || {}) };

  const [userComment, created] = await UserComment.findOrCreate({
    where: { user_id: userId, comment_id: commentId },
    defaults: updates,
  });

  if (!created) {
    await userComment.update(updates);
  }

  realtimeService.emitToRoom(`user:${userId}`, 'comment.status_updated', {
    comment: {
      id: commentId,
      user_post_id: userPost.id,
      post_title: userPost.title,
      post_original_link: userPost.original_link,
      status,
      order_info: presentOrderInfo(userComment),
    },
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        comment_id: commentId,
        status,
        order_info: presentOrderInfo(userComment),
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
