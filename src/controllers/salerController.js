const salerService = require('../services/salerService');

async function listSalers(req, res, next) {
  try {
    const result = await salerService.listSalers(req.user.id);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSalers,
};
