const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const documentController = require('../controllers/documentController');
const documentImageModel = require('../models/documentImageModel');
const authenticateToken = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '../uploads/files');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 }
});

router.get('/images/:imageId', async (req, res) => {
  const { imageId } = req.params;
  const { token } = req.query;
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  console.log("image auth debug:", { imageId, token: !!token, authHeader: !!authHeader });

  let userId = null;
  const JWT_SECRET = process.env.JWT_SECRET || 'knowledgeai_super_secret_jwt_key_2026';

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if ((payload.purpose !== "image-access" && payload.type !== "image_access") || String(payload.imageId) !== String(imageId)) {
        return res.status(401).json({ message: "Invalid image token." });
      }
      userId = payload.userId;
    } catch (err) {
      return res.status(401).json({ message: "Image token expired or invalid." });
    }
  } else if (authHeader) {
    try {
      const headerToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : authHeader;
      const payload = jwt.verify(headerToken, JWT_SECRET);
      userId = payload.id || payload.userId;
    } catch (err) {
      return res.status(401).json({ message: "Unauthorized." });
    }
  } else {
    return res.status(401).json({ message: "No credentials provided." });
  }

  try {
    const img = await documentImageModel.getById(imageId, userId);
    if (!img) return res.status(404).json({ message: "Image not found." });
    if (!fs.existsSync(img.file_path)) return res.status(404).json({ message: "File missing on disk." });

    res.sendFile(path.resolve(img.file_path));
  } catch (err) {
    console.error("Get image error:", err);
    res.status(500).json({ message: "Failed to retrieve image." });
  }
});

router.use(authenticateToken);

router.get('/stats', documentController.getStats);
router.get('/recent', documentController.getRecent);
router.get('/', documentController.getDocuments);
router.post('/reindex', documentController.reindexDocuments);
router.post('/upload', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File size exceeds the ${MAX_UPLOAD_MB}MB limit.` });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Invalid file upload.' });
    }
    next();
  });
}, documentController.uploadDocument);
router.get('/:id/images', documentController.getDocumentImages);
router.get('/:id', documentController.getDocumentById);
router.post('/:id/favorite', documentController.toggleFavorite);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
