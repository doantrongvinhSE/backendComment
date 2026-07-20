function agencyMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'USER') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý nhân viên' });
  }
  return next();
}

module.exports = agencyMiddleware;
