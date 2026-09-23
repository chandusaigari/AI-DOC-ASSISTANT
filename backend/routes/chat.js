const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.post('/', chatController.ask);
router.post('/ask', chatController.ask);
router.get('/history', chatController.getHistory);
router.delete('/history', chatController.clearHistory);

module.exports = router;
