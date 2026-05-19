const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const salerService = require('./services/salerService');
const { sequelize, User, UserSession, Saler } = require('./models');

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

  const user = await User.findOne({ where: { username } });
  return { token: response.body.data.token, user };
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Saler.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('saler service cung cấp API list salers', () => {
  expect(typeof salerService.listSalers).toBe('function');
});

test('GET /me/salers trả salers của user đang đăng nhập', async () => {
  const { token, user } = await loginUser('saler_owner');
  const { user: otherUser } = await loginUser('saler_other');

  await Saler.create({ user_id: user.id, name_saler: 'Nguyễn A', username_saler: 'nguyena' });
  await Saler.create({ user_id: user.id, name_saler: 'Trần B', username_saler: 'tranb' });
  await Saler.create({ user_id: otherUser.id, name_saler: 'Ẩn C', username_saler: 'anc' });

  const response = await request(app)
    .get('/me/salers')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body).toEqual({
    success: true,
    data: {
      salers: [
        { id: expect.any(Number), name_saler: 'Nguyễn A', username_saler: 'nguyena' },
        { id: expect.any(Number), name_saler: 'Trần B', username_saler: 'tranb' },
      ],
    },
  });
});
