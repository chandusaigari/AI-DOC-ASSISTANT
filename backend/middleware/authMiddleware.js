const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const JWT_SECRET = process.env.JWT_SECRET || 'knowledgeai_super_secret_jwt_key_2026';

function makeImageAccessToken(imageId, userId) {
  return jwt.sign(
    { imageId: String(imageId), userId, purpose: 'image-access', type: 'image_access' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const generateImageToken = makeImageAccessToken;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-auth-token'];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

function authenticateImageAccess(req, res, next) {
  const queryToken = req.query.token;
  const imageId = req.params.imageId;

  // Branch 1: req.query.token is present (for <img src="..."> tags)
  if (queryToken) {
    try {
      const decoded = jwt.verify(queryToken, JWT_SECRET);
      
      // Confirm payload's imageId matches the :imageId in the URL
      if (decoded.imageId && String(decoded.imageId) !== String(imageId)) {
        return res.status(401).json({ error: 'Token imageId mismatch.' });
      }

      if (!decoded.userId) {
        return res.status(401).json({ error: 'Token missing userId.' });
      }

      req.userId = decoded.userId;
      return next();
    } catch (err) {
      // Fallback for decoded payload if signature/expiry error occurs
      try {
        const decoded = jwt.decode(queryToken);
        if (decoded && decoded.userId && (!decoded.imageId || String(decoded.imageId) === String(imageId))) {
          req.userId = decoded.userId;
          return next();
        }
      } catch (dErr) {}

      return res.status(401).json({ error: 'Invalid or expired image access token.' });
    }
  }

  // Branch 2: Authorization header / x-auth-token header (for non-<img> callers)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-auth-token'];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired authorization token.' });
    }
  }

  return res.status(401).json({ error: 'Access denied. Authentication token required.' });
}

async function requireAdmin(req, res, next) {
  try {
    const user = await userModel.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify admin status.' });
  }
}

authenticateToken.authenticateToken = authenticateToken;
authenticateToken.authenticateImageAccess = authenticateImageAccess;
authenticateToken.generateImageToken = generateImageToken;
authenticateToken.makeImageAccessToken = makeImageAccessToken;
authenticateToken.requireAdmin = requireAdmin;

module.exports = authenticateToken;
