const { Op } = require('sequelize');
const { Comment, Post, UserPost } = require('../models');
const { getPagination, paginationMeta } = require('../utils/pagination');
const realtimeService = require('./realtimeService');
const { vietnamDateKey, vietnamTodayRange } = require('../utils/vietnamTime');

function extractPostId(linkPost) {
  if (!linkPost) return null;

  const patterns = [
    /(?:videos|reel)\/(\d+)/,
    /[?&]v=(\d+)/,
    /fb\.watch\/.*?\/(\d+)/,
  ];

  for (const regex of patterns) {
    const match = linkPost.match(regex);
    if (match) return match[1];
  }

  return null;
}

function invalidLinkResponse() {
  return {
    status: 400,
    body: {
      success: false,
      message: 'Link Facebook không hợp lệ. Chỉ hỗ trợ link video, reel hoặc fb.watch.',
    },
  };
}

function missingTitleResponse() {
  return { status: 400, body: { success: false, message: 'Tên bài viết là bắt buộc' } };
}

function missingLinkResponse() {
  return { status: 400, body: { success: false, message: 'Link Facebook là bắt buộc' } };
}

function duplicateLinkResponse() {
  return { status: 400, body: { success: false, message: 'Link bài viết đã tồn tại' } };
}

function notFoundResponse() {
  return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
}

function invalidFilterResponse() {
  return { status: 400, body: { success: false, message: 'Tham số lọc không hợp lệ' } };
}

function todayDateKey(date = new Date()) {
  return vietnamDateKey(date);
}

function todayRange() {
  return vietnamTodayRange();
}

async function countTodayComments(postId) {
  const { start, end } = todayRange();

  return Comment.count({
    where: {
      post_id: postId,
      timestamp: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    },
  });
}

async function countTodayPhones(postId) {
  const { start, end } = todayRange();
  const comments = await Comment.findAll({
    attributes: ['phone'],
    where: {
      post_id: postId,
      timestamp: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
      phone: { [Op.ne]: null },
    },
  });

  return comments.filter((comment) => comment.phone.trim() !== '').length;
}

function cachedStats(post) {
  if (!post || post.stats_date !== todayDateKey()) {
    return { todayCommentCount: 0, phoneToday: 0 };
  }

  return {
    todayCommentCount: post.today_comment_count,
    phoneToday: post.phone_today,
  };
}

function presentUserPost(userPost) {
  const { todayCommentCount, phoneToday } = cachedStats(userPost.post);

  return {
    id: userPost.id,
    title: userPost.title,
    original_link: userPost.original_link,
    today_comment_count: todayCommentCount,
    phone_today: phoneToday,
    created_at: userPost.created_at,
    updated_at: userPost.post.updated_at,
  };
}

function parseDateFilter(value) {
  if (value === undefined) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPostFilters(userId, query = {}) {
  const where = { user_id: userId };

  if (query.title_search) {
    where.title = { [Op.like]: `%${query.title_search}%` };
  }

  if (query.search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${query.search}%` } },
      { original_link: { [Op.like]: `%${query.search}%` } },
    ];
  }

  const createdFrom = parseDateFilter(query.created_from);
  const createdTo = parseDateFilter(query.created_to);

  if ((query.created_from && !createdFrom) || (query.created_to && !createdTo)) {
    return { error: invalidFilterResponse() };
  }

  if (createdFrom && createdTo && createdFrom > createdTo) {
    return { error: invalidFilterResponse() };
  }

  if (createdFrom || createdTo) {
    where.created_at = {};
    if (createdFrom) where.created_at[Op.gte] = createdFrom;
    if (createdTo) where.created_at[Op.lte] = createdTo;
  }

  return { where };
}

function parsePostSort(query = {}) {
  const allowedSorts = ['created_at', 'updated_at', 'title', 'today_comment_count', 'phone_today'];
  const sortBy = query.sort_by || 'created_at';

  if (!allowedSorts.includes(sortBy)) {
    return { error: invalidFilterResponse() };
  }

  if (query.sort_order && !['asc', 'desc'].includes(query.sort_order)) {
    return { error: invalidFilterResponse() };
  }

  const defaultOrder = sortBy === 'title' ? 'asc' : 'desc';
  const sortOrder = query.sort_order || defaultOrder;

  return { sortBy, sortOrder };
}

function presentUserPosts(userPosts) {
  return userPosts.map(presentUserPost);
}

async function createUserPost(userId, { title, originalLink }) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedOriginalLink = typeof originalLink === 'string' ? originalLink.trim() : '';

  if (!normalizedTitle) {
    return missingTitleResponse();
  }

  if (!normalizedOriginalLink) {
    return missingLinkResponse();
  }

  const fbPostId = extractPostId(normalizedOriginalLink);

  if (!fbPostId) {
    return invalidLinkResponse();
  }

  const [post] = await Post.findOrCreate({
    where: { fb_post_id: fbPostId },
    defaults: { fb_post_id: fbPostId, last_count: 0 },
  });

  const [userPost, created] = await UserPost.findOrCreate({
    where: { user_id: userId, post_id: post.id },
    defaults: {
      user_id: userId,
      post_id: post.id,
      title: normalizedTitle,
      original_link: normalizedOriginalLink,
    },
  });

  if (!created) {
    return duplicateLinkResponse();
  }

  const result = await getUserPost(userId, userPost.id);
  realtimeService.emitToRoom(`user:${userId}`, 'post.created', { post: result.body.data });
  return { status: 201, body: result.body };
}

async function listUserPosts(userId, query) {
  const pagination = getPagination(query);

  if (pagination.error) {
    return pagination.error;
  }

  const filters = buildPostFilters(userId, query);

  if (filters.error) {
    return filters.error;
  }

  const sort = parsePostSort(query);

  if (sort.error) {
    return sort.error;
  }

  const total = await UserPost.count({ where: filters.where });

  const order = ['today_comment_count', 'phone_today', 'updated_at'].includes(sort.sortBy)
    ? [[{ model: Post, as: 'post' }, sort.sortBy, sort.sortOrder.toUpperCase()]]
    : [[sort.sortBy, sort.sortOrder.toUpperCase()]];

  const userPosts = await UserPost.findAll({
    where: filters.where,
    include: [{ model: Post, as: 'post' }],
    order,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  const posts = presentUserPosts(userPosts);

  return {
    status: 200,
    body: {
      success: true,
      data: { posts },
      pagination: paginationMeta(pagination.page, pagination.limit, total),
    },
  };
}

async function getUserPost(userId, userPostId) {
  const userPost = await UserPost.findOne({
    where: { id: userPostId, user_id: userId },
    include: [{ model: Post, as: 'post' }],
  });

  if (!userPost) {
    return notFoundResponse();
  }

  return { status: 200, body: { success: true, data: presentUserPost(userPost) } };
}

async function updateUserPost(userId, userPostId, body) {
  const { title } = body;
  const originalLink = body.originalLink !== undefined ? body.originalLink : body.original_link;
  const userPost = await UserPost.findOne({ where: { id: userPostId, user_id: userId } });

  if (!userPost) {
    return notFoundResponse();
  }

  const updates = { updated_at: new Date() };

  if (title !== undefined) updates.title = title;

  if (originalLink !== undefined) {
    const fbPostId = extractPostId(originalLink);

    if (!fbPostId) {
      return invalidLinkResponse();
    }

    const [post] = await Post.findOrCreate({
      where: { fb_post_id: fbPostId },
      defaults: { fb_post_id: fbPostId, last_count: 0 },
    });
    const duplicateUserPost = await UserPost.findOne({
      where: {
        user_id: userId,
        post_id: post.id,
        id: { [Op.ne]: userPost.id },
      },
    });

    if (duplicateUserPost) {
      return duplicateLinkResponse();
    }

    updates.post_id = post.id;
    updates.original_link = originalLink;
  }

  const oldPostId = userPost.post_id;
  await userPost.update(updates);

  if (updates.post_id && updates.post_id !== oldPostId) {
    const remainingUserPosts = await UserPost.count({ where: { post_id: oldPostId } });
    if (remainingUserPosts === 0) {
      await Post.destroy({ where: { id: oldPostId } });
    }
  }

  const result = await getUserPost(userId, userPost.id);
  realtimeService.emitToRoom(`user:${userId}`, 'post.updated', { post: JSON.parse(JSON.stringify(result.body.data)) });
  return result;
}

async function deleteUserPost(userId, userPostId) {
  const userPost = await UserPost.findOne({ where: { id: userPostId, user_id: userId } });

  if (!userPost) {
    return notFoundResponse();
  }

  const postId = userPost.post_id;
  await userPost.destroy();

  const remainingUserPosts = await UserPost.count({ where: { post_id: postId } });
  if (remainingUserPosts === 0) {
    await Post.destroy({ where: { id: postId } });
  }

  realtimeService.emitToRoom(`user:${userId}`, 'post.deleted', { post: { id: userPost.id } });

  return { status: 200, body: { success: true } };
}

module.exports = {
  extractPostId,
  createUserPost,
  listUserPosts,
  getUserPost,
  updateUserPost,
  deleteUserPost,
  countTodayComments,
  countTodayPhones,
  todayDateKey,
};
