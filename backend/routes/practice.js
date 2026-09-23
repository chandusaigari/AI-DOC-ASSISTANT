const express = require('express');
const router = express.Router();
const practiceController = require('../controllers/practiceController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/generate-mcq', practiceController.generateMCQ);
router.post('/generate-viva', practiceController.generateViva);
router.post('/evaluate-viva', practiceController.evaluateViva);

module.exports = router;
