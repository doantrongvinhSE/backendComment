const { Comment, Post, UserPost } = require('../models');
const realtimeService = require('./realtimeService');
const { countTodayComments, countTodayPhones } = require('./postService');

function presentPost(post) {
  return {
    id: post.id,
    fb_post_id: post.fb_post_id,
    last_count: post.last_count,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

async function listPostsForIngest(query = {}) {
  const offset = Math.max(parseInt(query.offset || '0', 10), 0);
  const limit = Math.max(parseInt(query.limit || '100', 10), 1);
  const [posts, total] = await Promise.all([
    Post.findAll({ order: [['created_at', 'DESC']], offset, limit }),
    Post.count(),
  ]);

  return {
    status: 200,
    body: { success: true, data: { posts: posts.map(presentPost) }, pagination: { offset, limit, total } },
  };
}

async function updatePostLastCount(fbPostId, lastCount) {
  const post = await Post.findOne({ where: { fb_post_id: fbPostId } });

  if (!post) {
    return { status: 404, body: { success: false, message: 'Post không tồn tại' } };
  }

  await post.update({ last_count: lastCount, updated_at: new Date() });

  return { status: 200, body: { success: true, data: presentPost(post) } };
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

  for (const comment of comments) {
    const createdComment = await Comment.create({
      id: comment.id,
      uid: comment.uid,
      fb_name: comment.fb_name || null,
      avatar_user: comment.avatar_user || null,
      content: comment.content || null,
      phone: comment.phone || null,
      timestamp: new Date(comment.timestamp),
      post_id: post.id,
    });
    createdCount += 1;
    const [todayCommentCount, phoneToday] = await Promise.all([
      countTodayComments(post.id),
      countTodayPhones(post.id),
    ]);

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
        },
      });
    });
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
};
