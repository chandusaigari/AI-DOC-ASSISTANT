const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireAdmin } = authenticateToken;

// All admin routes require valid auth token + admin role
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/documents', adminController.getAllDocuments);
router.delete('/documents/:id', adminController.deleteDocument);
router.get('/logs', adminController.getRagLogs);
router.get('/feedbacks', adminController.getFeedbacks);
router.delete('/feedbacks/:id', adminController.deleteFeedback);

module.exports = router;
