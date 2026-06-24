const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('./app');
const { sequelize, Post, UserPost, Comment, User, UserSession } = require('./models');

async function createPublicUsers() {
  return Promise.all([
    User.create({ username: 'public_user_1', password_hash: 'hash', name: 'Public User 1', role: 'USER' }),
    User.create({ username: 'public_user_2', password_hash: 'hash', name: 'Public User 2', role: 'USER' }),
    User.create({ username: 'public_user_3', password_hash: 'hash', name: 'Public User 3', role: 'USER' }),
    User.create({ username: 'public_user_4', password_hash: 'hash', name: 'Public User 4', role: 'USER' }),
  ]);
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Comment.destroy({ where: {}, truncate: true });
  await UserPost.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('GET /public/posts không cần auth và trả danh sách theo ngưỡng mặc định', async () => {
  const [user1, user2, user3, user4] = await createPublicUsers();
  const lowPost = await Post.create({ fb_post_id: 'public_low', last_count: 0, today_comment_count: 3 });
  const highPost = await Post.create({ fb_post_id: 'public_high', last_count: 0, today_comment_count: 8 });
  const mediumPost = await Post.create({ fb_post_id: 'public_medium', last_count: 0, today_comment_count: 5 });

  await UserPost.bulkCreate([
    {
      user_id: user1.id,
      post_id: highPost.id,
      title: 'Z title',
      original_link: 'https://example.com/z',
    },
    {
      user_id: user2.id,
      post_id: highPost.id,
      title: 'A title',
      original_link: 'https://example.com/a',
    },
    {
      user_id: user3.id,
      post_id: mediumPost.id,
      title: 'M title',
      original_link: 'https://example.com/m',
    },
    {
      user_id: user4.id,
      post_id: lowPost.id,
      title: 'Low title',
      original_link: 'https://example.com/low',
    },
  ]);

  const response = await request(app)
    .get('/public/posts')
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      posts: [
        {
          today_comment_count: 8,
          title: 'A title',
          original_link: 'https://example.com/a',
        },
        {
          today_comment_count: 5,
          title: 'M title',
          original_link: 'https://example.com/m',
        },
      ],
    },
  });
});

test('GET /public/posts cho phép đổi ngưỡng today_comment_count_gt', async () => {
  const [user1, user2] = await createPublicUsers();
  const fivePost = await Post.create({ fb_post_id: 'public_five', last_count: 0, today_comment_count: 5 });
  const sixPost = await Post.create({ fb_post_id: 'public_six', last_count: 0, today_comment_count: 6 });

  await UserPost.bulkCreate([
    {
      user_id: user1.id,
      post_id: fivePost.id,
      title: 'Five title',
      original_link: 'https://example.com/five',
    },
    {
      user_id: user2.id,
      post_id: sixPost.id,
      title: 'Six title',
      original_link: 'https://example.com/six',
    },
  ]);

  const response = await request(app)
    .get('/public/posts?today_comment_count_gt=5')
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      posts: [
        {
          today_comment_count: 6,
          title: 'Six title',
          original_link: 'https://example.com/six',
        },
      ],
    },
  });
});

test('GET /public/posts từ chối ngưỡng không hợp lệ', async () => {
  const response = await request(app)
    .get('/public/posts?today_comment_count_gt=abc')
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số lọc không hợp lệ',
  });
});
