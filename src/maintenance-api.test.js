const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const {
  sequelize, User, UserSession, MaintenanceState,
} = require('./models');

async function loginAs(username, role) {
  await User.create({
    username,
    password_hash: await bcrypt.hash('password123', 10),
    name: username,
    role,
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
  await MaintenanceState.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('mặc định bảo trì tắt, request bình thường không bị chặn', async () => {
  const token = await loginAs('user_maintenance_default', 'USER');

  await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});

test('admin bật bảo trì với message tùy chỉnh thì trả 200 và data đúng', async () => {
  const adminToken = await loginAs('admin_maintenance_on', 'ADMIN');

  const response = await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: true, message: 'Đang nâng cấp hệ thống, quay lại sau 30 phút.' })
    .expect(200);

  expect(response.body).toMatchObject({
    success: true,
    data: {
      is_enabled: true,
      message: 'Đang nâng cấp hệ thống, quay lại sau 30 phút.',
    },
  });
});

test('khi bảo trì bật, request tới /me và /auth/login bị chặn 503 kèm message', async () => {
  const adminToken = await loginAs('admin_maintenance_block', 'ADMIN');
  await User.create({
    username: 'user_blocked',
    password_hash: await bcrypt.hash('password123', 10),
    name: 'user_blocked',
    role: 'USER',
  });

  await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: true, message: 'Bảo trì định kỳ' })
    .expect(200);

  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'user_blocked', password: 'password123' })
    .expect(503);

  expect(loginResponse.body).toEqual({
    success: false,
    message: 'Bảo trì định kỳ',
    maintenance: true,
  });
});

test('khi bảo trì bật, /admin/* vẫn hoạt động để admin tắt lại bảo trì', async () => {
  const adminToken = await loginAs('admin_maintenance_toggle', 'ADMIN');

  await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: true, message: 'Bảo trì' })
    .expect(200);

  const getResponse = await request(app)
    .get('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(getResponse.body.data.is_enabled).toBe(true);

  const disableResponse = await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: false })
    .expect(200);

  expect(disableResponse.body.data).toMatchObject({ is_enabled: false, message: null });

  await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});

test('khi bảo trì bật, /health vẫn hoạt động bình thường', async () => {
  const adminToken = await loginAs('admin_maintenance_health', 'ADMIN');

  await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: true })
    .expect(200);

  await request(app)
    .get('/health')
    .expect(200);
});

test('user thường không có quyền bật/tắt bảo trì, trả 403', async () => {
  const userToken = await loginAs('user_maintenance_forbidden', 'USER');

  await request(app)
    .patch('/admin/maintenance')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ enabled: true })
    .expect(403);
});
