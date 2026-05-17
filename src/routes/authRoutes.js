const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-other-devices', authMiddleware, authController.logoutOtherDevices);
router.patch('/password', authMiddleware, authController.changePassword);

module.exports = router;
