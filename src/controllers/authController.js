const authService = require('../services/authService');
const { toPublicUser } = require('../services/userPresenter');

async function login(req, res, next) {
  try {
    const result = await authService.login({
      username: req.body.username,
      password: req.body.password,
      deviceName: req.body.deviceName,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const result = await authService.logout(req.session);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  const result = authService.me(req.user);
  return res.status(result.status).json(result.body);
}

async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword(req.user, {
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function logoutOtherDevices(req, res, next) {
  try {
    const result = await authService.logoutOtherDevices(req.user, req.session);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  logout,
  me,
  changePassword,
  logoutOtherDevices,
  toPublicUser,
};
