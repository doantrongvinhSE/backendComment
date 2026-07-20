const { Op } = require('sequelize');
const { UserSession, User } = require('../models');
const { hashToken } = require('../utils/token');

async function authMiddleware(req, res, next) {
  try {
    const authorization = req.get('Authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
    }

    const session = await UserSession.findOne({
      where: {
        token_hash: hashToken(token),
        revoked_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      include: [{
        model: User,
        as: 'user',
        include: [{ model: User, as: 'agency' }],
      }],
    });

    if (!session || !session.user || !session.user.is_active) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ' });
    }

    if (session.user.role === 'EMPLOYEE') {
      const agency = session.user.agency;
      if (!agency || !agency.is_active) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ' });
      }
      req.ownerId = agency.id;
    } else {
      req.ownerId = session.user.id;
    }

    req.user = session.user;
    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
