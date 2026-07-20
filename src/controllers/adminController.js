const adminService = require('../services/adminService');
const maintenanceService = require('../services/maintenanceService');

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

async function updatePostLimit(req, res, next) {
  try {
    const result = await adminService.updatePostLimit(req.params.id, req.body.post_limit);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getMaintenance(req, res, next) {
  try {
    const result = await maintenanceService.getMaintenanceState();
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function setMaintenance(req, res, next) {
  try {
    const result = await maintenanceService.setMaintenanceState(req.body);
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
  updatePostLimit,
  getMaintenance,
  setMaintenance,
};
