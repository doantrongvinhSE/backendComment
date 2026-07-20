const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
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

async function createTrackedComment(user, commentId = 'fb_comment_1') {
  const post = await Post.create({ fb_post_id: `fb_post_${commentId}` });
  const userPost = await UserPost.create({
    user_id: user.id,
    post_id: post.id,
    title: 'Bài livestream áo thun',
    original_link: 'https://www.facebook.com/reel/123456789',
  });
  const comment = await Comment.create({
    id: commentId,
    uid: 'uid_1',
    fb_name: 'Nguyen Van A',
    avatar_user: null,
    content: 'chốt 1 đơn',
    phone: '0987654321',
    timestamp: new Date(),
    post_id: post.id,
  });

  return { post, userPost, comment };
}

function orderInfoPayload(overrides = {}) {
  return {
    customer_name: 'Nguyễn Văn A',
    phone: '0900000000',
    address: 'Hà Nội',
    cod: 150000,
    note: 'Giao buổi sáng',
    ...overrides,
  };
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

test('PATCH status kèm order_info lưu thông tin đơn vào user_comments và emit realtime', async () => {
  const { user, token } = await loginUser();
  const { userPost, comment } = await createTrackedComment(user);

  const response = await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'success', order_info: orderInfoPayload() })
    .expect(200);

  expect(response.body.data).toEqual({
    comment_id: comment.id,
    status: 'success',
    order_info: {
      customer_name: 'Nguyễn Văn A',
      phone: '0900000000',
      address: 'Hà Nội',
      cod: 150000,
      note: 'Giao buổi sáng',
    },
  });

  const userComment = await UserComment.findOne({ where: { user_id: user.id, comment_id: comment.id } });
  expect(userComment).toMatchObject({
    status: 'success',
    order_customer_name: 'Nguyễn Văn A',
    order_phone: '0900000000',
    order_address: 'Hà Nội',
    order_cod: 150000,
    order_note: 'Giao buổi sáng',
  });

  const events = realtimeService.drainEvents();
  const statusEvent = events.find((event) => event.event === 'comment.status_updated');
  expect(statusEvent.payload.comment).toMatchObject({
    id: comment.id,
    user_post_id: userPost.id,
    status: 'success',
    order_info: { customer_name: 'Nguyễn Văn A', cod: 150000 },
  });
});

test('list comments trả về order_info sau khi lưu', async () => {
  const { user, token } = await loginUser();
  const { userPost, comment } = await createTrackedComment(user);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'success', order_info: orderInfoPayload() })
    .expect(200);

  const byPostResponse = await request(app)
    .get(`/me/posts/${userPost.id}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(byPostResponse.body.data.comments[0]).toMatchObject({
    id: comment.id,
    status: 'success',
    order_info: {
      customer_name: 'Nguyễn Văn A',
      phone: '0900000000',
      address: 'Hà Nội',
      cod: 150000,
      note: 'Giao buổi sáng',
    },
  });

  const allResponse = await request(app)
    .get('/me/comments')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(allResponse.body.data.comments[0]).toMatchObject({
    id: comment.id,
    status: 'success',
    order_info: { customer_name: 'Nguyễn Văn A', cod: 150000 },
  });
});

test('comment chưa chốt đơn trả order_info null', async () => {
  const { user, token } = await loginUser();
  const { userPost, comment } = await createTrackedComment(user);

  const response = await request(app)
    .get(`/me/posts/${userPost.id}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.comments[0]).toMatchObject({
    id: comment.id,
    status: 'normal',
    order_info: null,
  });
});

test('đổi status không gửi order_info thì giữ nguyên thông tin đơn đã lưu', async () => {
  const { user, token } = await loginUser();
  const { comment } = await createTrackedComment(user);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'success', order_info: orderInfoPayload() })
    .expect(200);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'is_calling' })
    .expect(200);

  const userComment = await UserComment.findOne({ where: { user_id: user.id, comment_id: comment.id } });
  expect(userComment.status).toBe('is_calling');
  expect(userComment.order_customer_name).toBe('Nguyễn Văn A');
  expect(userComment.order_cod).toBe(150000);
});

test('gửi order_info lần 2 thì cập nhật đè thông tin mới', async () => {
  const { user, token } = await loginUser();
  const { comment } = await createTrackedComment(user);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'success', order_info: orderInfoPayload() })
    .expect(200);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status: 'success',
      order_info: orderInfoPayload({ customer_name: 'Trần Thị B', cod: 200000, note: 'Đơn thứ hai' }),
    })
    .expect(200);

  const userComment = await UserComment.findOne({ where: { user_id: user.id, comment_id: comment.id } });
  expect(userComment).toMatchObject({
    order_customer_name: 'Trần Thị B',
    order_cod: 200000,
    order_note: 'Đơn thứ hai',
  });
  expect(await UserComment.count()).toBe(1);
});

test('order_info không phải object thì 400', async () => {
  const { user, token } = await loginUser();
  const { comment } = await createTrackedComment(user);

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'success', order_info: 'abc' })
    .expect(400);

  expect(await UserComment.count()).toBe(0);
});

test('không cập nhật được comment của user khác', async () => {
  const { user: owner } = await loginUser('owner');
  const { comment } = await createTrackedComment(owner);
  const { token: otherToken } = await loginUser('other');

  await request(app)
    .patch(`/me/comments/${comment.id}/status`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ status: 'success', order_info: orderInfoPayload() })
    .expect(404);
});
