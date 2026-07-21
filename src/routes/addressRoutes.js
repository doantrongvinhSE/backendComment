const express = require('express');
const addressController = require('../controllers/addressController');

const router = express.Router();

router.get('/', addressController.list);

module.exports = router;
