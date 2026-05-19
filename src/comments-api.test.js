const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const commentService = require('./services/commentService');
const realtimeService = require('./services/realtimeService');
const { sequelize, User, UserSession, Post, UserPost, Comment, UserComment } = require('./models');

async function loginUser(username = 'user1') {
  const user = await User.create({
    username,
    password_hash: await bcrypt.hash('password123', 10),
    name: username,
    role: 'USER',
  });

  const response = await request(app)
    .post('/auth/login')
    .send({ username, password: 'password123' })
    .expect(200);

  return { user, token: response.body.data.token };
}

async function createTrackedPost(user, fbPostId, title) {
  const post = await Post.create({ fb_post_id: fbPostId });
  const userPost = await UserPost.create({ user_id: user.id, post_id: post.id, title });
  return { post, userPost };
}

async function createComment(post, id, timestamp) {
  return Comment.create({
    id,
    uid: `uid_${id}`,
    fb_name: `Khách ${id}`,
    avatar_user: `https://example.com/${id}.jpg`,
    content: `Nội dung ${id}`,
    phone: `09000000${id.slice(-2)}`,
    timestamp: new Date(timestamp),
    post_id: post.id,
  });
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  realtimeService.reset();
  await UserComment.destroy({ where: {}, truncate: true });
  await Comment.destroy({ where: {}, truncate: true });
  await UserPost.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('comment service cung cấp API đọc comments', () => {
  expect(typeof commentService.listCommentsByUserPost).toBe('function');
  expect(typeof commentService.listAllUserComments).toBe('function');
});

test('GET /me/posts/:userPostId/comments trả comments của một bài theo timestamp mới nhất trước và status riêng của user', async () => {
  const { user, token } = await loginUser('comment_owner');
  const { post, userPost } = await createTrackedPost(user, 'fb_post_1', 'Bài 1');
  await userPost.update({ original_link: 'https://www.facebook.com/reel/fb_post_1' });

  await createComment(post, 'old_comment', '2026-05-14T09:00:00.000Z');
  const newComment = await createComment(post, 'new_comment', '2026-05-14T10:00:00.000Z');
  await UserComment.create({ user_id: user.id, comment_id: newComment.id, status: 'is_calling' });

  const response = await request(app)
    .get(`/me/posts/${userPost.id}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.comments).toHaveLength(2);
  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['new_comment', 'old_comment']);
  expect(response.body.data.comments[0]).toMatchObject({
    id: 'new_comment',
    post_title: 'Bài 1',
    post_original_link: 'https://www.facebook.com/reel/fb_post_1',
    status: 'is_calling',
  });
  expect(response.body.data.comments[0].user_post_id).toBeUndefined();
  expect(response.body.data.comments[0].is_calling).toBeUndefined();
  expect(response.body.data.comments[1]).toMatchObject({
    id: 'old_comment',
    status: 'normal',
  });
});

test('GET /me/posts/:userPostId/comments phân trang comments của một bài', async () => {
  const { user, token } = await loginUser('comment_paged_owner');
  const { post, userPost } = await createTrackedPost(user, 'fb_post_paged', 'Bài phân trang');

  await createComment(post, 'comment_1', '2026-05-14T08:00:00.000Z');
  await createComment(post, 'comment_2', '2026-05-14T09:00:00.000Z');
  await createComment(post, 'comment_3', '2026-05-14T10:00:00.000Z');

  const response = await request(app)
    .get(`/me/posts/${userPost.id}/comments?page=1&limit=2`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['comment_3', 'comment_2']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 2,
    total: 3,
    total_pages: 2,
  });
});

test('GET /me/posts/:userPostId/comments từ chối page hoặc limit không hợp lệ', async () => {
  const { user, token } = await loginUser('comment_invalid_page_owner');
  const { userPost } = await createTrackedPost(user, 'fb_post_invalid_page', 'Bài invalid page');

  const response = await request(app)
    .get(`/me/posts/${userPost.id}/comments?page=0&limit=2`)
    .set('Authorization', `Bearer ${token}`)
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số phân trang không hợp lệ',
  });
});

test('GET /me/posts/:userPostId/comments không cho xem bài của user khác', async () => {
  const { user: owner } = await loginUser('owner');
  const { token: otherToken } = await loginUser('other');
  const { post, userPost } = await createTrackedPost(owner, 'fb_private', 'Bài riêng');
  await createComment(post, 'private_comment', '2026-05-14T10:00:00.000Z');

  await request(app)
    .get(`/me/posts/${userPost.id}/comments`)
    .set('Authorization', `Bearer ${otherToken}`)
    .expect(404);
});

test('GET /me/comments trả tất cả comments thuộc các bài user theo dõi, sort timestamp mới nhất trước', async () => {
  const { user, token } = await loginUser('all_comments_owner');
  const { user: otherUser } = await loginUser('all_comments_other');

  const { post: firstPost, userPost: firstUserPost } = await createTrackedPost(user, 'fb_all_1', 'Bài 1');
  const { post: secondPost, userPost: secondUserPost } = await createTrackedPost(user, 'fb_all_2', 'Bài 2');
  await firstUserPost.update({ original_link: 'https://www.facebook.com/reel/fb_all_1' });
  await secondUserPost.update({ original_link: 'https://www.facebook.com/reel/fb_all_2' });
  const { post: otherPost } = await createTrackedPost(otherUser, 'fb_other', 'Bài người khác');

  const oldest = await createComment(firstPost, 'oldest', '2026-05-14T08:00:00.000Z');
  await createComment(otherPost, 'hidden', '2026-05-14T11:00:00.000Z');
  const newest = await createComment(secondPost, 'newest', '2026-05-14T12:00:00.000Z');

  await UserComment.create({ user_id: user.id, comment_id: oldest.id, status: 'success' });
  await UserComment.create({ user_id: user.id, comment_id: newest.id, status: 'fail' });

  const response = await request(app)
    .get('/me/comments')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['newest', 'oldest']);
  expect(response.body.data.comments[0]).toMatchObject({
    id: 'newest',
    post_title: 'Bài 2',
    post_original_link: 'https://www.facebook.com/reel/fb_all_2',
    status: 'fail',
  });
  expect(response.body.data.comments[1]).toMatchObject({
    id: 'oldest',
    post_title: 'Bài 1',
    post_original_link: 'https://www.facebook.com/reel/fb_all_1',
    status: 'success',
  });
  expect(response.body.data.comments[0].user_post_id).toBeUndefined();
  expect(response.body.data.comments[1].user_post_id).toBeUndefined();
});

test('GET /me/comments phân trang tất cả comments của user', async () => {
  const { user, token } = await loginUser('all_comments_paged_owner');
  const { user: otherUser } = await loginUser('all_comments_paged_other');

  const { post: firstPost } = await createTrackedPost(user, 'fb_paged_1', 'Bài 1');
  const { post: secondPost } = await createTrackedPost(user, 'fb_paged_2', 'Bài 2');
  const { post: otherPost } = await createTrackedPost(otherUser, 'fb_paged_other', 'Bài khác');

  await createComment(firstPost, 'paged_1', '2026-05-14T08:00:00.000Z');
  await createComment(secondPost, 'paged_2', '2026-05-14T09:00:00.000Z');
  await createComment(secondPost, 'paged_3', '2026-05-14T10:00:00.000Z');
  await createComment(otherPost, 'hidden_paged', '2026-05-14T11:00:00.000Z');

  const response = await request(app)
    .get('/me/comments?page=1&limit=2')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['paged_3', 'paged_2']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 2,
    total: 3,
    total_pages: 2,
  });
});

test('GET /me/comments từ chối page hoặc limit không hợp lệ', async () => {
  const { token } = await loginUser('all_comments_invalid_page');

  const response = await request(app)
    .get('/me/comments?page=1&limit=-1')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số phân trang không hợp lệ',
  });
});

test('GET /me/comments search theo phone của comments user đang theo dõi', async () => {
  const { user, token } = await loginUser('comments_phone_search_owner');
  const { user: otherUser } = await loginUser('comments_phone_search_other');

  const { post: firstPost } = await createTrackedPost(user, 'fb_phone_search_1', 'Bài 1');
  const { post: secondPost } = await createTrackedPost(user, 'fb_phone_search_2', 'Bài 2');
  const { post: otherPost } = await createTrackedPost(otherUser, 'fb_phone_search_other', 'Bài người khác');

  await createComment(firstPost, 'phone_match_old', '2026-05-14T08:00:00.000Z');
  await Comment.update({ phone: '0912345678' }, { where: { id: 'phone_match_old' } });
  await createComment(secondPost, 'phone_match_new', '2026-05-14T10:00:00.000Z');
  await Comment.update({ phone: '0912349999' }, { where: { id: 'phone_match_new' } });
  await createComment(secondPost, 'phone_not_match', '2026-05-14T11:00:00.000Z');
  await Comment.update({ phone: '0988888888' }, { where: { id: 'phone_not_match' } });
  await createComment(otherPost, 'phone_hidden', '2026-05-14T12:00:00.000Z');
  await Comment.update({ phone: '0912340000' }, { where: { id: 'phone_hidden' } });

  const response = await request(app)
    .get('/me/comments?search=091234')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['phone_match_new', 'phone_match_old']);
  expect(response.body.data.comments.map((comment) => comment.phone)).toEqual(['0912349999', '0912345678']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 20,
    total: 2,
    total_pages: 1,
  });
});

test('GET /me/comments/count-today đếm comments hôm nay của user', async () => {
  const { user, token } = await loginUser('comments_count_today_owner');
  const { user: otherUser } = await loginUser('comments_count_today_other');

  const { post: firstPost } = await createTrackedPost(user, 'fb_count_today_1', 'Bài 1');
  const { post: secondPost } = await createTrackedPost(user, 'fb_count_today_2', 'Bài 2');
  const { post: otherPost } = await createTrackedPost(otherUser, 'fb_count_today_other', 'Bài người khác');
  const now = new Date();
  const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0).toISOString();

  await createComment(firstPost, 'count_today_1', todayMorning);
  await createComment(secondPost, 'count_today_2', todayNoon);
  await createComment(secondPost, 'count_yesterday', yesterday);
  await createComment(otherPost, 'count_today_hidden', todayNoon);

  const response = await request(app)
    .get('/me/comments/count-today')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: { count: 2 },
  });
});

test('GET /me/comments/count-today đếm theo ngày Việt Nam ở biên UTC', async () => {
  jest.useFakeTimers({ now: new Date('2026-05-14T18:00:00.000Z') });

  try {
    const { user, token } = await loginUser('comments_count_today_vn_boundary');
    const { post } = await createTrackedPost(user, 'fb_count_today_vn_boundary', 'Bài biên ngày Việt Nam');

    await createComment(post, 'vn_today_early', '2026-05-14T17:30:00.000Z');
    await createComment(post, 'vn_today_later', '2026-05-15T16:59:59.000Z');
    await createComment(post, 'vn_tomorrow', '2026-05-15T17:00:00.000Z');

    const response = await request(app)
      .get('/me/comments/count-today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.count).toBe(2);
  } finally {
    jest.useRealTimers();
  }
});

test('GET /me/comments?phone=true chỉ trả comments có số điện thoại', async () => {
  const { user, token } = await loginUser('comments_phone_filter_owner');
  const { user: otherUser } = await loginUser('comments_phone_filter_other');

  const { post: firstPost } = await createTrackedPost(user, 'fb_phone_filter_1', 'Bài 1');
  const { post: secondPost } = await createTrackedPost(user, 'fb_phone_filter_2', 'Bài 2');
  const { post: otherPost } = await createTrackedPost(otherUser, 'fb_phone_filter_other', 'Bài người khác');

  await createComment(firstPost, 'phone_null', '2026-05-14T08:00:00.000Z');
  await Comment.update({ phone: null }, { where: { id: 'phone_null' } });
  await createComment(firstPost, 'phone_empty', '2026-05-14T09:00:00.000Z');
  await Comment.update({ phone: '' }, { where: { id: 'phone_empty' } });
  await createComment(secondPost, 'phone_old', '2026-05-14T10:00:00.000Z');
  await Comment.update({ phone: '0911111111' }, { where: { id: 'phone_old' } });
  await createComment(secondPost, 'phone_new', '2026-05-14T11:00:00.000Z');
  await Comment.update({ phone: '0922222222' }, { where: { id: 'phone_new' } });
  await createComment(otherPost, 'phone_hidden', '2026-05-14T12:00:00.000Z');
  await Comment.update({ phone: '0933333333' }, { where: { id: 'phone_hidden' } });

  const response = await request(app)
    .get('/me/comments?sort=timestamp&page=1&limit=20&phone=true')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.comments.map((comment) => comment.id)).toEqual(['phone_new', 'phone_old']);
  expect(response.body.data.comments.map((comment) => comment.phone)).toEqual(['0922222222', '0911111111']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 20,
    total: 2,
    total_pages: 1,
  });
});

test('PATCH /me/comments/:commentId/status cập nhật status riêng của user và emit realtime', async () => {
  const { user, token } = await loginUser('status_owner');
  const { post, userPost } = await createTrackedPost(user, 'fb_status', 'Bài status');
  await userPost.update({ original_link: 'https://www.facebook.com/reel/fb_status' });
  const comment = await createComment(post, 'status_comment', '2026-05-14T10:00:00.000Z');

  const response = await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'is_calling' })
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      comment_id: comment.id,
      status: 'is_calling',
    },
  });

  const userComment = await UserComment.findOne({ where: { user_id: user.id, comment_id: comment.id } });
  expect(userComment.status).toBe('is_calling');
  expect(realtimeService.drainEvents()).toEqual([
    {
      room: `user:${user.id}`,
      event: 'comment.status_updated',
      payload: {
        comment: {
          id: comment.id,
          user_post_id: userPost.id,
          post_title: 'Bài status',
          post_original_link: 'https://www.facebook.com/reel/fb_status',
          status: 'is_calling',
        },
      },
    },
  ]);
});

test('PATCH /me/comments/:commentId/status không cho cập nhật comment của user khác', async () => {
  const { user: owner } = await loginUser('status_private_owner');
  const { token: otherToken } = await loginUser('status_private_other');
  const { post } = await createTrackedPost(owner, 'fb_status_private', 'Bài riêng');
  const comment = await createComment(post, 'status_private_comment', '2026-05-14T10:00:00.000Z');

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ status: 'success' })
    .expect(404);

  const userComment = await UserComment.findOne({ where: { comment_id: comment.id } });
  expect(userComment).toBeNull();
  expect(realtimeService.drainEvents()).toEqual([]);
});

test('PATCH /me/comments/:commentId/status từ chối status không hợp lệ', async () => {
  const { user, token } = await loginUser('status_invalid_owner');
  const { post } = await createTrackedPost(user, 'fb_status_invalid', 'Bài invalid');
  const comment = await createComment(post, 'status_invalid_comment', '2026-05-14T10:00:00.000Z');

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'unknown' })
    .expect(400);

  const userComment = await UserComment.findOne({ where: { user_id: user.id, comment_id: comment.id } });
  expect(userComment).toBeNull();
  expect(realtimeService.drainEvents()).toEqual([]);
});
