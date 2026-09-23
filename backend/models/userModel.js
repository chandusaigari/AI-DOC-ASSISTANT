const db = require('./db');

const userModel = {
  async findByEmail(email) {
    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows.length > 0 ? rows[0] : null;
  },

  async findByGoogleId(googleId) {
    const rows = await db.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
    return rows.length > 0 ? rows[0] : null;
  },

  async linkGoogleId(userId, googleId) {
    await db.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, userId]);
  },

  async createGoogleUser({ fullName, email, googleId }) {
    const res = await db.query(
      'INSERT INTO users (full_name, email, password, google_id) VALUES (?, ?, NULL, ?)',
      [fullName, email, googleId]
    );
    return res.insertId;
  },

  async findById(id) {
    const rows = await db.query('SELECT id, full_name, email, role, google_id, grok_api_key, created_at FROM users WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  async create({ fullName, email, passwordHash }) {
    const res = await db.query(
      'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
      [fullName, email, passwordHash]
    );
    return res.insertId;
  },

  async updateApiKey(userId, apiKey) {
    await db.query('UPDATE users SET grok_api_key = ? WHERE id = ?', [apiKey, userId]);
  },

  async updateProfile(userId, fullName, email) {
    await db.query('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [fullName, email, userId]);
  },

  async updatePassword(userId, passwordHash) {
    await db.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, userId]);
  },

  async delete(userId) {
    await db.query('DELETE FROM document_chunks WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM favorites WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM chat_history WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM documents WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  },

  async getAllWithStats() {
    return await db.query(`
      SELECT u.id, u.full_name, u.email, u.role, u.created_at,
        (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) AS total_docs,
        (SELECT COUNT(*) FROM chat_history c WHERE c.user_id = u.id) AS total_queries,
        (SELECT COALESCE(SUM(file_size), 0) FROM documents d WHERE d.user_id = u.id) AS total_bytes
      FROM users u
      ORDER BY u.id DESC
    `);
  },

  async updateRole(userId, role) {
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  },

  async getSystemStats() {
    const rows = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM documents) AS total_docs,
        (SELECT COUNT(*) FROM document_chunks) AS total_chunks,
        (SELECT COUNT(*) FROM chat_history) AS total_queries,
        (SELECT COALESCE(SUM(file_size), 0) FROM documents) AS total_bytes
    `);
    return rows[0] || { total_users: 0, total_docs: 0, total_chunks: 0, total_queries: 0, total_bytes: 0 };
  }
};

module.exports = userModel;
