const { Op } = require('sequelize');
const { UserSession, User } = require('../models');
const { hashToken } = require('../utils/token');

let wss = null;
const rooms = new Map();
const testEvents = [];

function joinRoom(client, room) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }

  rooms.get(room).add(client);
  client.rooms = client.rooms || new Set();
  client.rooms.add(room);
}

function leaveRooms(client) {
  if (!client.rooms) return;

  client.rooms.forEach((room) => {
    const clients = rooms.get(room);
    if (!clients) return;

    clients.delete(client);
    if (clients.size === 0) {
      rooms.delete(room);
    }
  });
}

async function findUserByToken(token) {
  if (!token) return null;

  const session = await UserSession.findOne({
    where: {
      token_hash: hashToken(token),
      revoked_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
    include: [{ model: User, as: 'user' }],
  });

  if (!session || !session.user || !session.user.is_active) {
    return null;
  }

  return session.user;
}

function attach(server) {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });

  wss.on('connection', async (client, request) => {
    const url = new URL(request.url, 'http://localhost');
    const user = await findUserByToken(url.searchParams.get('token'));

    if (!user) {
      client.close();
      return;
    }

    joinRoom(client, `user:${user.id}`);
    client.on('close', () => leaveRooms(client));
  });

  return wss;
}

function emitToRoom(room, event, payload) {
  testEvents.push({ room, event, payload });

  const clients = rooms.get(room);
  if (!clients) return;

  const message = JSON.stringify({ event, payload });
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

function drainEvents() {
  return testEvents.splice(0, testEvents.length);
}

function reset() {
  rooms.clear();
  testEvents.splice(0, testEvents.length);
}

module.exports = {
  attach,
  emitToRoom,
  drainEvents,
  reset,
};
