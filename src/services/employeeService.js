const bcrypt = require('bcrypt');
const { User } = require('../models');
const { toPublicUser } = require('./userPresenter');
const { revokeUserSessions } = require('./adminService');
const { MODULES } = require('../constants/modules');

function normalizePermissions(permissions) {
  const input = permissions || {};

  if (typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Permissions không hợp lệ' };
  }

  const invalidKeys = Object.keys(input).filter((key) => !MODULES.includes(key));
  if (invalidKeys.length > 0) {
    return { error: `Module không hợp lệ: ${invalidKeys.join(', ')}` };
  }

  const normalized = {};
  for (const moduleName of MODULES) {
    normalized[moduleName] = input[moduleName] === true;
  }

  return { permissions: normalized };
}

async function findOwnedEmployee(agencyId, id) {
  return User.findOne({
    where: { id, parent_user_id: agencyId, role: 'EMPLOYEE' },
  });
}

async function createEmployee(agencyId, { username, password, name, permissions }) {
  if (!username || !password) {
    return { status: 400, body: { success: false, message: 'Thiếu username hoặc password' } };
  }

  const normalized = normalizePermissions(permissions);
  if (normalized.error) {
    return { status: 400, body: { success: false, message: normalized.error } };
  }

  const existedUser = await User.findOne({ where: { username } });

  if (existedUser) {
    return { status: 409, body: { success: false, message: 'Username đã tồn tại' } };
  }

  const employee = await User.create({
    username,
    password_hash: await bcrypt.hash(password, 10),
    name: name || null,
    role: 'EMPLOYEE',
    parent_user_id: agencyId,
    permissions: normalized.permissions,
  });

  return { status: 201, body: { success: true, data: { employee: toPublicUser(employee) } } };
}

async function listEmployees(agencyId) {
  const employees = await User.findAll({
    where: { parent_user_id: agencyId, role: 'EMPLOYEE' },
    order: [['created_at', 'DESC']],
  });

  return { status: 200, body: { success: true, data: { employees: employees.map(toPublicUser) } } };
}

async function getEmployee(agencyId, id) {
  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  return { status: 200, body: { success: true, data: { employee: toPublicUser(employee) } } };
}

async function updatePermissions(agencyId, id, permissions) {
  const normalized = normalizePermissions(permissions);
  if (normalized.error) {
    return { status: 400, body: { success: false, message: normalized.error } };
  }

  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  await employee.update({ permissions: normalized.permissions, updated_at: new Date() });

  return { status: 200, body: { success: true, data: { employee: toPublicUser(employee) } } };
}

async function changePassword(agencyId, id, password) {
  if (!password) {
    return { status: 400, body: { success: false, message: 'Thiếu password mới' } };
  }

  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  await employee.update({
    password_hash: await bcrypt.hash(password, 10),
    updated_at: new Date(),
  });
  await revokeUserSessions(employee.id);

  return { status: 200, body: { success: true, data: { employee: toPublicUser(employee) } } };
}

async function disableEmployee(agencyId, id) {
  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  await employee.update({ is_active: false, updated_at: new Date() });
  await revokeUserSessions(employee.id);

  return { status: 200, body: { success: true, data: { employee: toPublicUser(employee) } } };
}

async function deleteEmployee(agencyId, id) {
  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  await revokeUserSessions(employee.id);
  await employee.destroy();

  return { status: 200, body: { success: true } };
}

async function enableEmployee(agencyId, id) {
  const employee = await findOwnedEmployee(agencyId, id);

  if (!employee) {
    return { status: 404, body: { success: false, message: 'Nhân viên không tồn tại' } };
  }

  await employee.update({ is_active: true, updated_at: new Date() });

  return { status: 200, body: { success: true, data: { employee: toPublicUser(employee) } } };
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
