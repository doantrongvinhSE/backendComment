const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const authService = require('./services/authService');
const adminService = require('./services/adminService');
const { sequelize, User, UserSession } = require('./models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('business logic được tách vào service layer', () => {
  expect(typeof authService.login).toBe('function');
  expect(typeof authService.logout).toBe('function');
  expect(typeof adminService.createUser).toBe('function');
  expect(typeof adminService.disableUser).toBe('function');
});

test('admin đăng nhập, xem /me, tạo user, khóa user và user bị khóa không đăng nhập được', async () => {
  await User.create({
    username: 'admin',
    password_hash: await bcrypt.hash('secret123', 10),
    name: 'Admin',
    role: 'ADMIN',
  });

  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'admin', password: 'secret123', deviceName: 'Jest' })
    .expect(200);

  expect(loginResponse.body.success).toBe(true);
  expect(loginResponse.body.data.token).toBeTruthy();
  expect(loginResponse.body.data.user).toMatchObject({ username: 'admin', role: 'ADMIN' });
  expect(loginResponse.body.data.user.password_hash).toBeUndefined();

  const token = loginResponse.body.data.token;

  const meResponse = await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(meResponse.body.data.user).toMatchObject({ username: 'admin', role: 'ADMIN' });

  const createUserResponse = await request(app)
    .post('/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ username: 'user1', password: 'password123', name: 'User 1' })
    .expect(201);

  expect(createUserResponse.body.data.user).toMatchObject({ username: 'user1', role: 'USER', is_active: true });
  expect(createUserResponse.body.data.user.password_hash).toBeUndefined();

  const userId = createUserResponse.body.data.user.id;

  await request(app)
    .patch(`/admin/users/${userId}/disable`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  await request(app)
    .post('/auth/login')
    .send({ username: 'user1', password: 'password123' })
    .expect(401);
});

test('user thường không được gọi API admin', async () => {
  await User.create({
    username: 'normal',
    password_hash: await bcrypt.hash('password123', 10),
    name: 'Normal',
    role: 'USER',
  });

  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'normal', password: 'password123' })
    .expect(200);

  await request(app)
    .get('/admin/users')
    .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
    .expect(403);
});

test('user đổi mật khẩu bằng mật khẩu cũ và mật khẩu mới', async () => {
  const user = await User.create({
    username: 'change_pass_user',
    password_hash: await bcrypt.hash('oldpass123', 10),
    name: 'Change Pass User',
    role: 'USER',
  });

  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'change_pass_user', password: 'oldpass123' })
    .expect(200);

  await request(app)
    .patch('/auth/password')
    .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
    .send({ currentPassword: 'oldpass123', newPassword: 'newpass123' })
    .expect(200);

  await user.reload();
  expect(await bcrypt.compare('newpass123', user.password_hash)).toBe(true);
  expect(await bcrypt.compare('oldpass123', user.password_hash)).toBe(false);

  await request(app)
    .post('/auth/login')
    .send({ username: 'change_pass_user', password: 'oldpass123' })
    .expect(401);

  await request(app)
    .post('/auth/login')
    .send({ username: 'change_pass_user', password: 'newpass123' })
    .expect(200);
});

test('user không đổi được mật khẩu khi mật khẩu cũ sai', async () => {
  const user = await User.create({
    username: 'wrong_old_pass_user',
    password_hash: await bcrypt.hash('oldpass123', 10),
    name: 'Wrong Old Pass User',
    role: 'USER',
  });

  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'wrong_old_pass_user', password: 'oldpass123' })
    .expect(200);

  const response = await request(app)
    .patch('/auth/password')
    .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
    .send({ currentPassword: 'wrongpass123', newPassword: 'newpass123' })
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Mật khẩu cũ không đúng',
  });

  await user.reload();
  expect(await bcrypt.compare('oldpass123', user.password_hash)).toBe(true);
});

test('user đăng xuất tất cả thiết bị khác và giữ session hiện tại', async () => {
  await User.create({
    username: 'logout_other_devices_user',
    password_hash: await bcrypt.hash('password123', 10),
    name: 'Logout Other Devices User',
    role: 'USER',
  });

  const firstLoginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'logout_other_devices_user', password: 'password123', deviceName: 'Thiết bị 1' })
    .expect(200);
  const secondLoginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'logout_other_devices_user', password: 'password123', deviceName: 'Thiết bị 2' })
    .expect(200);
  const thirdLoginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'logout_other_devices_user', password: 'password123', deviceName: 'Thiết bị 3' })
    .expect(200);

  const currentToken = secondLoginResponse.body.data.token;

  const response = await request(app)
    .post('/auth/logout-other-devices')
    .set('Authorization', `Bearer ${currentToken}`)
    .expect(200);

  expect(response.body).toEqual({ success: true, data: { revoked_count: 2 } });

  await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${firstLoginResponse.body.data.token}`)
    .expect(401);
  await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${currentToken}`)
    .expect(200);
  await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${thirdLoginResponse.body.data.token}`)
    .expect(401);
});
