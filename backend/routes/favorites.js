const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/', favoriteController.getFavorites);
router.post('/', favoriteController.addFavorite);
router.post('/message', favoriteController.addMessageFavorite);
router.delete('/message/:id', favoriteController.removeFavorite);
router.delete('/document/:id', favoriteController.removeFavorite);
router.delete('/:id', favoriteController.removeFavorite);

module.exports = router;
