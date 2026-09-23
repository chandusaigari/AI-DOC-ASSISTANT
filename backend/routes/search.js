const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/', searchController.search);
router.post('/', searchController.search);

module.exports = router;
