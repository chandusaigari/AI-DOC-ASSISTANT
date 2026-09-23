const userModel = require('../models/userModel');
const db = require('../models/db');

const settingController = {
  async getSettings(req, res) {
    try {
      const user = await userModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      res.json({
        profile: {
          fullName: user.full_name,
          email: user.email
        },
        grokApiKey: user.grok_api_key ? '••••••••' + user.grok_api_key.slice(-4) : '',
        hasCustomKey: Boolean(user.grok_api_key),
        system: {
          databaseMode: db.getActiveMode(),
          grokEnvKeySet: Boolean(process.env.GROK_API_KEY)
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve settings.' });
    }
  },

  async updateSettings(req, res) {
    try {
      const { fullName, email, grokApiKey } = req.body;
      const userId = req.userId;

      if (fullName && email) {
        await userModel.updateProfile(userId, fullName.trim(), email.toLowerCase().trim());
      }

      if (grokApiKey !== undefined) {
        await userModel.updateApiKey(userId, grokApiKey.trim());
      }

      res.json({ message: 'Settings updated successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update settings.' });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const bcrypt = require('bcryptjs');
      const user = await userModel.findById(userId);
      const userWithPwd = await userModel.findByEmail(user.email);

      const match = await bcrypt.compare(currentPassword, userWithPwd.password);
      if (!match) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await userModel.updatePassword(userId, newHash);

      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to change password.' });
    }
  },

  async deleteAccount(req, res) {
    try {
      await userModel.delete(req.userId);
      res.json({ message: 'Account deleted successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete account.' });
    }
  }
};

module.exports = settingController;
