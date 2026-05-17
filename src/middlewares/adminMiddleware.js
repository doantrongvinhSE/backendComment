function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền admin' });
  }

  return next();
}

module.exports = adminMiddleware;
