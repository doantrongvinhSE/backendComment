const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const postService = require('./services/postService');
const realtimeService = require('./services/realtimeService');
const { sequelize, User, UserSession, Post, UserPost, Comment } = require('./models');

async function loginUser(username = 'user1') {
  await User.create({
    username,
    password_hash: await bcrypt.hash('password123', 10),
    name: username,
    role: 'USER',
  });

  const response = await request(app)
    .post('/auth/login')
    .send({ username, password: 'password123' })
    .expect(200);

  return response.body.data.token;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  realtimeService.reset();
  await Comment.destroy({ where: {}, truncate: true });
  await UserPost.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('post service cung cấp CRUD user posts và extractPostId', () => {
  expect(typeof postService.extractPostId).toBe('function');
  expect(typeof postService.createUserPost).toBe('function');
  expect(typeof postService.listUserPosts).toBe('function');
  expect(typeof postService.getUserPost).toBe('function');
  expect(typeof postService.updateUserPost).toBe('function');
  expect(typeof postService.deleteUserPost).toBe('function');
});

test('user tạo post từ link video, backend tự tạo posts gốc và user_posts rồi emit realtime', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Bài video',
      originalLink: 'https://www.facebook.com/page/videos/123456789',
    })
    .expect(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toMatchObject({
    title: 'Bài video',
    original_link: 'https://www.facebook.com/page/videos/123456789',
    today_comment_count: 0,
  });
  expect(response.body.data.last_count).toBeUndefined();
  expect(response.body.data.post_id).toBeUndefined();

  const post = await Post.findOne({ where: { fb_post_id: '123456789' } });
  expect(post).toBeTruthy();

  const userPost = await UserPost.findOne({ where: { post_id: post.id } });
  expect(userPost.title).toBe('Bài video');

  const user = await User.findOne({ where: { username: 'user1' } });
  expect(realtimeService.drainEvents()).toEqual([
    {
      room: `user:${user.id}`,
      event: 'post.created',
      payload: {
        post: expect.objectContaining({
          id: response.body.data.id,
          title: 'Bài video',
          original_link: 'https://www.facebook.com/page/videos/123456789',
          today_comment_count: 0,
          phone_today: 0,
        }),
      },
    },
  ]);
});

test('user tạo post thiếu title thì trả 400 và không tạo dữ liệu', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ originalLink: 'https://www.facebook.com/page/videos/123456789' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tên bài viết là bắt buộc',
  });
  expect(await Post.count()).toBe(0);
  expect(await UserPost.count()).toBe(0);
});

test('user tạo post title rỗng thì trả 400 và không tạo dữ liệu', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '   ', originalLink: 'https://www.facebook.com/page/videos/123456789' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tên bài viết là bắt buộc',
  });
  expect(await Post.count()).toBe(0);
  expect(await UserPost.count()).toBe(0);
});

test('user tạo post thiếu originalLink thì trả 400 và không tạo dữ liệu', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài thiếu link' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link Facebook là bắt buộc',
  });
  expect(await Post.count()).toBe(0);
  expect(await UserPost.count()).toBe(0);
});

test('user tạo post originalLink rỗng thì trả 400 và không tạo dữ liệu', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài link rỗng', originalLink: '   ' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link Facebook là bắt buộc',
  });
  expect(await Post.count()).toBe(0);
  expect(await UserPost.count()).toBe(0);
});

test('user tạo post với link không hỗ trợ thì trả 400 và không tạo dữ liệu', async () => {
  const token = await loginUser();

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Bài lỗi',
      originalLink: 'https://www.facebook.com/posts/no-supported-id',
    })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link Facebook không hợp lệ. Chỉ hỗ trợ link video, reel hoặc fb.watch.',
  });
  expect(await Post.count()).toBe(0);
  expect(await UserPost.count()).toBe(0);
});

test('user tạo post trùng link đã có thì trả 400', async () => {
  const token = await loginUser('duplicate_owner');

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài đầu', originalLink: 'https://www.facebook.com/reel/222333444' })
    .expect(201);

  const response = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài trùng', originalLink: 'https://www.facebook.com/reel/222333444' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link bài viết đã tồn tại',
  });
  expect(await Post.count({ where: { fb_post_id: '222333444' } })).toBe(1);
  expect(await UserPost.count()).toBe(1);
});

test('nhiều user thêm cùng fb_post_id thì dùng chung posts gốc và có user_posts riêng', async () => {
  const firstToken = await loginUser('user1');
  const secondToken = await loginUser('user2');

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ title: 'User 1', originalLink: 'https://www.facebook.com/reel/222333444' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${secondToken}`)
    .send({ title: 'User 2', originalLink: 'https://www.facebook.com/reel/222333444' })
    .expect(201);

  expect(await Post.count({ where: { fb_post_id: '222333444' } })).toBe(1);
  expect(await UserPost.count()).toBe(2);
});

test('user quản lý CRUD bài viết của chính mình', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Tiêu đề cũ', originalLink: 'https://example.com/watch?v=555666777' })
    .expect(201);

  const userPostId = createResponse.body.data.id;

  const listResponse = await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(listResponse.body.data.posts).toHaveLength(1);
  expect(listResponse.body.data.posts[0]).toMatchObject({ id: userPostId, title: 'Tiêu đề cũ' });
  expect(listResponse.body.data.posts[0].last_count).toBeUndefined();

  const detailResponse = await request(app)
    .get(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(detailResponse.body.data).toMatchObject({ id: userPostId, title: 'Tiêu đề cũ' });
  expect(detailResponse.body.data.last_count).toBeUndefined();

  realtimeService.drainEvents();

  const updateResponse = await request(app)
    .patch(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Tiêu đề mới', originalLink: 'https://example.com/watch?v=555666777&ref=share' })
    .expect(200);

  expect(updateResponse.body.data).toMatchObject({
    id: userPostId,
    title: 'Tiêu đề mới',
    original_link: 'https://example.com/watch?v=555666777&ref=share',
    phone_today: 0,
  });
  expect(updateResponse.body.data.last_count).toBeUndefined();

  expect(realtimeService.drainEvents()).toEqual([
    {
      room: expect.any(String),
      event: 'post.updated',
      payload: {
        post: expect.objectContaining({
          id: updateResponse.body.data.id,
          title: 'Tiêu đề mới',
          original_link: 'https://example.com/watch?v=555666777&ref=share',
          today_comment_count: 0,
          phone_today: 0,
        }),
      },
    },
  ]);

  await request(app)
    .delete(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(realtimeService.drainEvents()).toEqual([
    {
      room: expect.any(String),
      event: 'post.deleted',
      payload: { post: { id: userPostId } },
    },
  ]);

  expect(await UserPost.count()).toBe(0);
  expect(await Post.count()).toBe(0);
});

test('user không được xem sửa xóa user_posts của user khác', async () => {
  const firstToken = await loginUser('user1');
  const secondToken = await loginUser('user2');

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ title: 'User 1 post', originalLink: 'https://fb.watch/path/999888777' })
    .expect(201);

  const userPostId = createResponse.body.data.id;

  await request(app)
    .get(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${secondToken}`)
    .expect(404);

  await request(app)
    .patch(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${secondToken}`)
    .send({ title: 'Hack' })
    .expect(404);

  await request(app)
    .delete(`/me/posts/${userPostId}`)
    .set('Authorization', `Bearer ${secondToken}`)
    .expect(404);

  expect(await UserPost.count()).toBe(1);
  expect(await Post.count()).toBe(1);
});

test('PATCH /me/posts/:userPostId đổi originalLink sang post gốc mới nếu chưa có', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/111111111' })
    .expect(201);

  const oldPost = await Post.findOne({ where: { fb_post_id: '111111111' } });

  const updateResponse = await request(app)
    .patch(`/me/posts/${createResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ originalLink: 'https://www.facebook.com/page/videos/222222222' })
    .expect(200);

  expect(updateResponse.body.data).toMatchObject({
    id: createResponse.body.data.id,
    original_link: 'https://www.facebook.com/page/videos/222222222',
  });
  expect(updateResponse.body.data.post_id).toBeUndefined();

  const newPost = await Post.findOne({ where: { fb_post_id: '222222222' } });
  const userPost = await UserPost.findByPk(createResponse.body.data.id);

  expect(newPost).not.toBeNull();
  expect(userPost.post_id).toBe(newPost.id);
  expect(userPost.post_id).not.toBe(oldPost.id);
});

test('PATCH /me/posts/:userPostId xóa post gốc cũ khi không còn user nào theo dõi', async () => {
  const token = await loginUser('patch_cleanup_orphan_post');

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/222222223' })
    .expect(201);

  await request(app)
    .patch(`/me/posts/${createResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ originalLink: 'https://www.facebook.com/reel/222222224' })
    .expect(200);

  expect(await Post.findOne({ where: { fb_post_id: '222222223' } })).toBeNull();
  expect(await Post.findOne({ where: { fb_post_id: '222222224' } })).not.toBeNull();
});

test('PATCH /me/posts/:userPostId giữ post gốc cũ nếu còn user khác theo dõi', async () => {
  const firstToken = await loginUser('patch_keep_shared_post_1');
  const secondToken = await loginUser('patch_keep_shared_post_2');

  const firstResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ title: 'Post user 1', originalLink: 'https://www.facebook.com/reel/222222225' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${secondToken}`)
    .send({ title: 'Post user 2', originalLink: 'https://www.facebook.com/reel/222222225' })
    .expect(201);

  await request(app)
    .patch(`/me/posts/${firstResponse.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ originalLink: 'https://www.facebook.com/reel/222222226' })
    .expect(200);

  expect(await Post.findOne({ where: { fb_post_id: '222222225' } })).not.toBeNull();
  expect(await Post.findOne({ where: { fb_post_id: '222222226' } })).not.toBeNull();
});

test('PATCH /me/posts/:userPostId đổi originalLink sang post gốc đã có thì không tạo duplicate posts', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/333333333' })
    .expect(201);

  const existingPost = await Post.create({ fb_post_id: '444444444', last_count: 9 });

  await request(app)
    .patch(`/me/posts/${createResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ originalLink: 'https://example.com/watch?v=444444444' })
    .expect(200);

  const userPost = await UserPost.findByPk(createResponse.body.data.id);

  expect(userPost.post_id).toBe(existingPost.id);
  expect(await Post.count({ where: { fb_post_id: '444444444' } })).toBe(1);
});

test('PATCH /me/posts/:userPostId từ chối originalLink không hợp lệ và giữ dữ liệu cũ', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/555555555' })
    .expect(201);

  const userPostBefore = await UserPost.findByPk(createResponse.body.data.id);

  const response = await request(app)
    .patch(`/me/posts/${createResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ originalLink: 'https://www.facebook.com/posts/not-supported' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link Facebook không hợp lệ. Chỉ hỗ trợ link video, reel hoặc fb.watch.',
  });

  const userPostAfter = await UserPost.findByPk(createResponse.body.data.id);

  expect(userPostAfter.post_id).toBe(userPostBefore.post_id);
  expect(userPostAfter.original_link).toBe('https://www.facebook.com/reel/555555555');
});

test('PATCH /me/posts/:userPostId từ chối original_link không hợp lệ từ frontend và giữ dữ liệu cũ', async () => {
  const token = await loginUser('patch_snake_invalid_link');

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/555555556' })
    .expect(201);

  const userPostBefore = await UserPost.findByPk(createResponse.body.data.id);

  const response = await request(app)
    .patch(`/me/posts/${createResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ original_link: 'https://www.facebook.com/posts/not-supported' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link Facebook không hợp lệ. Chỉ hỗ trợ link video, reel hoặc fb.watch.',
  });

  const userPostAfter = await UserPost.findByPk(createResponse.body.data.id);

  expect(userPostAfter.post_id).toBe(userPostBefore.post_id);
  expect(userPostAfter.original_link).toBe('https://www.facebook.com/reel/555555556');
});

test('PATCH /me/posts/:userPostId từ chối đổi sang link user đã theo dõi', async () => {
  const token = await loginUser('patch_duplicate_link');

  const firstResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post 1', originalLink: 'https://www.facebook.com/reel/555555557' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post 2', originalLink: 'https://www.facebook.com/reel/555555558' })
    .expect(201);

  const userPostBefore = await UserPost.findByPk(firstResponse.body.data.id);

  const response = await request(app)
    .patch(`/me/posts/${firstResponse.body.data.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ original_link: 'https://www.facebook.com/reel/555555558' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Link bài viết đã tồn tại',
  });

  const userPostAfter = await UserPost.findByPk(firstResponse.body.data.id);

  expect(userPostAfter.post_id).toBe(userPostBefore.post_id);
  expect(userPostAfter.original_link).toBe('https://www.facebook.com/reel/555555557');
});

test('GET /me/posts phân trang và trả pagination meta', async () => {
  const token = await loginUser();

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post cũ', originalLink: 'https://www.facebook.com/reel/777777771' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post giữa', originalLink: 'https://www.facebook.com/reel/777777772' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post mới', originalLink: 'https://www.facebook.com/reel/777777773' })
    .expect(201);

  const response = await request(app)
    .get('/me/posts?page=1&limit=2')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts).toHaveLength(2);
  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Post mới', 'Post giữa']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 2,
    total: 3,
    total_pages: 2,
  });
});

test('GET /me/posts từ chối page hoặc limit không hợp lệ', async () => {
  const token = await loginUser();

  const response = await request(app)
    .get('/me/posts?page=abc&limit=2')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số phân trang không hợp lệ',
  });
});

test('GET /me/posts title_search chỉ tìm theo title', async () => {
  const token = await loginUser();

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Livestream áo nữ', originalLink: 'https://www.facebook.com/reel/888888881' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài khác', originalLink: 'https://www.facebook.com/reel/888888882?ref=ao-nu' })
    .expect(201);

  const response = await request(app)
    .get('/me/posts?title_search=áo nữ')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Livestream áo nữ']);
  expect(response.body.pagination.total).toBe(1);
});

test('GET /me/posts search tìm theo title hoặc original_link', async () => {
  const token = await loginUser();

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài search title', originalLink: 'https://www.facebook.com/reel/888888883' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bài link', originalLink: 'https://www.facebook.com/reel/888888884?campaign=search-combo' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Không khớp', originalLink: 'https://www.facebook.com/reel/888888885' })
    .expect(201);

  const response = await request(app)
    .get('/me/posts?search=search')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Bài link', 'Bài search title']);
  expect(response.body.pagination.total).toBe(2);
});

test('GET /me/posts lọc theo created_from và created_to', async () => {
  const token = await loginUser();

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Ngoài khoảng', originalLink: 'https://www.facebook.com/reel/888888886' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Trong khoảng', originalLink: 'https://www.facebook.com/reel/888888887' })
    .expect(201);

  const outPost = await UserPost.findOne({ where: { title: 'Ngoài khoảng' } });
  const inPost = await UserPost.findOne({ where: { title: 'Trong khoảng' } });

  await outPost.update({ created_at: new Date('2026-05-10T10:00:00.000Z') });
  await inPost.update({ created_at: new Date('2026-05-12T10:00:00.000Z') });

  const response = await request(app)
    .get('/me/posts?created_from=2026-05-12T00:00:00.000Z&created_to=2026-05-12T23:59:59.999Z')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Trong khoảng']);
  expect(response.body.pagination.total).toBe(1);
});

test('GET /me/posts sort theo created_at, updated_at và title', async () => {
  const token = await loginUser();

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'B title', originalLink: 'https://www.facebook.com/reel/888888888' })
    .expect(201);

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'A title', originalLink: 'https://www.facebook.com/reel/888888889' })
    .expect(201);

  const firstPost = await UserPost.findOne({ where: { title: 'B title' } });
  const secondPost = await UserPost.findOne({ where: { title: 'A title' } });

  await firstPost.update({
    created_at: new Date('2026-05-10T10:00:00.000Z'),
    updated_at: new Date('2026-05-13T10:00:00.000Z'),
  });
  await secondPost.update({
    created_at: new Date('2026-05-12T10:00:00.000Z'),
    updated_at: new Date('2026-05-11T10:00:00.000Z'),
  });

  const createdResponse = await request(app)
    .get('/me/posts?sort_by=created_at&sort_order=asc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(createdResponse.body.data.posts.map((post) => post.title)).toEqual(['B title', 'A title']);

  const updatedResponse = await request(app)
    .get('/me/posts?sort_by=updated_at&sort_order=desc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(updatedResponse.body.data.posts.map((post) => post.title)).toEqual(['B title', 'A title']);

  const titleResponse = await request(app)
    .get('/me/posts?sort_by=title&sort_order=asc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(titleResponse.body.data.posts.map((post) => post.title)).toEqual(['A title', 'B title']);
});

test('GET /me/posts sort theo today_comment_count', async () => {
  const token = await loginUser();

  const lowResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Ít comment', originalLink: 'https://www.facebook.com/reel/888888890' })
    .expect(201);

  const highResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Nhiều comment', originalLink: 'https://www.facebook.com/reel/888888891' })
    .expect(201);

  const lowPost = await UserPost.findByPk(lowResponse.body.data.id);
  const highPost = await UserPost.findByPk(highResponse.body.data.id);
  const now = new Date();

  await Comment.bulkCreate([
    { id: 'low_count_1', uid: 'uid_low_1', timestamp: now, post_id: lowPost.post_id },
    { id: 'high_count_1', uid: 'uid_high_1', timestamp: now, post_id: highPost.post_id },
    { id: 'high_count_2', uid: 'uid_high_2', timestamp: now, post_id: highPost.post_id },
  ]);

  const response = await request(app)
    .get('/me/posts?sort_by=today_comment_count&sort_order=desc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Nhiều comment', 'Ít comment']);
  expect(response.body.data.posts.map((post) => post.today_comment_count)).toEqual([2, 1]);
});

test('GET /me/posts từ chối query filter hoặc sort không hợp lệ', async () => {
  const token = await loginUser();

  const response = await request(app)
    .get('/me/posts?created_from=invalid-date')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số lọc không hợp lệ',
  });

  await request(app)
    .get('/me/posts?sort_by=unknown')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);
});

test('GET /me/posts tính today_comment_count theo comments trong ngày hiện tại', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post có comment', originalLink: 'https://www.facebook.com/reel/666666666' })
    .expect(201);

  const userPost = await UserPost.findByPk(createResponse.body.data.id);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await Comment.bulkCreate([
    {
      id: 'today_comment_1',
      uid: 'uid_1',
      timestamp: today,
      post_id: userPost.post_id,
    },
    {
      id: 'today_comment_2',
      uid: 'uid_2',
      timestamp: today,
      post_id: userPost.post_id,
    },
    {
      id: 'old_comment',
      uid: 'uid_3',
      timestamp: yesterday,
      post_id: userPost.post_id,
    },
  ]);

  const response = await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts[0]).toMatchObject({
    id: userPost.id,
    today_comment_count: 2,
  });
});

test('GET /me/posts tính phone_today theo comments hôm nay có phone', async () => {
  const token = await loginUser();

  const createResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Post có phone', originalLink: 'https://www.facebook.com/reel/777777777' })
    .expect(201);

  const userPost = await UserPost.findByPk(createResponse.body.data.id);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await Comment.bulkCreate([
    { id: 'phone_today_1', uid: 'uid_phone_1', timestamp: today, post_id: userPost.post_id, phone: '0900000001' },
    { id: 'phone_today_2', uid: 'uid_phone_2', timestamp: today, post_id: userPost.post_id, phone: null },
    { id: 'phone_today_3', uid: 'uid_phone_3', timestamp: today, post_id: userPost.post_id, phone: '' },
    { id: 'phone_today_4', uid: 'uid_phone_4', timestamp: today, post_id: userPost.post_id, phone: '   ' },
    { id: 'phone_yesterday', uid: 'uid_phone_5', timestamp: yesterday, post_id: userPost.post_id, phone: '0900000002' },
  ]);

  const response = await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts[0]).toMatchObject({
    id: userPost.id,
    phone_today: 1,
  });
});

test('GET /me/posts sort theo phone_today', async () => {
  const token = await loginUser();

  const lowResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Ít phone', originalLink: 'https://www.facebook.com/reel/777777778' })
    .expect(201);

  const highResponse = await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Nhiều phone', originalLink: 'https://www.facebook.com/reel/777777779' })
    .expect(201);

  const lowPost = await UserPost.findByPk(lowResponse.body.data.id);
  const highPost = await UserPost.findByPk(highResponse.body.data.id);
  const now = new Date();

  await Comment.bulkCreate([
    { id: 'low_phone_1', uid: 'uid_low_phone_1', timestamp: now, post_id: lowPost.post_id, phone: '0900000001' },
    { id: 'high_phone_1', uid: 'uid_high_phone_1', timestamp: now, post_id: highPost.post_id, phone: '0900000002' },
    { id: 'high_phone_2', uid: 'uid_high_phone_2', timestamp: now, post_id: highPost.post_id, phone: '0900000003' },
  ]);

  const response = await request(app)
    .get('/me/posts?sort_by=phone_today&sort_order=desc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.posts.map((post) => post.title)).toEqual(['Nhiều phone', 'Ít phone']);
  expect(response.body.data.posts.map((post) => post.phone_today)).toEqual([2, 1]);
});
