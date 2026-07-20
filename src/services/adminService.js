const bcrypt = require('bcrypt');
const { User, UserSession } = require('../models');
const { toPublicUser } = require('./userPresenter');

const VALID_ROLES = ['ADMIN', 'USER'];

function parsePostLimit(value) {
  if (value === undefined) {
    return { postLimit: undefined };
  }

  const postLimit = Number(value);
  if (!Number.isInteger(postLimit) || postLimit < 0) {
    return { error: 'post_limit không hợp lệ' };
  }

  return { postLimit };
}

async function createUser({
  username, password, name, role = 'USER', post_limit: postLimitInput,
}) {
  if (!username || !password) {
    return { status: 400, body: { success: false, message: 'Thiếu username hoặc password' } };
  }

  if (!VALID_ROLES.includes(role)) {
    return { status: 400, body: { success: false, message: 'Role không hợp lệ' } };
  }

  const { postLimit, error } = parsePostLimit(postLimitInput);
  if (error) {
    return { status: 400, body: { success: false, message: error } };
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
    ...(postLimit !== undefined ? { post_limit: postLimit } : {}),
  });

  return { status: 201, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function updatePostLimit(id, postLimitInput) {
  const { postLimit, error } = parsePostLimit(postLimitInput);

  if (error || postLimit === undefined) {
    return { status: 400, body: { success: false, message: error || 'Thiếu post_limit' } };
  }

  const user = await User.findByPk(id);

  if (!user) {
    return { status: 404, body: { success: false, message: 'User không tồn tại' } };
  }

  await user.update({ post_limit: postLimit, updated_at: new Date() });

  return { status: 200, body: { success: true, data: { user: toPublicUser(user) } } };
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
  updatePostLimit,
  revokeUserSessions,
};
