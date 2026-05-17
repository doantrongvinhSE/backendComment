const adminService = require('../services/adminService');

async function createUser(req, res, next) {
  try {
    const result = await adminService.createUser(req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const result = await adminService.listUsers();
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await adminService.changePassword(req.params.id, req.body.password);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function disableUser(req, res, next) {
  try {
    const result = await adminService.disableUser(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function enableUser(req, res, next) {
  try {
    const result = await adminService.enableUser(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  changePassword,
  disableUser,
  enableUser,
};
