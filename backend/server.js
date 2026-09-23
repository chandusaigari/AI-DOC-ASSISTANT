const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./models/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const searchRoutes = require('./routes/search');
const chatRoutes = require('./routes/chat');
const favoriteRoutes = require('./routes/favorites');
const settingRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const feedbackRoutes = require('./routes/feedback');
const practiceRoutes = require('./routes/practice');

const sessionRoutes = require('./routes/sessions');
const threadRoutes = require('./routes/threads');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend serving
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Health check endpoint (always accessible regardless of DB state)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: db.isDbConnected() ? 'connected' : 'not connected',
    databaseMode: db.getActiveMode(),
    timestamp: new Date().toISOString()
  });
});

// Database connection check middleware for all other /api/* endpoints
app.use('/api', (req, res, next) => {
  if (!db.isDbConnected()) {
    return res.status(503).json({ error: "database isn't connected yet" });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/assistant', chatRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/practice', practiceRoutes);

// Root route serves index.html (landing page entry point)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Catch-all fallback route for non-API frontend page requests (enables SPA page refreshes)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server unconditionally and attempt DB initialization
db.initDB();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 KnowledgeAI Server running on http://localhost:${PORT}`);
  console.log(`📄 Database Status: [${db.isDbConnected() ? 'CONNECTED' : 'NOT CONNECTED (retrying...)'}]`);
  if (!process.env.GROK_API_KEY || !process.env.GROK_API_KEY.trim()) {
    console.warn(`⚠️ WARNING: GROK_API_KEY is missing from backend/.env. AI assistant requests will fail until a valid key is provided in backend/.env or User Settings.`);
  }
  console.log(`=======================================================`);
});
