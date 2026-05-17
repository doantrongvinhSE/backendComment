const express = require('express');
const ingestController = require('../controllers/ingestController');

const router = express.Router();

router.get('/posts', ingestController.listPosts);
router.patch('/posts/:fbPostId', ingestController.updatePostLastCount);
router.post('/comments/bulk', ingestController.ingestCommentsBulk);

module.exports = router;
