const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { Op } = require('sequelize');
const { UserSession, User } = require('../models');
const { hashToken } = require('../utils/token');

let io = null;
let pubClient = null;
let subClient = null;
const testEvents = [];

async function findUserByToken(token) {
  if (!token) return null;

  const session = await UserSession.findOne({
    where: {
      token_hash: hashToken(token),
      revoked_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
    include: [{
      model: User,
      as: 'user',
      include: [{ model: User, as: 'agency' }],
    }],
  });

  if (!session || !session.user || !session.user.is_active) {
    return null;
  }

  if (session.user.role === 'EMPLOYEE') {
    const agency = session.user.agency;
    if (!agency || !agency.is_active) {
      return null;
    }
  }

  return session.user;
}

function resolveOwnerId(user) {
  return user.role === 'EMPLOYEE' ? user.parent_user_id : user.id;
}

async function attachRedisAdapter(socketServer) {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_URL is required when running realtime in production');
    }
    return;
  }

  pubClient = createClient({ url: redisUrl });
  subClient = pubClient.duplicate();

  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  socketServer.adapter(createAdapter(pubClient, subClient));
}

async function attach(server) {
  if (io) {
    await close();
  }

  io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  await attachRedisAdapter(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const user = await findUserByToken(token);

      if (!user) {
        next(new Error('unauthorized'));
        return;
      }

      socket.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${resolveOwnerId(socket.user)}`);
  });

  return io;
}

function emitToRoom(room, event, payload) {
  testEvents.push({ room, event, payload });

  if (!io) return;

  io.to(room).emit('message', { event, payload });
}

function drainEvents() {
  return testEvents.splice(0, testEvents.length);
}

function reset() {
  testEvents.splice(0, testEvents.length);
}

async function close() {
  if (io) {
    io.close();
    io = null;
  }

  if (subClient) {
    await subClient.quit();
    subClient = null;
  }

  if (pubClient) {
    await pubClient.quit();
    pubClient = null;
  }
}

module.exports = {
  attach,
  emitToRoom,
  drainEvents,
  reset,
  close,
};
