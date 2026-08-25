const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const addressController = require('../controllers/addressController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', addressController.list);

module.exports = router;
