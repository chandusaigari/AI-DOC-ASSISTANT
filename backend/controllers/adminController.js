const userModel = require('../models/userModel');
const documentModel = require('../models/documentModel');
const chatModel = require('../models/chatModel');
const feedbackModel = require('../models/feedbackModel');

const adminController = {
  async getStats(req, res) {
    try {
      const stats = await userModel.getSystemStats();
      const feedbackStats = await feedbackModel.getStats();
      res.json({
        totalUsers: Number(stats.total_users || 0),
        totalDocs: Number(stats.total_docs || 0),
        totalChunks: Number(stats.total_chunks || 0),
        totalQueries: Number(stats.total_queries || 0),
        totalBytes: Number(stats.total_bytes || 0),
        totalFeedback: feedbackStats.totalFeedback,
        avgRating: feedbackStats.avgRating
      });
    } catch (err) {
      console.error('Admin getStats error:', err);
      res.status(500).json({ error: 'Failed to fetch admin system statistics.' });
    }
  },

  async getUsers(req, res) {
    try {
      const users = await userModel.getAllWithStats();
      res.json(users.map(u => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        role: u.role || 'user',
        createdAt: u.created_at,
        totalDocs: Number(u.total_docs || 0),
        totalQueries: Number(u.total_queries || 0),
        totalBytes: Number(u.total_bytes || 0)
      })));
    } catch (err) {
      console.error('Admin getUsers error:', err);
      res.status(500).json({ error: 'Failed to fetch user list.' });
    }
  },

  async updateUserRole(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { role } = req.body;

      if (!role || (role !== 'admin' && role !== 'user')) {
        return res.status(400).json({ error: 'Role must be either "admin" or "user".' });
      }

      const targetUser = await userModel.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      await userModel.updateRole(targetUserId, role);
      res.json({ message: `Role for ${targetUser.email} updated to ${role}.`, role });
    } catch (err) {
      console.error('Admin updateUserRole error:', err);
      res.status(500).json({ error: 'Failed to update user role.' });
    }
  },

  async deleteUser(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      if (targetUserId === req.userId) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
      }

      const targetUser = await userModel.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      await userModel.delete(targetUserId);
      res.json({ message: `User ${targetUser.email} and all associated data deleted successfully.` });
    } catch (err) {
      console.error('Admin deleteUser error:', err);
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  },

  async getAllDocuments(req, res) {
    try {
      const docs = await documentModel.getAllWithOwners();
      res.json(docs);
    } catch (err) {
      console.error('Admin getAllDocuments error:', err);
      res.status(500).json({ error: 'Failed to fetch platform documents.' });
    }
  },

  async deleteDocument(req, res) {
    try {
      const docId = parseInt(req.params.id, 10);
      await documentModel.deleteByAdmin(docId);
      res.json({ message: 'Document deleted successfully by admin.' });
    } catch (err) {
      console.error('Admin deleteDocument error:', err);
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  },

  async getRagLogs(req, res) {
    try {
      const logs = await chatModel.getAllLogsWithUsers(100);
      res.json(logs);
    } catch (err) {
      console.error('Admin getRagLogs error:', err);
      res.status(500).json({ error: 'Failed to fetch RAG query logs.' });
    }
  },

  async getFeedbacks(req, res) {
    try {
      const feedbacks = await feedbackModel.getAllWithUsers();
      res.json(feedbacks);
    } catch (err) {
      console.error('Admin getFeedbacks error:', err);
      res.status(500).json({ error: 'Failed to fetch user feedback list.' });
    }
  },

  async deleteFeedback(req, res) {
    try {
      const feedbackId = parseInt(req.params.id, 10);
      await feedbackModel.deleteByAdmin(feedbackId);
      res.json({ message: 'Feedback entry deleted successfully.' });
    } catch (err) {
      console.error('Admin deleteFeedback error:', err);
      res.status(500).json({ error: 'Failed to delete feedback entry.' });
    }
  }
};

module.exports = adminController;
