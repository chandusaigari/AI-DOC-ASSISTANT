const db = require('./db');

const threadModel = {
  async createThread(sessionId, userId, title = null) {
    const cleanTitle = title ? title.trim() : null;
    const res = await db.query(
      'INSERT INTO chat_threads (session_id, user_id, title) VALUES (?, ?, ?)',
      [sessionId, userId, cleanTitle]
    );
    return await this.getById(res.insertId, userId);
  },

  async getById(threadId, userId) {
    const sql = `
      SELECT t.*, s.name as session_name, s.icon as session_icon
      FROM chat_threads t
      JOIN sessions s ON t.session_id = s.id
      WHERE t.id = ? AND t.user_id = ?
    `;
    const rows = await db.query(sql, [threadId, userId]);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async getBySession(sessionId, userId) {
    const sql = `
      SELECT 
        t.id,
        t.session_id,
        t.user_id,
        t.title,
        t.created_at,
        t.updated_at,
        (
          SELECT content 
          FROM chat_messages 
          WHERE thread_id = t.id 
          ORDER BY id DESC LIMIT 1
        ) AS last_message_preview,
        (
          SELECT created_at 
          FROM chat_messages 
          WHERE thread_id = t.id 
          ORDER BY id DESC LIMIT 1
        ) AS last_activity
      FROM chat_threads t
      WHERE t.session_id = ? AND t.user_id = ?
      ORDER BY COALESCE(last_activity, t.updated_at) DESC, t.id DESC
    `;
    return await db.query(sql, [sessionId, userId]);
  },

  async getByUserRecent(userId, limit = 10) {
    const sql = `
      SELECT 
        t.id,
        t.session_id,
        t.user_id,
        COALESCE(t.title, 'New Chat') as title,
        t.updated_at,
        s.name as session_name,
        s.icon as session_icon,
        (
          SELECT content 
          FROM chat_messages 
          WHERE thread_id = t.id 
          ORDER BY id DESC LIMIT 1
        ) AS last_message_preview
      FROM chat_threads t
      JOIN sessions s ON t.session_id = s.id
      WHERE t.user_id = ?
      ORDER BY t.updated_at DESC, t.id DESC
      LIMIT ?
    `;
    return await db.query(sql, [userId, limit]);
  },

  async updateTitle(threadId, userId, title) {
    const cleanTitle = (title || '').trim().substring(0, 100);
    if (!cleanTitle) return;
    await db.query(
      'UPDATE chat_threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [cleanTitle, threadId, userId]
    );
  },

  async addMessage(threadId, role, content, sources = null, images = null) {
    const sourcesJson = sources ? JSON.stringify(sources) : null;
    const imagesJson = images ? JSON.stringify(images) : null;

    const res = await db.query(
      'INSERT INTO chat_messages (thread_id, role, content, sources, images) VALUES (?, ?, ?, ?, ?)',
      [threadId, role, content, sourcesJson, imagesJson]
    );

    // Touch thread updated_at
    await db.query(
      'UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [threadId]
    );

    return {
      id: res.insertId,
      thread_id: threadId,
      role,
      content,
      sources,
      images,
      created_at: new Date()
    };
  },

  async getMessages(threadId) {
    const rows = await db.query(
      'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY id ASC',
      [threadId]
    );

    return (rows || []).map(r => ({
      id: r.id,
      thread_id: r.thread_id,
      role: r.role,
      content: r.content,
      sources: r.sources ? JSON.parse(r.sources) : [],
      images: r.images ? JSON.parse(r.images) : [],
      created_at: r.created_at
    }));
  }
};

module.exports = threadModel;
