const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const employeeService = require('./services/employeeService');
const realtimeService = require('./services/realtimeService');
const { sequelize, User, UserSession, Post, UserPost, Order } = require('./models');

async function loginAgency(username = 'agency1') {
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

async function createEmployee(agencyToken, username, permissions) {
  const response = await request(app)
    .post('/me/employees')
    .set('Authorization', `Bearer ${agencyToken}`)
    .send({ username, password: 'password123', name: username, permissions })
    .expect(201);

  return response.body.data.employee;
}

async function loginEmployee(username) {
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
  await Order.destroy({ where: {}, truncate: true });
  await UserPost.destroy({ where: {}, truncate: true });
  await Post.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: { role: 'EMPLOYEE' } });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('employee service cung cấp CRUD nhân viên', () => {
  expect(typeof employeeService.createEmployee).toBe('function');
  expect(typeof employeeService.listEmployees).toBe('function');
  expect(typeof employeeService.updatePermissions).toBe('function');
  expect(typeof employeeService.disableEmployee).toBe('function');
});

test('đại lý tạo employee, employee đăng nhập và /me trả về permissions', async () => {
  const agencyToken = await loginAgency();

  const employee = await createEmployee(agencyToken, 'emp1', { posts: true });
  expect(employee).toMatchObject({ username: 'emp1', role: 'EMPLOYEE' });
  expect(employee.permissions).toEqual({ posts: true, comments: false, orders: false, salers: false });
  expect(employee.password_hash).toBeUndefined();

  const employeeToken = await loginEmployee('emp1');

  const meResponse = await request(app)
    .get('/me')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(200);

  expect(meResponse.body.data.user.role).toBe('EMPLOYEE');
  expect(meResponse.body.data.user.permissions).toEqual({ posts: true, comments: false, orders: false, salers: false });
});

test('employee chỉ truy cập được module được cấp, module khác bị 403', async () => {
  const agencyToken = await loginAgency();
  await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(200);

  await request(app)
    .get('/me/orders')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);

  await request(app)
    .get('/me/salers')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);
});

test('employee vẫn tạo được order dù không có quyền module orders, nhưng GET/PATCH/DELETE order vẫn bị chặn', async () => {
  const agencyToken = await loginAgency();
  await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  const createResponse = await request(app)
    .post('/me/orders')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({
      product_name: 'Áo thun',
      customer_name: 'Nguyễn Văn A',
      phone: '0900000000',
      address: 'Hà Nội',
    })
    .expect(201);

  const orderId = createResponse.body.data.id;

  await request(app)
    .get('/me/orders')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);

  await request(app)
    .get(`/me/orders/${orderId}`)
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);

  await request(app)
    .patch(`/me/orders/${orderId}`)
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({ note: 'x' })
    .expect(403);

  await request(app)
    .delete(`/me/orders/${orderId}`)
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);
});

test('dữ liệu dùng chung: employee tạo post thì đại lý thấy post đó', async () => {
  const agencyToken = await loginAgency();
  await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .post('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({ title: 'Post của employee', originalLink: 'https://www.facebook.com/reel/123456789' })
    .expect(201);

  const agencyPosts = await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${agencyToken}`)
    .expect(200);

  const items = agencyPosts.body.data.items || agencyPosts.body.data.posts || agencyPosts.body.data;
  expect(JSON.stringify(agencyPosts.body)).toContain('Post của employee');
  expect(items).toBeTruthy();

  const agency = await User.findOne({ where: { username: 'agency1' } });
  const userPost = await UserPost.findOne({});
  expect(userPost.user_id).toBe(agency.id);
});

test('employee không được gọi /me/employees và /admin', async () => {
  const agencyToken = await loginAgency();
  await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .get('/me/employees')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);

  await request(app)
    .get('/admin/users')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);
});

test('đại lý không quản lý được employee của đại lý khác', async () => {
  const agencyAToken = await loginAgency('agencyA');
  const agencyBToken = await loginAgency('agencyB');

  const employee = await createEmployee(agencyAToken, 'empA', { posts: true });

  await request(app)
    .patch(`/me/employees/${employee.id}/permissions`)
    .set('Authorization', `Bearer ${agencyBToken}`)
    .send({ permissions: { posts: false } })
    .expect(404);
});

test('cập nhật permissions có hiệu lực ngay ở request kế tiếp', async () => {
  const agencyToken = await loginAgency();
  const employee = await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .patch(`/me/employees/${employee.id}/permissions`)
    .set('Authorization', `Bearer ${agencyToken}`)
    .send({ permissions: { orders: true } })
    .expect(200);

  await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(403);

  await request(app)
    .get('/me/orders')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(200);
});

test('permissions có module lạ bị 400', async () => {
  const agencyToken = await loginAgency();

  await request(app)
    .post('/me/employees')
    .set('Authorization', `Bearer ${agencyToken}`)
    .send({ username: 'emp1', password: 'password123', permissions: { hacking: true } })
    .expect(400);
});

test('đại lý bị khóa thì employee không đăng nhập và không truy cập được nữa', async () => {
  const agencyToken = await loginAgency();
  await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  const agency = await User.findOne({ where: { username: 'agency1' } });
  await agency.update({ is_active: false });

  await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(401);

  await request(app)
    .post('/auth/login')
    .send({ username: 'emp1', password: 'password123' })
    .expect(401);
});

test('disable employee thì session bị revoke và không đăng nhập được', async () => {
  const agencyToken = await loginAgency();
  const employee = await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .patch(`/me/employees/${employee.id}/disable`)
    .set('Authorization', `Bearer ${agencyToken}`)
    .expect(200);

  await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(401);

  await request(app)
    .post('/auth/login')
    .send({ username: 'emp1', password: 'password123' })
    .expect(401);
});

test('xóa employee thì revoke toàn bộ session, không đăng nhập được và không còn trong danh sách', async () => {
  const agencyToken = await loginAgency();
  const employee = await createEmployee(agencyToken, 'emp1', { posts: true });
  const employeeToken = await loginEmployee('emp1');

  await request(app)
    .delete(`/me/employees/${employee.id}`)
    .set('Authorization', `Bearer ${agencyToken}`)
    .expect(200);

  await request(app)
    .get('/me/posts')
    .set('Authorization', `Bearer ${employeeToken}`)
    .expect(401);

  await request(app)
    .post('/auth/login')
    .send({ username: 'emp1', password: 'password123' })
    .expect(401);

  const deletedEmployee = await User.findByPk(employee.id);
  expect(deletedEmployee).toBeNull();

  const listResponse = await request(app)
    .get('/me/employees')
    .set('Authorization', `Bearer ${agencyToken}`)
    .expect(200);

  expect(listResponse.body.data.employees).toEqual([]);
});

test('đại lý không xóa được employee của đại lý khác', async () => {
  const agencyAToken = await loginAgency('agencyA');
  const agencyBToken = await loginAgency('agencyB');

  const employee = await createEmployee(agencyAToken, 'empA', { posts: true });

  await request(app)
    .delete(`/me/employees/${employee.id}`)
    .set('Authorization', `Bearer ${agencyBToken}`)
    .expect(404);

  const stillExists = await User.findByPk(employee.id);
  expect(stillExists).not.toBeNull();
});
