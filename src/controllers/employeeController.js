const employeeService = require('../services/employeeService');

async function createEmployee(req, res, next) {
  try {
    const result = await employeeService.createEmployee(req.user.id, req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function listEmployees(req, res, next) {
  try {
    const result = await employeeService.listEmployees(req.user.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function getEmployee(req, res, next) {
  try {
    const result = await employeeService.getEmployee(req.user.id, req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const result = await employeeService.updatePermissions(req.user.id, req.params.id, req.body.permissions);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await employeeService.changePassword(req.user.id, req.params.id, req.body.password);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function disableEmployee(req, res, next) {
  try {
    const result = await employeeService.disableEmployee(req.user.id, req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const result = await employeeService.deleteEmployee(req.user.id, req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function enableEmployee(req, res, next) {
  try {
    const result = await employeeService.enableEmployee(req.user.id, req.params.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  updatePermissions,
  changePassword,
  disableEmployee,
  enableEmployee,
  deleteEmployee,
};
