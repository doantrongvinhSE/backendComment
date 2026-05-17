const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';

const { sequelize, User, Order } = require('./models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Order.destroy({ where: {}, truncate: true });
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

function createOrder(user, data = {}) {
  return Order.create({
    user_id: user.id,
    product_name: data.product_name || 'Áo thun',
    customer_name: data.customer_name || 'Nguyễn Văn A',
    avatar_customer: data.avatar_customer === undefined ? null : data.avatar_customer,
    phone: data.phone || '0900000000',
    address: data.address || 'Hà Nội',
    total_price: data.total_price === undefined ? null : data.total_price,
    status: data.status,
    note: data.note === undefined ? null : data.note,
  });
}

test('Order model được export', () => {
  expect(Order).toBeDefined();
  expect(typeof Order.create).toBe('function');
});

test('tạo Order riêng thuộc user và mặc định status pending', async () => {
  const user = await createUser('order_owner');

  const order = await createOrder(user, { total_price: 150000 });

  expect(order.user_id).toBe(user.id);
  expect(order.product_name).toBe('Áo thun');
  expect(order.customer_name).toBe('Nguyễn Văn A');
  expect(order.phone).toBe('0900000000');
  expect(order.address).toBe('Hà Nội');
  expect(order.total_price).toBe(150000);
  expect(order.status).toBe('pending');
});

test('Order cho phép avatar_customer, total_price và note null', async () => {
  const user = await createUser('order_nullable');

  const order = await createOrder(user);

  expect(order.avatar_customer).toBeNull();
  expect(order.total_price).toBeNull();
  expect(order.note).toBeNull();
});

test('Order cho phép status completed và cancelled', async () => {
  const user = await createUser('order_status');

  const completedOrder = await createOrder(user, { status: 'completed' });
  const cancelledOrder = await createOrder(user, { status: 'cancelled' });

  expect(completedOrder.status).toBe('completed');
  expect(cancelledOrder.status).toBe('cancelled');
});

test('Order không gắn post_id hoặc comment_id', async () => {
  const user = await createUser('order_independent');

  const order = await createOrder(user);

  expect(order.post_id).toBeUndefined();
  expect(order.comment_id).toBeUndefined();
});
