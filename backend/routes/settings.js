const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/', settingController.getSettings);
router.put('/', settingController.updateSettings);
router.post('/password', settingController.changePassword);
router.delete('/', settingController.deleteAccount);

module.exports = router;
