const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', feedbackController.submitFeedback);
router.get('/mine', feedbackController.getMyFeedback);

module.exports = router;
