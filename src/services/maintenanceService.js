const { MaintenanceState } = require('../models');

const SINGLETON_ID = 1;

function presentMaintenanceState(state) {
  return {
    is_enabled: state.is_enabled,
    message: state.message,
    updated_at: state.updated_at,
  };
}

async function findOrCreateState() {
  const [state] = await MaintenanceState.findOrCreate({
    where: { id: SINGLETON_ID },
    defaults: { id: SINGLETON_ID, is_enabled: false, message: null },
  });

  return state;
}

async function getMaintenanceState() {
  const state = await findOrCreateState();
  return { status: 200, body: { success: true, data: presentMaintenanceState(state) } };
}

async function setMaintenanceState({ enabled, message }) {
  if (typeof enabled !== 'boolean') {
    return { status: 400, body: { success: false, message: 'Thiếu hoặc sai kiểu trường enabled' } };
  }

  if (message !== undefined && message !== null && typeof message !== 'string') {
    return { status: 400, body: { success: false, message: 'Trường message không hợp lệ' } };
  }

  const state = await findOrCreateState();
  await state.update({
    is_enabled: enabled,
    message: message ?? null,
    updated_at: new Date(),
  });

  return { status: 200, body: { success: true, data: presentMaintenanceState(state) } };
}

async function isMaintenanceEnabled() {
  const state = await findOrCreateState();
  return { is_enabled: state.is_enabled, message: state.message };
}

module.exports = {
  getMaintenanceState,
  setMaintenanceState,
  isMaintenanceEnabled,
};
