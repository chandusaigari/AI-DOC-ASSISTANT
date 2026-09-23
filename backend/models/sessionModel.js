const db = require('./db');
const sessionCreationLocks = new Map();

const sessionModel = {
  async ensureGeneralSession(userId) {
    const existing = await db.query(
      'SELECT id FROM sessions WHERE user_id = ? AND name = "General" LIMIT 1',
      [userId]
    );
    if (existing && existing.length > 0) {
      return existing[0].id;
    }
    const res = await db.query(
      'INSERT INTO sessions (user_id, name, icon) VALUES (?, "General", "📁")',
      [userId]
    );
    return res.insertId;
  },

  async getByUser(userId) {
    // Ensure General session exists
    await this.ensureGeneralSession(userId);

    const sql = `
      SELECT 
        s.id,
        s.user_id,
        s.name,
        s.icon,
        s.created_at,
        s.updated_at,
        COUNT(d.id) AS document_count,
        MAX(GREATEST(s.updated_at, COALESCE(d.created_at, s.created_at))) AS last_activity
      FROM sessions s
      LEFT JOIN documents d ON d.session_id = s.id AND d.user_id = s.user_id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY last_activity DESC, s.id ASC
    `;
    return await db.query(sql, [userId]);
  },

  async getById(sessionId, userId) {
    const rows = await db.query(
      'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async create(userId, name, icon = '📁') {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Session name cannot be empty.');

    const lockKey = `${userId}:${cleanName.toLowerCase()}`;
    if (sessionCreationLocks.has(lockKey)) {
      return await sessionCreationLocks.get(lockKey);
    }

    const creationPromise = (async () => {
      // Check if session with exact same name already exists for user (case-insensitive)
      const existing = await db.query(
        'SELECT id FROM sessions WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [userId, cleanName]
      );
      if (existing && existing.length > 0) {
        return await this.getById(existing[0].id, userId);
      }

      const res = await db.query(
        'INSERT INTO sessions (user_id, name, icon) VALUES (?, ?, ?)',
        [userId, cleanName, icon || '📁']
      );
      return await this.getById(res.insertId, userId);
    })();

    sessionCreationLocks.set(lockKey, creationPromise);

    try {
      return await creationPromise;
    } finally {
      sessionCreationLocks.delete(lockKey);
    }
  },

  async update(sessionId, userId, name, icon) {
    const session = await this.getById(sessionId, userId);
    if (!session) throw new Error('Session not found.');

    const newName = name !== undefined ? name.trim() : session.name;
    const newIcon = icon !== undefined ? icon : session.icon;

    if (!newName) throw new Error('Session name cannot be empty.');

    await db.query(
      'UPDATE sessions SET name = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [newName, newIcon, sessionId, userId]
    );
    return await this.getById(sessionId, userId);
  },

  async delete(sessionId, userId, keepDocuments = true) {
    const session = await this.getById(sessionId, userId);
    if (!session) throw new Error('Session not found.');

    // Protect "General" session from being deleted if it's the only one
    const allSessions = await db.query('SELECT id FROM sessions WHERE user_id = ?', [userId]);
    if (allSessions.length <= 1) {
      throw new Error('Cannot delete your default session.');
    }

    if (keepDocuments) {
      // Reassign documents to user's "General" session
      const generalId = await this.ensureGeneralSession(userId);
      await db.query(
        'UPDATE documents SET session_id = ? WHERE session_id = ? AND user_id = ?',
        [generalId, sessionId, userId]
      );
    } else {
      // Delete documents and their chunks/images belonging to this session
      const docs = await db.query(
        'SELECT id FROM documents WHERE session_id = ? AND user_id = ?',
        [sessionId, userId]
      );
      if (docs && docs.length > 0) {
        const docIds = docs.map(d => d.id);
        const placeholders = docIds.map(() => '?').join(',');
        await db.query(`DELETE FROM document_chunks WHERE document_id IN (${placeholders})`, docIds);
        await db.query(`DELETE FROM document_images WHERE document_id IN (${placeholders})`, docIds);
        await db.query(`DELETE FROM documents WHERE id IN (${placeholders})`, docIds);
      }
    }

    // Delete threads and messages in this session
    const threads = await db.query(
      'SELECT id FROM chat_threads WHERE session_id = ? AND user_id = ?',
      [sessionId, userId]
    );
    if (threads && threads.length > 0) {
      const threadIds = threads.map(t => t.id);
      const placeholders = threadIds.map(() => '?').join(',');
      await db.query(`DELETE FROM chat_messages WHERE thread_id IN (${placeholders})`, threadIds);
      await db.query(`DELETE FROM chat_threads WHERE id IN (${placeholders})`, threadIds);
    }

    await db.query('DELETE FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
    return { success: true };
  }
};

module.exports = sessionModel;
