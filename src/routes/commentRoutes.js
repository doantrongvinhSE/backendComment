const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const commentController = require('../controllers/commentController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', commentController.listAllUserComments);
router.get('/count-today', commentController.countTodayUserComments);
router.patch('/:commentId/status', commentController.updateCommentStatus);

module.exports = router;
