const express = require('express');
const router = express.Router();
const threadController = require('../controllers/threadController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/recent', threadController.listRecent);
router.get('/:threadId/messages', threadController.getMessages);
router.post('/:threadId/messages', threadController.postMessage);

module.exports = router;
