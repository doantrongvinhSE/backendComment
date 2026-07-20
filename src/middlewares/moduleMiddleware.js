const { MODULES } = require('../constants/modules');

function requireModule(moduleName) {
  if (!MODULES.includes(moduleName)) {
    throw new Error(`Module không hợp lệ: ${moduleName}`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
    }

    if (req.user.role === 'ADMIN' || req.user.role === 'USER') {
      return next();
    }

    const permissions = req.user.permissions || {};
    if (permissions[moduleName] === true) {
      return next();
    }

    return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập chức năng này' });
  };
}

module.exports = requireModule;
