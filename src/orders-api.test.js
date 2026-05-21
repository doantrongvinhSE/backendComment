const request = require('supertest');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';

const app = require('./app');
const orderService = require('./services/orderService');
const realtimeService = require('./services/realtimeService');
const { sequelize, User, UserSession, Order } = require('./models');

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

function orderPayload(overrides = {}) {
  return {
    product_name: 'Áo thun',
    customer_name: 'Nguyễn Văn A',
    avatar_customer: 'https://example.com/avatar.jpg',
    phone: '0900000000',
    address: 'Hà Nội',
    staff: 'Nhân viên A',
    total_price: 150000,
    note: 'Giao buổi sáng',
    ...overrides,
  };
}

async function createOrder(user, overrides = {}) {
  return Order.create({
    user_id: user.id,
    product_name: 'Áo thun',
    customer_name: 'Nguyễn Văn A',
    avatar_customer: null,
    phone: '0900000000',
    address: 'Hà Nội',
    staff: null,
    total_price: 150000,
    status: 'pending',
    note: null,
    ...overrides,
  });
}

async function workbookFromResponse(response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.body);
  return workbook;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  realtimeService.reset();
  await Order.destroy({ where: {}, truncate: true });
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('order service cung cấp API CRUD orders', () => {
  expect(typeof orderService.createOrder).toBe('function');
  expect(typeof orderService.listOrders).toBe('function');
  expect(typeof orderService.getOrder).toBe('function');
  expect(typeof orderService.updateOrder).toBe('function');
  expect(typeof orderService.deleteOrder).toBe('function');
});

test('POST /me/orders tạo order riêng của user và emit realtime', async () => {
  const { user, token } = await loginUser('order_api_owner');

  const response = await request(app)
    .post('/me/orders')
    .set('Authorization', `Bearer ${token}`)
    .send(orderPayload())
    .expect(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toMatchObject({
    product_name: 'Áo thun',
    customer_name: 'Nguyễn Văn A',
    avatar_customer: 'https://example.com/avatar.jpg',
    phone: '0900000000',
    address: 'Hà Nội',
    staff: 'Nhân viên A',
    total_price: 150000,
    status: 'pending',
    note: 'Giao buổi sáng',
  });
  expect(response.body.data.user_id).toBeUndefined();
  expect(response.body.data.post_id).toBeUndefined();
  expect(response.body.data.comment_id).toBeUndefined();

  const order = await Order.findByPk(response.body.data.id);
  expect(order.user_id).toBe(user.id);
  expect(realtimeService.drainEvents()).toEqual([
    {
      room: `user:${user.id}`,
      event: 'order.created',
      payload: {
        order: expect.objectContaining({
          id: response.body.data.id,
          product_name: 'Áo thun',
          customer_name: 'Nguyễn Văn A',
          phone: '0900000000',
          address: 'Hà Nội',
          staff: 'Nhân viên A',
          total_price: 150000,
          status: 'pending',
          note: 'Giao buổi sáng',
        }),
      },
    },
  ]);
});

test('GET /me/orders/export/excel yêu cầu đăng nhập', async () => {
  await request(app)
    .get('/me/orders/export/excel')
    .expect(401);
});

test('GET /me/orders/export/excel xuất Excel chỉ gồm orders của user hiện tại', async () => {
  const { user, token } = await loginUser('order_export_owner');
  const { user: otherUser } = await loginUser('order_export_other');

  await createOrder(user, {
    product_name: 'Đơn cũ',
    customer_name: 'Khách cũ',
    phone: '0900000001',
    address: 'Hà Nội',
    note: '120000',
    created_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Đơn mới',
    customer_name: 'Khách mới',
    phone: '0900000002',
    address: 'Đà Nẵng',
    note: '250000',
    created_at: new Date('2026-05-14T09:00:00.000Z'),
  });
  await createOrder(otherUser, {
    product_name: 'Đơn người khác',
    customer_name: 'Khách khác',
    phone: '0999999999',
    address: 'Sài Gòn',
    note: '999999',
    created_at: new Date('2026-05-14T10:00:00.000Z'),
  });

  const response = await request(app)
    .get('/me/orders/export/excel')
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);

  expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(response.headers['content-disposition']).toMatch(/attachment; filename="don-hang-\d+\.xlsx"/);

  const workbook = await workbookFromResponse(response);
  const worksheet = workbook.getWorksheet('Đơn hàng') || workbook.worksheets[0];

  expect(worksheet.getCell('B6').value).toBe('Khách mới');
  expect(worksheet.getCell('C6').value).toBe('0900000002');
  expect(worksheet.getCell('D6').value).toBe('Đà Nẵng');
  expect(worksheet.getCell('H6').value).toBe('Đơn mới');
  expect(worksheet.getCell('J6').value).toBe(250000);

  expect(worksheet.getCell('B7').value).toBe('Khách cũ');
  expect(worksheet.getCell('H7').value).toBe('Đơn cũ');
  expect(worksheet.getCell('B8').value).not.toBe('Khách khác');
});

test('GET /me/orders trả orders của user theo created_at mới nhất trước', async () => {
  const { user, token } = await loginUser('order_list_owner');
  const { user: otherUser } = await loginUser('order_list_other');

  const oldOrder = await createOrder(user, {
    product_name: 'Đơn cũ',
    created_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await createOrder(otherUser, {
    product_name: 'Đơn người khác',
    created_at: new Date('2026-05-14T12:00:00.000Z'),
  });
  const newOrder = await createOrder(user, {
    product_name: 'Đơn mới',
    created_at: new Date('2026-05-14T13:00:00.000Z'),
  });

  const response = await request(app)
    .get('/me/orders')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.orders.map((order) => order.id)).toEqual([newOrder.id, oldOrder.id]);
  expect(response.body.data.orders.map((order) => order.product_name)).toEqual(['Đơn mới', 'Đơn cũ']);
});

test('GET /me/orders phân trang orders của user', async () => {
  const { user, token } = await loginUser('order_paged_owner');
  const { user: otherUser } = await loginUser('order_paged_other');

  await createOrder(user, {
    product_name: 'Đơn 1',
    created_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Đơn 2',
    created_at: new Date('2026-05-14T09:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Đơn 3',
    created_at: new Date('2026-05-14T10:00:00.000Z'),
  });
  await createOrder(otherUser, {
    product_name: 'Đơn người khác',
    created_at: new Date('2026-05-14T11:00:00.000Z'),
  });

  const response = await request(app)
    .get('/me/orders?page=1&limit=2')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.data.orders.map((order) => order.product_name)).toEqual(['Đơn 3', 'Đơn 2']);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 2,
    total: 3,
    total_pages: 2,
  });
});

test('GET /me/orders từ chối page hoặc limit không hợp lệ', async () => {
  const { token } = await loginUser('order_invalid_page');

  const response = await request(app)
    .get('/me/orders?page=1&limit=abc')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);

  expect(response.body).toEqual({
    success: false,
    message: 'Tham số phân trang không hợp lệ',
  });
});

test('GET /me/orders search theo khách hàng, sản phẩm, số điện thoại, địa chỉ', async () => {
  const { user, token } = await loginUser('order_search_owner');
  const { user: otherUser } = await loginUser('order_search_other');

  await createOrder(user, {
    product_name: 'Laptop văn phòng',
    customer_name: 'Trần Minh Anh',
    phone: '0911111111',
    address: 'Quận 1',
    created_at: new Date('2026-05-14T08:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Bàn phím cơ',
    customer_name: 'Lê Văn B',
    phone: '0922222222',
    address: 'Hà Đông',
    created_at: new Date('2026-05-14T09:00:00.000Z'),
  });
  await createOrder(user, {
    product_name: 'Chuột không dây',
    customer_name: 'Phạm Văn C',
    phone: '0933333333',
    address: 'Cầu Giấy',
    created_at: new Date('2026-05-14T10:00:00.000Z'),
  });
  await createOrder(otherUser, {
    product_name: 'Laptop văn phòng',
    customer_name: 'Người khác',
    phone: '0911111111',
    address: 'Quận 1',
    created_at: new Date('2026-05-14T11:00:00.000Z'),
  });

  const customerResponse = await request(app)
    .get('/me/orders?search=Minh')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(customerResponse.body.data.orders.map((order) => order.customer_name)).toEqual(['Trần Minh Anh']);
  expect(customerResponse.body.pagination.total).toBe(1);

  const productResponse = await request(app)
    .get('/me/orders?search=phím')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(productResponse.body.data.orders.map((order) => order.product_name)).toEqual(['Bàn phím cơ']);
  expect(productResponse.body.pagination.total).toBe(1);

  const phoneResponse = await request(app)
    .get('/me/orders?search=0933333333')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(phoneResponse.body.data.orders.map((order) => order.phone)).toEqual(['0933333333']);
  expect(phoneResponse.body.pagination.total).toBe(1);

  const addressResponse = await request(app)
    .get('/me/orders?search=Quận')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(addressResponse.body.data.orders.map((order) => order.customer_name)).toEqual(['Trần Minh Anh']);
  expect(addressResponse.body.pagination.total).toBe(1);
});

test('GET /me/orders/:orderId chỉ trả order thuộc user', async () => {
  const { user, token } = await loginUser('order_detail_owner');
  const { token: otherToken } = await loginUser('order_detail_other');
  const order = await createOrder(user, { product_name: 'Đơn chi tiết' });

  const response = await request(app)
    .get(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toMatchObject({
    id: order.id,
    product_name: 'Đơn chi tiết',
    staff: null,
  });

  await request(app)
    .get(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${otherToken}`)
    .expect(404);
});

test('PATCH /me/orders/:orderId cập nhật order thuộc user và emit realtime', async () => {
  const { user, token } = await loginUser('order_update_owner');
  const { token: otherToken } = await loginUser('order_update_other');
  const order = await createOrder(user, { status: 'pending' });

  const response = await request(app)
    .patch(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'completed', note: 'Đã giao', staff: 'Nhân viên B' })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toMatchObject({
    id: order.id,
    status: 'completed',
    note: 'Đã giao',
    staff: 'Nhân viên B',
  });
  expect(realtimeService.drainEvents()).toEqual([
    {
      room: `user:${user.id}`,
      event: 'order.updated',
      payload: {
        order: expect.objectContaining({
          id: response.body.data.id,
          status: 'completed',
          note: 'Đã giao',
          staff: 'Nhân viên B',
        }),
      },
    },
  ]);

  await request(app)
    .patch(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ status: 'cancelled' })
    .expect(404);
  expect(realtimeService.drainEvents()).toEqual([]);
});

test('PATCH /me/orders/:orderId từ chối status không hợp lệ', async () => {
  const { user, token } = await loginUser('order_invalid_status');
  const order = await createOrder(user, { status: 'pending' });

  await request(app)
    .patch(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'unknown' })
    .expect(400);

  await order.reload();
  expect(order.status).toBe('pending');
  expect(realtimeService.drainEvents()).toEqual([]);
});

test('DELETE /me/orders/:orderId chỉ xóa order thuộc user', async () => {
  const { user, token } = await loginUser('order_delete_owner');
  const { token: otherToken } = await loginUser('order_delete_other');
  const order = await createOrder(user);

  await request(app)
    .delete(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${otherToken}`)
    .expect(404);

  expect(await Order.findByPk(order.id)).not.toBeNull();
  expect(realtimeService.drainEvents()).toEqual([]);

  await request(app)
    .delete(`/me/orders/${order.id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(await Order.findByPk(order.id)).toBeNull();
  expect(realtimeService.drainEvents()).toEqual([
    {
      room: `user:${user.id}`,
      event: 'order.deleted',
      payload: { order: { id: order.id } },
    },
  ]);
});
