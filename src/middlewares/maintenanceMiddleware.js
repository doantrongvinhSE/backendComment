const maintenanceService = require('../services/maintenanceService');

async function maintenanceMiddleware(req, res, next) {
  try {
    const state = await maintenanceService.isMaintenanceEnabled();

    if (!state.is_enabled) {
      return next();
    }

    return res.status(503).json({
      success: false,
      message: state.message || 'Hệ thống đang bảo trì, vui lòng quay lại sau.',
      maintenance: true,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = maintenanceMiddleware;
