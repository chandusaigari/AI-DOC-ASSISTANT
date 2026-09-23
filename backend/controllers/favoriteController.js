const favoriteModel = require('../models/favoriteModel');

const favoriteController = {
  async getFavorites(req, res) {
    try {
      const favorites = await favoriteModel.getFavoritesByUser(req.userId);
      res.json(favorites);
    } catch (err) {
      console.error('getFavorites error:', err);
      res.status(500).json({ error: 'Failed to fetch favorites.' });
    }
  },

  async addFavorite(req, res) {
    try {
      const { documentId, itemType, messageId, title, content, citations, sessionId } = req.body;

      if (itemType === 'message' || (content && !documentId)) {
        const result = await favoriteModel.addFavoriteMessage(req.userId, { messageId, title, content, citations, sessionId });
        if (!result) return res.status(400).json({ error: 'Failed to bookmark AI message.' });
        return res.json({ message: 'AI message and PDF documents bookmarked.', favorite_id: result.id, is_favorite: true });
      }

      if (!documentId) {
        return res.status(400).json({ error: 'documentId or message payload is required.' });
      }

      await favoriteModel.addFavoriteDocument(req.userId, documentId);
      res.json({ message: 'Document added to favorites.', is_favorite: true });
    } catch (err) {
      console.error('addFavorite error:', err);
      res.status(500).json({ error: 'Failed to add favorite.' });
    }
  },

  async addMessageFavorite(req, res) {
    try {
      const { messageId, title, content, citations, sessionId } = req.body;
      if (!content && !title) {
        return res.status(400).json({ error: 'Content or title is required for AI message favorite.' });
      }
      const result = await favoriteModel.addFavoriteMessage(req.userId, { messageId, title, content, citations, sessionId });
      if (!result) return res.status(400).json({ error: 'Failed to bookmark AI message.' });
      res.json({ message: 'AI message and PDF documents bookmarked successfully.', favorite_id: result.id, is_favorite: true });
    } catch (err) {
      console.error('addMessageFavorite error:', err);
      res.status(500).json({ error: 'Failed to bookmark AI message.' });
    }
  },

  async removeFavorite(req, res) {
    try {
      const idParam = req.params.id || req.params.documentId;
      await favoriteModel.removeFavoriteById(req.userId, idParam);
      await favoriteModel.removeFavoriteDocument(req.userId, idParam);
      await favoriteModel.removeFavoriteMessage(req.userId, idParam);

      res.json({ message: 'Favorite removed successfully.', is_favorite: false });
    } catch (err) {
      console.error('removeFavorite error:', err);
      res.status(500).json({ error: 'Failed to remove favorite.' });
    }
  }
};

module.exports = favoriteController;
