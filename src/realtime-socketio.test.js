const http = require('http');
const bcrypt = require('bcrypt');
const { io: createClient } = require('socket.io-client');

process.env.NODE_ENV = 'test';
process.env.SESSION_DAYS = '30';
delete process.env.REDIS_URL;

const app = require('./app');
const realtimeService = require('./services/realtimeService');
const { sequelize, User, UserSession } = require('./models');

function waitForClientEvent(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Không nhận được event ${eventName}`)), 1000);

    socket.once(eventName, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });
  });
}

async function loginUser(username = 'socket_user') {
  const user = await User.create({
    username,
    password_hash: await bcrypt.hash('password123', 10),
    name: username,
    role: 'USER',
  });

  const request = require('supertest');
  const response = await request(app)
    .post('/auth/login')
    .send({ username, password: 'password123' })
    .expect(200);

  return { user, token: response.body.data.token };
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  realtimeService.reset();
  await UserSession.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

afterAll(async () => {
  await sequelize.close();
});

test('Socket.IO client nhận realtime message trong user room sau khi xác thực token', async () => {
  const { user, token } = await loginUser();
  const server = http.createServer(app);
  await realtimeService.attach(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const socket = createClient(`http://127.0.0.1:${address.port}`, {
    auth: { token },
    reconnection: false,
    transports: ['websocket'],
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO client không kết nối được')), 1000);
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('connect_error', reject);
    });

    const receivedMessage = waitForClientEvent(socket, 'message');
    realtimeService.emitToRoom(`user:${user.id}`, 'post.created', { post: { id: 1 } });

    await expect(receivedMessage).resolves.toEqual({
      event: 'post.created',
      payload: { post: { id: 1 } },
    });
  } finally {
    socket.disconnect();
    if (typeof realtimeService.close === 'function') {
      await realtimeService.close();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
