const sessionModel = require('../models/sessionModel');
const documentModel = require('../models/documentModel');

const sessionController = {
  async list(req, res) {
    try {
      const userId = req.userId;
      const sessions = await sessionModel.getByUser(userId);
      res.json(sessions);
    } catch (err) {
      console.error('Session list error:', err.message);
      res.status(500).json({ error: 'Failed to list sessions.' });
    }
  },

  async create(req, res) {
    try {
      const userId = req.userId;
      const { name, icon } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Session name is required.' });
      }
      const session = await sessionModel.create(userId, name, icon);
      res.status(201).json(session);
    } catch (err) {
      console.error('Session create error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to create session.' });
    }
  },

  async rename(req, res) {
    try {
      const userId = req.userId;
      const sessionId = req.params.id;
      const { name, icon } = req.body;
      const updated = await sessionModel.update(sessionId, userId, name, icon);
      res.json(updated);
    } catch (err) {
      console.error('Session rename error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to rename session.' });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.userId;
      const sessionId = req.params.id;
      const keepDocuments = req.query.keepDocuments !== 'false' && req.body.keepDocuments !== false;
      const result = await sessionModel.delete(sessionId, userId, keepDocuments);
      res.json(result);
    } catch (err) {
      console.error('Session delete error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to delete session.' });
    }
  },

  async getDocuments(req, res) {
    try {
      const userId = req.userId;
      const sessionId = req.params.id;
      const search = req.query.search || '';
      const docs = await documentModel.getAllByUser(userId, search, sessionId);
      res.json(docs);
    } catch (err) {
      console.error('Session getDocuments error:', err.message);
      res.status(500).json({ error: 'Failed to fetch session documents.' });
    }
  }
};

module.exports = sessionController;
