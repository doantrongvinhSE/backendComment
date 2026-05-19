const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const salerController = require('../controllers/salerController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', salerController.listSalers);

module.exports = router;
