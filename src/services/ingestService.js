const { Comment, Post, UserPost } = require('../models');
const realtimeService = require('./realtimeService');
const { todayDateKey } = require('./postService');

function presentPost(post) {
  return {
    id: post.id,
    fb_post_id: post.fb_post_id,
    last_count: post.last_count,
    is_blocked: post.is_blocked,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

function hasPhone(phone) {
  return typeof phone === 'string' && phone.trim() !== '';
}

function isToday(date) {
  return todayDateKey(date) === todayDateKey();
}

async function incrementTodayStats(post, comment) {
  const commentDate = new Date(comment.timestamp);

  if (!isToday(commentDate)) {
    return {
      todayCommentCount: post.today_comment_count,
      phoneToday: post.phone_today,
    };
  }

  const today = todayDateKey();
  const baseTodayCommentCount = post.stats_date === today ? post.today_comment_count : 0;
  const basePhoneToday = post.stats_date === today ? post.phone_today : 0;
  const todayCommentCount = baseTodayCommentCount + 1;
  const phoneToday = basePhoneToday + (hasPhone(comment.phone) ? 1 : 0);

  await post.update({
    today_comment_count: todayCommentCount,
    phone_today: phoneToday,
    stats_date: today,
  });

  return { todayCommentCount, phoneToday };
}

async function listPostsForIngest(query = {}) {
  const offset = Math.max(parseInt(query.offset || '0', 10), 0);
  const limit = Math.max(parseInt(query.limit || '100', 10), 1);
  const where = {};

  if (query.is_blocked === 'true') {
    where.is_blocked = true;
  }

  if (query.is_blocked === 'false') {
    where.is_blocked = false;
  }

  const [posts, total] = await Promise.all([
    Post.findAll({ where, order: [['created_at', 'DESC']], offset, limit }),
    Post.count({ where }),
  ]);

  return {
    status: 200,
    body: { success: true, data: { posts: posts.map(presentPost) }, pagination: { offset, limit, total } },
  };
}

async function updatePostLastCount(fbPostId, body = {}) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  const updates = { updated_at: new Date() };

  if (body.last_count !== undefined) {
    updates.last_count = body.last_count;
  }

  if (body.is_blocked !== undefined) {
    updates.is_blocked = body.is_blocked;
  }

  await post.update(updates);

  return { status: 200, body: { success: true, data: presentPost(post) } };
}

async function deletePostByFbPostId(fbPostId) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  await post.destroy();

  return { status: 200, body: { success: true } };
}

async function ingestCommentsBulk({ fb_post_id: fbPostId, comments = [] }) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  const commentIds = comments.map((comment) => comment.id);

  if (new Set(commentIds).size !== commentIds.length) {
    return { status: 409, body: { success: false, message: 'Comment đã tồn tại' } };
  }

  const existingComment = await Comment.findOne({ where: { id: commentIds } });

  if (existingComment) {
    return { status: 409, body: { success: false, message: 'Comment đã tồn tại' } };
  }

  const userPosts = await UserPost.findAll({ where: { post_id: post.id }, order: [['id', 'ASC']] });
  let createdCount = 0;
  let latestCommentTimestamp = null;

  for (const comment of comments) {
    const commentTimestamp = new Date(comment.timestamp);
    if (!latestCommentTimestamp || commentTimestamp > latestCommentTimestamp) {
      latestCommentTimestamp = commentTimestamp;
    }

    const createdComment = await Comment.create({
      id: comment.id,
      uid: comment.uid,
      fb_name: comment.fb_name || null,
      avatar_user: comment.avatar_user || null,
      content: comment.content || null,
      phone: comment.phone || null,
      timestamp: commentTimestamp,
      post_id: post.id,
    });
    createdCount += 1;
    const { todayCommentCount, phoneToday } = await incrementTodayStats(post, createdComment);

    userPosts.forEach((userPost) => {
      realtimeService.emitToRoom(`user:${userPost.user_id}`, 'comment.created', {
        comment: {
          id: createdComment.id,
          user_post_id: userPost.id,
          post_id: createdComment.post_id,
          post_title: userPost.title,
          post_original_link: userPost.original_link,
          uid: createdComment.uid,
          fb_name: createdComment.fb_name,
          avatar_user: createdComment.avatar_user,
          content: createdComment.content,
          phone: createdComment.phone,
          timestamp: createdComment.timestamp,
          status: 'normal',
        },
      });
      realtimeService.emitToRoom(`user:${userPost.user_id}`, 'post.stats_updated', {
        post: {
          id: userPost.id,
          today_comment_count: todayCommentCount,
          phone_today: phoneToday,
          updated_at: createdComment.timestamp,
        },
      });
    });
  }

  if (createdCount > 0 && latestCommentTimestamp > post.updated_at) {
    await post.update({ updated_at: latestCommentTimestamp });
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        post_id: post.id,
        received_count: comments.length,
        created_count: createdCount,
      },
    },
  };
}

module.exports = {
  ingestCommentsBulk,
  listPostsForIngest,
  updatePostLastCount,
  deletePostByFbPostId,
};
