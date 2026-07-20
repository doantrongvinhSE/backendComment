const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const requireModule = require('../middlewares/moduleMiddleware');
const salerController = require('../controllers/salerController');

const router = express.Router();

router.use(authMiddleware, requireModule('salers'));

router.get('/', salerController.listSalers);

module.exports = router;
