const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'knowledgeai_super_secret_jwt_key_2026';

const authController = {
  async register(req, res) {
    try {
      const { fullName, email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
      }

      const finalName = (fullName && fullName.trim()) ? fullName.trim() : email.split('@')[0];

      const existingUser = await userModel.findByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await userModel.create({
        fullName: finalName,
        email: email.toLowerCase().trim(),
        passwordHash
      });

      const token = jwt.sign({ userId, email: email.toLowerCase().trim() }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        message: 'Account created successfully.',
        token,
        user: { id: userId, fullName: finalName, email: email.toLowerCase().trim() }
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Server error during registration.' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await userModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful.',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          hasGrokApiKey: Boolean(user.grok_api_key)
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error during login.' });
    }
  },

  async me(req, res) {
    try {
      const user = await userModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        hasGrokApiKey: Boolean(user.grok_api_key),
        createdAt: user.created_at
      });
    } catch (err) {
    }
  }
};

module.exports = authController;
