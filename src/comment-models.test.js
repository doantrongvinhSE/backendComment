const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';

const { sequelize, User, Post, Comment, UserComment } = require('./models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await UserComment.destroy({ where: {}, truncate: true });
  await Comment.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

async function createUser(username) {
  return User.create({
    username,
    password_hash: await bcrypt.hash('password123', 10),
    name: username,
    role: 'USER',
  });
}

async function createPost() {
  return Post.create({ fb_post_id: 'fb_comment_post' });
}

async function createComment(post, id = 'comment_1') {
  return Comment.create({
    id,
    uid: 'fb_user_1',
    fb_name: 'Khách hàng',
    avatar_user: 'https://example.com/avatar.jpg',
    content: 'Tôi muốn mua hàng, số điện thoại 0900000000',
    phone: '0900000000',
    timestamp: new Date('2026-05-14T10:00:00.000Z'),
    post_id: post.id,
  });
}

test('tạo Comment gốc thuộc Post', async () => {
  const post = await createPost();

  const comment = await createComment(post);

  expect(comment.id).toBe('comment_1');
  expect(comment.uid).toBe('fb_user_1');
  expect(comment.post_id).toBe(post.id);
  expect(comment.status).toBeUndefined();
});

test('không cho tạo hai Comment cùng post_id và id', async () => {
  const post = await createPost();
  await createComment(post, 'duplicate_comment');

  await expect(createComment(post, 'duplicate_comment')).rejects.toThrow();
});

test('UserComment mặc định status normal và không có field is_calling riêng', async () => {
  const user = await createUser('comment_owner');
  const post = await createPost();
  const comment = await createComment(post);

  const userComment = await UserComment.create({
    user_id: user.id,
    comment_id: comment.id,
  });

  expect(userComment.status).toBe('normal');
  expect(userComment.is_calling).toBeUndefined();
});

test('UserComment cho phép status is_calling', async () => {
  const user = await createUser('calling_owner');
  const post = await createPost();
  const comment = await createComment(post);

  const userComment = await UserComment.create({
    user_id: user.id,
    comment_id: comment.id,
    status: 'is_calling',
  });

  expect(userComment.status).toBe('is_calling');
});

test('không cho một user tạo trùng UserComment cho cùng comment', async () => {
  const user = await createUser('duplicate_user_comment');
  const post = await createPost();
  const comment = await createComment(post);

  await UserComment.create({ user_id: user.id, comment_id: comment.id });

  await expect(UserComment.create({ user_id: user.id, comment_id: comment.id })).rejects.toThrow();
});

test('hai user có status riêng trên cùng comment', async () => {
  const userA = await createUser('status_user_a');
  const userB = await createUser('status_user_b');
  const post = await createPost();
  const comment = await createComment(post);

  await UserComment.create({ user_id: userA.id, comment_id: comment.id, status: 'success' });
  await UserComment.create({ user_id: userB.id, comment_id: comment.id, status: 'fail' });

  const userAComment = await UserComment.findOne({ where: { user_id: userA.id, comment_id: comment.id } });
  const userBComment = await UserComment.findOne({ where: { user_id: userB.id, comment_id: comment.id } });

  expect(userAComment.status).toBe('success');
  expect(userBComment.status).toBe('fail');
});
