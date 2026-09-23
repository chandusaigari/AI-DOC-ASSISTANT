const feedbackModel = require('../models/feedbackModel');

const feedbackController = {
  async submitFeedback(req, res) {
    try {
      const { category, rating, message } = req.body;
      const userId = req.userId;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Feedback message cannot be empty.' });
      }

      const parsedRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
      const feedbackId = await feedbackModel.create({
        userId,
        category: (category && category.trim()) ? category.trim() : 'General',
        rating: parsedRating,
        message: message.trim()
      });

      res.status(201).json({
        message: 'Thank you for your feedback! It has been submitted to the admin team.',
        feedbackId
      });
    } catch (err) {
      console.error('Submit feedback error:', err);
      res.status(500).json({ error: 'Failed to submit feedback.' });
    }
  },

  async getMyFeedback(req, res) {
    try {
      const userId = req.userId;
      const feedbacks = await feedbackModel.getByUser(userId);
      res.json(feedbacks);
    } catch (err) {
      console.error('Get user feedback error:', err);
      res.status(500).json({ error: 'Failed to fetch your feedback history.' });
    }
  }
};

module.exports = feedbackController;
