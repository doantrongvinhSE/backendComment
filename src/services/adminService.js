const bcrypt = require('bcrypt');
const { User, UserSession } = require('../models');
const { toPublicUser } = require('./userPresenter');

const VALID_ROLES = ['ADMIN', 'USER'];

async function createUser({ username, password, name, role = 'USER' }) {
  if (!username || !password) {
    return { status: 400, body: { success: false, message: 'Thiếu username hoặc password' } };
  }

  if (!VALID_ROLES.includes(role)) {
    return { status: 400, body: { success: false, message: 'Role không hợp lệ' } };
  }

  const existedUser = await User.findOne({ where: { username } });

  if (existedUser) {
    return { status: 409, body: { success: false, message: 'Username đã tồn tại' } };
  }

  const user = await User.create({
    username,
    password_hash: await bcrypt.hash(password, 10),
    name: name || null,
    role,
  });

  return { status: 201, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function listUsers() {
  const users = await User.findAll({ order: [['created_at', 'DESC']] });
  return { status: 200, body: { success: true, data: { users: users.map(toPublicUser) } } };
}

async function changePassword(id, password) {
  if (!password) {
    return { status: 400, body: { success: false, message: 'Thiếu password mới' } };
  }

  const user = await User.findByPk(id);

  if (!user) {
    return { status: 404, body: { success: false, message: 'User không tồn tại' } };
  }

  await user.update({
    password_hash: await bcrypt.hash(password, 10),
    updated_at: new Date(),
  });
  await revokeUserSessions(user.id);

  return { status: 200, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function disableUser(id) {
  const user = await User.findByPk(id);

  if (!user) {
    return { status: 404, body: { success: false, message: 'User không tồn tại' } };
  }

  await user.update({ is_active: false, updated_at: new Date() });
  await revokeUserSessions(user.id);

  return { status: 200, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function enableUser(id) {
  const user = await User.findByPk(id);

  if (!user) {
    return { status: 404, body: { success: false, message: 'User không tồn tại' } };
  }

  await user.update({ is_active: true, updated_at: new Date() });

  return { status: 200, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function revokeUserSessions(userId) {
  await UserSession.update(
    { revoked_at: new Date(), updated_at: new Date() },
    { where: { user_id: userId, revoked_at: null } },
  );
}

module.exports = {
  createUser,
  listUsers,
  changePassword,
  disableUser,
  enableUser,
};
