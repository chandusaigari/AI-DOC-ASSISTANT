const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const threadController = require('../controllers/threadController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', sessionController.list);
router.post('/', sessionController.create);
router.patch('/:id', sessionController.rename);
router.delete('/:id', sessionController.delete);
router.get('/:sessionId/documents', sessionController.getDocuments);
router.get('/:sessionId/threads', threadController.listBySession);
router.post('/:sessionId/threads', threadController.postMessage);

module.exports = router;
