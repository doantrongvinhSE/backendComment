const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('./app');
const ingestService = require('./services/ingestService');
const realtimeService = require('./services/realtimeService');
const { sequelize, Post, Comment, User, UserPost } = require('./models');

function ingestPayload(overrides = {}) {
  return {
    fb_post_id: 'fb_ingest_1',
    last_count: 100,
    comments: [
      {
        id: 'comment_1',
        uid: 'uid_1',
        fb_name: 'Khách 1',
        avatar_user: 'https://example.com/avatar1.jpg',
        content: 'chốt 1 đơn',
        phone: '0900000001',
        timestamp: '2026-05-14T10:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  realtimeService.reset();
  await Comment.destroy({ where: {}, truncate: true });
  await UserPost.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('ingest service cung cấp API bulk comments và posts cho crawler', () => {
  expect(typeof ingestService.ingestCommentsBulk).toBe('function');
  expect(typeof ingestService.listPostsForIngest).toBe('function');
  expect(typeof ingestService.updatePostLastCount).toBe('function');
});

test('POST /ingest/comments/bulk trả 404 nếu post gốc chưa tồn tại', async () => {
  const response = await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload())
    .expect(404);

  expect(response.body).toEqual({
    success: false,
    message: 'Post không tồn tại',
  });
  expect(await Post.findOne({ where: { fb_post_id: 'fb_ingest_1' } })).toBeNull();
  expect(await Comment.findByPk('comment_1')).toBeNull();
  expect(realtimeService.drainEvents()).toEqual([]);
});

test('POST /ingest/comments/bulk dùng post có sẵn và chỉ tạo comments mới', async () => {
  const post = await Post.create({ fb_post_id: 'fb_ingest_existing', last_count: 5 });

  const response = await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({ fb_post_id: 'fb_ingest_existing', last_count: 7 }))
    .expect(200);

  expect(response.body.data).toMatchObject({
    post_id: post.id,
    received_count: 1,
    created_count: 1,
  });
  expect(response.body.data.skipped_count).toBeUndefined();

  await post.reload();
  expect(post.last_count).toBe(5);
});

test('POST /ingest/comments/bulk emit realtime comment.created theo từng user room', async () => {
  const post = await Post.create({ fb_post_id: 'fb_realtime', last_count: 5 });
  const firstUser = await User.create({ username: 'rt_1', password_hash: 'hash', name: 'RT 1', role: 'USER' });
  const secondUser = await User.create({ username: 'rt_2', password_hash: 'hash', name: 'RT 2', role: 'USER' });
  const firstUserPost = await UserPost.create({ user_id: firstUser.id, post_id: post.id, title: 'Bài RT 1', original_link: 'https://www.facebook.com/reel/rt1' });
  const secondUserPost = await UserPost.create({ user_id: secondUser.id, post_id: post.id, title: 'Bài RT 2', original_link: 'https://www.facebook.com/reel/rt2' });

  const timestamp = new Date();

  await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_realtime',
      comments: [
        {
          id: 'comment_1',
          uid: 'uid_1',
          fb_name: 'Khách 1',
          avatar_user: 'https://example.com/avatar1.jpg',
          content: 'chốt 1 đơn',
          phone: '0900000001',
          timestamp: timestamp.toISOString(),
        },
      ],
    }))
    .expect(200);

  const events = realtimeService.drainEvents();
  expect(events).toHaveLength(4);
  expect(events).toEqual([
    {
      room: `user:${firstUser.id}`,
      event: 'comment.created',
      payload: {
        comment: {
          id: 'comment_1',
          user_post_id: firstUserPost.id,
          post_id: post.id,
          post_title: 'Bài RT 1',
          post_original_link: 'https://www.facebook.com/reel/rt1',
          uid: 'uid_1',
          fb_name: 'Khách 1',
          avatar_user: 'https://example.com/avatar1.jpg',
          content: 'chốt 1 đơn',
          phone: '0900000001',
          timestamp,
          status: 'normal',
        },
      },
    },
    {
      room: `user:${firstUser.id}`,
      event: 'post.stats_updated',
      payload: {
        post: {
          id: firstUserPost.id,
          today_comment_count: 1,
          phone_today: 1,
          updated_at: timestamp,
        },
      },
    },
    {
      room: `user:${secondUser.id}`,
      event: 'comment.created',
      payload: {
        comment: {
          id: 'comment_1',
          user_post_id: secondUserPost.id,
          post_id: post.id,
          post_title: 'Bài RT 2',
          post_original_link: 'https://www.facebook.com/reel/rt2',
          uid: 'uid_1',
          fb_name: 'Khách 1',
          avatar_user: 'https://example.com/avatar1.jpg',
          content: 'chốt 1 đơn',
          phone: '0900000001',
          timestamp,
          status: 'normal',
        },
      },
    },
    {
      room: `user:${secondUser.id}`,
      event: 'post.stats_updated',
      payload: {
        post: {
          id: secondUserPost.id,
          today_comment_count: 1,
          phone_today: 1,
          updated_at: timestamp,
        },
      },
    },
  ]);
});

test('POST /ingest/comments/bulk chỉ cập nhật posts.updated_at theo timestamp comment mới', async () => {
  const post = await Post.create({
    fb_post_id: 'fb_updated_at_single',
    last_count: 5,
    updated_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  const user = await User.create({ username: 'updated_at_user', password_hash: 'hash', name: 'Updated At User', role: 'USER' });
  const userPost = await UserPost.create({
    user_id: user.id,
    post_id: post.id,
    title: 'Bài updated_at',
    original_link: 'https://www.facebook.com/reel/updated-at',
    updated_at: new Date('2026-05-14T08:00:00.000Z'),
  });

  await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_updated_at_single',
      comments: [
        { id: 'updated_at_single', uid: 'uid_updated_at_single', timestamp: '2026-05-14T10:00:00.000Z' },
      ],
    }))
    .expect(200);

  await post.reload();
  await userPost.reload();
  expect(post.updated_at.toISOString()).toBe('2026-05-14T10:00:00.000Z');
  expect(userPost.updated_at.toISOString()).toBe('2026-05-14T08:00:00.000Z');
});

test('POST /ingest/comments/bulk không làm lùi posts.updated_at khi comment cũ hơn', async () => {
  const post = await Post.create({
    fb_post_id: 'fb_updated_at_older',
    last_count: 5,
    updated_at: new Date('2026-05-14T12:00:00.000Z'),
  });
  const user = await User.create({ username: 'updated_at_older_user', password_hash: 'hash', name: 'Updated At Older User', role: 'USER' });
  const userPost = await UserPost.create({
    user_id: user.id,
    post_id: post.id,
    title: 'Bài updated_at cũ hơn',
    original_link: 'https://www.facebook.com/reel/updated-at-older',
    updated_at: new Date('2026-05-14T12:00:00.000Z'),
  });

  await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_updated_at_older',
      comments: [
        { id: 'updated_at_older', uid: 'uid_updated_at_older', timestamp: '2026-05-14T10:00:00.000Z' },
      ],
    }))
    .expect(200);

  await post.reload();
  await userPost.reload();
  expect(post.updated_at.toISOString()).toBe('2026-05-14T12:00:00.000Z');
  expect(userPost.updated_at.toISOString()).toBe('2026-05-14T12:00:00.000Z');
});

test('POST /ingest/comments/bulk tăng cache stats cho comment hôm nay và bỏ qua comment cũ', async () => {
  const post = await Post.create({ fb_post_id: 'fb_cache_stats', last_count: 5 });
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_cache_stats',
      comments: [
        { id: 'cache_today_phone', uid: 'uid_cache_1', phone: '0900000001', timestamp: now.toISOString() },
        { id: 'cache_today_blank', uid: 'uid_cache_2', phone: '   ', timestamp: now.toISOString() },
        { id: 'cache_old_phone', uid: 'uid_cache_3', phone: '0900000002', timestamp: yesterday.toISOString() },
      ],
    }))
    .expect(200);

  await post.reload();
  expect(post.today_comment_count).toBe(2);
  expect(post.phone_today).toBe(1);
  expect(post.stats_date).toBe(now.toISOString().slice(0, 10));
});

test('POST /ingest/comments/bulk reset cache cũ trước khi tăng comment hôm nay', async () => {
  const post = await Post.create({
    fb_post_id: 'fb_cache_reset',
    last_count: 5,
    today_comment_count: 20,
    phone_today: 8,
    stats_date: '2020-01-01',
  });
  const now = new Date();

  await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_cache_reset',
      comments: [
        { id: 'cache_reset_today', uid: 'uid_cache_reset', phone: '0900000001', timestamp: now.toISOString() },
      ],
    }))
    .expect(200);

  await post.reload();
  expect(post.today_comment_count).toBe(1);
  expect(post.phone_today).toBe(1);
  expect(post.stats_date).toBe(now.toISOString().slice(0, 10));
});

test('POST /ingest/comments/bulk trả 409 khi comment id đã tồn tại và không update fields cũ', async () => {
  const post = await Post.create({
    fb_post_id: 'fb_ingest_duplicate_existing',
    last_count: 1,
    updated_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await Comment.create({
    id: 'comment_existing',
    uid: 'uid_old',
    fb_name: 'Tên cũ',
    avatar_user: 'https://example.com/old.jpg',
    content: 'nội dung cũ',
    phone: '0900000000',
    timestamp: new Date('2026-05-14T08:00:00.000Z'),
    post_id: post.id,
  });

  const response = await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_ingest_duplicate_existing',
      last_count: 2,
      comments: [
        {
          id: 'comment_existing',
          uid: 'uid_new',
          fb_name: 'Tên mới',
          avatar_user: 'https://example.com/new.jpg',
          content: 'nội dung mới',
          phone: '0911111111',
          timestamp: '2026-05-14T12:00:00.000Z',
        },
      ],
    }))
    .expect(409);

  expect(response.body).toEqual({
    success: false,
    message: 'Comment đã tồn tại',
  });

  const comment = await Comment.findByPk('comment_existing');
  expect(comment).toMatchObject({
    uid: 'uid_old',
    fb_name: 'Tên cũ',
    avatar_user: 'https://example.com/old.jpg',
    content: 'nội dung cũ',
    phone: '0900000000',
  });
  expect(comment.timestamp.toISOString()).toBe('2026-05-14T08:00:00.000Z');
  expect(realtimeService.drainEvents()).toEqual([]);

  await post.reload();
  expect(post.last_count).toBe(1);
  expect(post.updated_at.toISOString()).toBe('2026-05-14T08:00:00.000Z');
});

test('POST /ingest/comments/bulk trả 409 khi payload có comment id trùng nhau', async () => {
  const post = await Post.create({ fb_post_id: 'fb_ingest_duplicate_payload', last_count: 1 });

  const response = await request(app)
    .post('/ingest/comments/bulk')
    .send(ingestPayload({
      fb_post_id: 'fb_ingest_duplicate_payload',
      comments: [
        {
          id: 'comment_duplicate_payload',
          uid: 'uid_1',
          fb_name: 'Khách 1',
          avatar_user: 'https://example.com/avatar1.jpg',
          content: 'chốt 1 đơn',
          phone: '0900000001',
          timestamp: '2026-05-14T10:00:00.000Z',
        },
        {
          id: 'comment_duplicate_payload',
          uid: 'uid_2',
          fb_name: 'Khách 2',
          avatar_user: 'https://example.com/avatar2.jpg',
          content: 'chốt 2 đơn',
          phone: '0900000002',
          timestamp: '2026-05-14T11:00:00.000Z',
        },
      ],
    }))
    .expect(409);

  expect(response.body).toEqual({
    success: false,
    message: 'Comment đã tồn tại',
  });
  expect(await Comment.count({ where: { post_id: post.id } })).toBe(0);
  expect(realtimeService.drainEvents()).toEqual([]);
});

test('GET /ingest/posts trả danh sách post gốc cho crawler', async () => {
  const olderPost = await Post.create({ fb_post_id: 'fb_old', last_count: 3, created_at: new Date('2026-05-14T08:00:00.000Z') });
  const newerPost = await Post.create({ fb_post_id: 'fb_new', last_count: 9, created_at: new Date('2026-05-14T09:00:00.000Z') });

  const response = await request(app)
    .get('/ingest/posts')
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      posts: [
        {
          id: newerPost.id,
          fb_post_id: 'fb_new',
          last_count: 9,
          is_blocked: false,
          created_at: newerPost.created_at.toISOString(),
          updated_at: newerPost.updated_at.toISOString(),
        },
        {
          id: olderPost.id,
          fb_post_id: 'fb_old',
          last_count: 3,
          is_blocked: false,
          created_at: olderPost.created_at.toISOString(),
          updated_at: olderPost.updated_at.toISOString(),
        },
      ],
    },
    pagination: {
      offset: 0,
      limit: 100,
      total: 2,
    },
  });
});

test('GET /ingest/posts trả is_blocked của post gốc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_blocked_visible', last_count: 3, is_blocked: true });

  const response = await request(app)
    .get('/ingest/posts')
    .expect(200);

  expect(response.body.data.posts[0]).toMatchObject({
    id: post.id,
    fb_post_id: 'fb_blocked_visible',
    last_count: 3,
    is_blocked: true,
  });
});

test('GET /ingest/posts lọc theo is_blocked=true', async () => {
  const blockedPost = await Post.create({ fb_post_id: 'fb_blocked_only', last_count: 1, is_blocked: true });
  await Post.create({ fb_post_id: 'fb_unblocked_hidden', last_count: 2, is_blocked: false });

  const response = await request(app)
    .get('/ingest/posts?is_blocked=true')
    .expect(200);

  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0]).toMatchObject({
    id: blockedPost.id,
    fb_post_id: 'fb_blocked_only',
    is_blocked: true,
  });
  expect(response.body.pagination.total).toBe(1);
});

test('GET /ingest/posts lọc theo is_blocked=false', async () => {
  await Post.create({ fb_post_id: 'fb_blocked_hidden', last_count: 1, is_blocked: true });
  const unblockedPost = await Post.create({ fb_post_id: 'fb_unblocked_only', last_count: 2, is_blocked: false });

  const response = await request(app)
    .get('/ingest/posts?is_blocked=false')
    .expect(200);

  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0]).toMatchObject({
    id: unblockedPost.id,
    fb_post_id: 'fb_unblocked_only',
    is_blocked: false,
  });
  expect(response.body.pagination.total).toBe(1);
});

test('GET /ingest/posts hỗ trợ offset và limit cho crawler', async () => {
  await Post.create({ fb_post_id: 'fb_page_old', last_count: 3, created_at: new Date('2026-05-14T08:00:00.000Z') });
  const middlePost = await Post.create({ fb_post_id: 'fb_page_middle', last_count: 6, created_at: new Date('2026-05-14T09:00:00.000Z') });
  const newestPost = await Post.create({ fb_post_id: 'fb_page_newest', last_count: 9, created_at: new Date('2026-05-14T10:00:00.000Z') });

  const response = await request(app)
    .get('/ingest/posts?offset=0&limit=2')
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      posts: [
        {
          id: newestPost.id,
          fb_post_id: 'fb_page_newest',
          last_count: 9,
          is_blocked: false,
          created_at: newestPost.created_at.toISOString(),
          updated_at: newestPost.updated_at.toISOString(),
        },
        {
          id: middlePost.id,
          fb_post_id: 'fb_page_middle',
          last_count: 6,
          is_blocked: false,
          created_at: middlePost.created_at.toISOString(),
          updated_at: middlePost.updated_at.toISOString(),
        },
      ],
    },
    pagination: {
      offset: 0,
      limit: 2,
      total: 3,
    },
  });
});

test('PATCH /ingest/posts/:fbPostId cập nhật last_count riêng cho post gốc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_update_count', last_count: 5 });

  const response = await request(app)
    .patch('/ingest/posts/fb_update_count')
    .send({ last_count: 12 })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: post.id,
      fb_post_id: 'fb_update_count',
      last_count: 12,
    },
  });

  await post.reload();
  expect(post.last_count).toBe(12);
});

test('PATCH /ingest/posts/:fbPostId cập nhật is_blocked cho post gốc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_update_blocked', last_count: 5, is_blocked: false });

  const response = await request(app)
    .patch('/ingest/posts/fb_update_blocked')
    .send({ is_blocked: true })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: post.id,
      fb_post_id: 'fb_update_blocked',
      last_count: 5,
      is_blocked: true,
    },
  });

  await post.reload();
  expect(post.is_blocked).toBe(true);
  expect(post.last_count).toBe(5);
});

test('PATCH /ingest/posts/:fbPostId cập nhật last_count và is_blocked cùng lúc', async () => {
  const post = await Post.create({ fb_post_id: 'fb_update_count_and_blocked', last_count: 5, is_blocked: true });

  const response = await request(app)
    .patch('/ingest/posts/fb_update_count_and_blocked')
    .send({ last_count: 12, is_blocked: false })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      id: post.id,
      fb_post_id: 'fb_update_count_and_blocked',
      last_count: 12,
      is_blocked: false,
    },
  });

  await post.reload();
  expect(post.last_count).toBe(12);
  expect(post.is_blocked).toBe(false);
});

test('PATCH /ingest/posts/:fbPostId trả 404 khi post gốc không tồn tại', async () => {
  const response = await request(app)
    .patch('/ingest/posts/missing_post')
    .send({ last_count: 12 })
    .expect(404);

  expect(response.body).toEqual({
    success: false,
    message: 'Post không tồn tại',
  });
});

test('DELETE /ingest/posts/:fbPostId xoá cứng post gốc', async () => {
  await Post.create({ fb_post_id: 'fb_delete_post', last_count: 5 });

  const response = await request(app)
    .delete('/ingest/posts/fb_delete_post')
    .expect(200);

  expect(response.body).toEqual({ success: true });
  expect(await Post.findOne({ where: { fb_post_id: 'fb_delete_post' } })).toBeNull();
});

test('DELETE /ingest/posts/:fbPostId xoá cascade user_posts và comments liên quan', async () => {
  const post = await Post.create({ fb_post_id: 'fb_delete_cascade', last_count: 5 });
  const user = await User.create({ username: 'delete_cascade_user', password_hash: 'hash', name: 'Delete Cascade User', role: 'USER' });
  await UserPost.create({ user_id: user.id, post_id: post.id, title: 'Bài xoá cascade' });
  await Comment.create({
    id: 'delete_cascade_comment',
    uid: 'uid_delete_cascade',
    timestamp: new Date('2026-05-14T10:00:00.000Z'),
    post_id: post.id,
  });

  await request(app)
    .delete('/ingest/posts/fb_delete_cascade')
    .expect(200);

  expect(await Post.findByPk(post.id)).toBeNull();
  expect(await UserPost.count({ where: { post_id: post.id } })).toBe(0);
  expect(await Comment.count({ where: { post_id: post.id } })).toBe(0);
});

test('DELETE /ingest/posts/:fbPostId trả 404 khi post gốc không tồn tại', async () => {
  const response = await request(app)
    .delete('/ingest/posts/missing_delete_post')
    .expect(404);

  expect(response.body).toEqual({
    success: false,
    message: 'Post không tồn tại',
  });
});
