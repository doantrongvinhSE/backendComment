const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';

const { sequelize, User, Post, UserPost } = require('./models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await UserPost.destroy({ where: {}, truncate: true });
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

test('tạo Post theo fb_post_id và last_count mặc định bằng 0', async () => {
  const post = await Post.create({ fb_post_id: 'fb_1' });

  expect(post.fb_post_id).toBe('fb_1');
  expect(post.last_count).toBe(0);
});

test('không cho tạo hai Post cùng fb_post_id', async () => {
  await Post.create({ fb_post_id: 'fb_duplicate' });

  await expect(Post.create({ fb_post_id: 'fb_duplicate' })).rejects.toThrow();
});

test('tạo UserPost nối User và Post', async () => {
  const user = await createUser('user_post_owner');
  const post = await Post.create({ fb_post_id: 'fb_user_post' });

  const userPost = await UserPost.create({
    user_id: user.id,
    post_id: post.id,
    title: 'Bài cần theo dõi',
    original_link: 'https://www.facebook.com/post/1',
  });

  expect(userPost.user_id).toBe(user.id);
  expect(userPost.post_id).toBe(post.id);
  expect(userPost.title).toBe('Bài cần theo dõi');
  expect(userPost.original_link).toBe('https://www.facebook.com/post/1');
});

test('không cho một user theo dõi cùng post hai lần', async () => {
  const user = await createUser('user_duplicate_post');
  const post = await Post.create({ fb_post_id: 'fb_once_per_user' });

  await UserPost.create({ user_id: user.id, post_id: post.id });

  await expect(UserPost.create({ user_id: user.id, post_id: post.id })).rejects.toThrow();
});

test('user khác có thể theo dõi cùng một Post', async () => {
  const userA = await createUser('user_a');
  const userB = await createUser('user_b');
  const post = await Post.create({ fb_post_id: 'fb_shared' });

  await UserPost.create({ user_id: userA.id, post_id: post.id });
  await UserPost.create({ user_id: userB.id, post_id: post.id });

  const count = await UserPost.count({ where: { post_id: post.id } });

  expect(count).toBe(2);
});
