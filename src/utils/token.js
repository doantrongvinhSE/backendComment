const crypto = require('crypto');

function createRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSessionExpiry() {
  const days = Number(process.env.SESSION_DAYS || 30);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
  createRawToken,
  hashToken,
  getSessionExpiry,
};
