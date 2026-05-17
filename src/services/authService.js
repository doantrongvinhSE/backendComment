const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, UserSession } = require('../models');
const { createRawToken, hashToken, getSessionExpiry } = require('../utils/token');
const { toPublicUser } = require('./userPresenter');

async function login({ username, password, deviceName, userAgent, ipAddress }) {
  if (!username || !password) {
    return { status: 400, body: { success: false, message: 'Thiếu username hoặc password' } };
  }

  const user = await User.findOne({ where: { username } });

  if (!user || !user.is_active) {
    return { status: 401, body: { success: false, message: 'Thông tin đăng nhập không hợp lệ' } };
  }

  const passwordMatched = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatched) {
    return { status: 401, body: { success: false, message: 'Thông tin đăng nhập không hợp lệ' } };
  }

  const rawToken = createRawToken();

  await UserSession.create({
    user_id: user.id,
    token_hash: hashToken(rawToken),
    device_name: deviceName || null,
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
    expires_at: getSessionExpiry(),
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        token: rawToken,
        user: toPublicUser(user),
      },
    },
  };
}

async function logout(session) {
  await session.update({ revoked_at: new Date(), updated_at: new Date() });
  return { status: 200, body: { success: true } };
}

function me(user) {
  return { status: 200, body: { success: true, data: { user: toPublicUser(user) } } };
}

async function changePassword(user, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    return { status: 400, body: { success: false, message: 'Thiếu mật khẩu cũ hoặc mật khẩu mới' } };
  }

  const passwordMatched = await bcrypt.compare(currentPassword, user.password_hash);

  if (!passwordMatched) {
    return { status: 400, body: { success: false, message: 'Mật khẩu cũ không đúng' } };
  }

  await user.update({
    password_hash: await bcrypt.hash(newPassword, 10),
    updated_at: new Date(),
  });

  return { status: 200, body: { success: true } };
}

async function logoutOtherDevices(user, currentSession) {
  const [revokedCount] = await UserSession.update(
    { revoked_at: new Date(), updated_at: new Date() },
    {
      where: {
        user_id: user.id,
        id: { [Op.ne]: currentSession.id },
        revoked_at: null,
      },
    },
  );

  return { status: 200, body: { success: true, data: { revoked_count: revokedCount } } };
}

module.exports = {
  login,
  logout,
  me,
  changePassword,
  logoutOtherDevices,
};
