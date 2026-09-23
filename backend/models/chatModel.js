const db = require('./db');

const chatModel = {
  async save({ userId, sessionId, threadId, documentId, question, answer, citations }) {
    const res = await db.query(
      `INSERT INTO chat_history (user_id, session_id, thread_id, document_id, question, answer, citations) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, sessionId || null, threadId || null, documentId || null, question, answer, JSON.stringify(citations || [])]
    );
    return res.insertId;
  },

  async getHistory(userId, limit = 50) {
    const rows = await db.query(
      `SELECT ch.*, d.title as document_title, d.session_id as doc_session_id, s.name as session_name, s.icon as session_icon
       FROM chat_history ch
       LEFT JOIN documents d ON ch.document_id = d.id
       LEFT JOIN sessions s ON ch.session_id = s.id
       WHERE ch.user_id = ?
       ORDER BY ch.created_at DESC LIMIT ?`,
      [userId, limit]
    );

    // Get fallback General session for user if any session_id is missing
    let defaultSessionId = null;
    try {
      const generalSession = await db.query("SELECT id FROM sessions WHERE user_id = ? AND name = 'General' LIMIT 1", [userId]);
      if (generalSession && generalSession[0]) {
        defaultSessionId = generalSession[0].id;
      } else {
        const anySession = await db.query("SELECT id FROM sessions WHERE user_id = ? LIMIT 1", [userId]);
        if (anySession && anySession[0]) defaultSessionId = anySession[0].id;
      }
    } catch (e) {}

    return (rows || []).map(row => {
      const sessionId = row.session_id || row.doc_session_id || defaultSessionId;
      return {
        ...row,
        session_id: sessionId,
        thread_id: row.thread_id,
        citations: typeof row.citations === 'string' ? JSON.parse(row.citations || '[]') : row.citations
      };
    });
  },

  async clearHistory(userId) {
    await db.query('DELETE FROM chat_history WHERE user_id = ?', [userId]);
  },

  async getAllLogsWithUsers(limit = 100) {
    const rows = await db.query(
      `SELECT ch.*, u.email as user_email, u.full_name as user_name, d.title as document_title
       FROM chat_history ch
       JOIN users u ON ch.user_id = u.id
       LEFT JOIN documents d ON ch.document_id = d.id
       ORDER BY ch.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map(row => ({
      ...row,
      citations: typeof row.citations === 'string' ? JSON.parse(row.citations || '[]') : row.citations
    }));
  }
};

module.exports = chatModel;
