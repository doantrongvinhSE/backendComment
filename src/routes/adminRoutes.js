const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.post('/users', adminController.createUser);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/password', adminController.changePassword);
router.patch('/users/:id/disable', adminController.disableUser);
router.patch('/users/:id/enable', adminController.enableUser);

module.exports = router;
