const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const postController = require('../controllers/postController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', postController.createUserPost);
router.get('/', postController.listUserPosts);
router.get('/:userPostId', postController.getUserPost);
router.patch('/:userPostId', postController.updateUserPost);
router.delete('/:userPostId', postController.deleteUserPost);

module.exports = router;
