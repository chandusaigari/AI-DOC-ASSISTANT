const db = require('./db');

const documentModel = {
  async getAllByUser(userId, search = '', sessionId = null) {
    let sql = 'SELECT * FROM documents WHERE user_id = ?';
    const params = [userId];

    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }

    if (search) {
      sql += ' AND (title LIKE ? OR original_filename LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    return await db.query(sql, params);
  },

  async getById(id, userId) {
    const rows = await db.query('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, userId]);
    return rows.length > 0 ? rows[0] : null;
  },

  async create({ userId, sessionId, title, originalFilename, filePath, fileType, fileSize, totalPages, extractedText }) {
    const res = await db.query(
      `INSERT INTO documents 
      (user_id, session_id, title, original_filename, file_path, file_type, file_size, total_pages, extracted_text) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, sessionId || null, title, originalFilename, filePath, fileType, fileSize, totalPages || 0, extractedText || '']
    );
    return res.insertId;
  },

  async updateChunkCount(id, totalChunks) {
    await db.query('UPDATE documents SET total_chunks = ? WHERE id = ?', [totalChunks, id]);
  },

  async updateStatus(id, status, totalPages = 0, extractedText = '') {
    await db.query(
      'UPDATE documents SET status = ?, total_pages = ?, extracted_text = ? WHERE id = ?',
      [status, totalPages, extractedText, id]
    );
  },

  async toggleFavorite(id, userId) {
    const doc = await this.getById(id, userId);
    if (!doc) return null;
    const newFav = doc.is_favorite ? 0 : 1;
    await db.query('UPDATE documents SET is_favorite = ? WHERE id = ? AND user_id = ?', [newFav, id, userId]);
    return newFav;
  },

  async delete(id, userId) {
    await db.query('DELETE FROM document_chunks WHERE document_id = ? AND user_id = ?', [id, userId]);
    await db.query('DELETE FROM favorites WHERE document_id = ? AND user_id = ?', [id, userId]);
    await db.query('DELETE FROM documents WHERE id = ? AND user_id = ?', [id, userId]);
  },

  async getStats(userId) {
    const totalDocsRes = await db.query('SELECT COUNT(*) as count, SUM(file_size) as total_bytes FROM documents WHERE user_id = ?', [userId]);
    const totalChunksRes = await db.query('SELECT COUNT(*) as count FROM document_chunks WHERE user_id = ?', [userId]);
    const totalQueriesRes = await db.query('SELECT COUNT(*) as count FROM chat_history WHERE user_id = ?', [userId]);

    const totalDocs = (totalDocsRes[0] && totalDocsRes[0].count) ? totalDocsRes[0].count : (totalDocsRes[0] ? totalDocsRes[0]['COUNT(*)'] || 0 : 0);
    const totalBytes = (totalDocsRes[0] && totalDocsRes[0].total_bytes) ? totalDocsRes[0].total_bytes : 0;
    const totalChunks = (totalChunksRes[0] && totalChunksRes[0].count) ? totalChunksRes[0].count : (totalChunksRes[0] ? totalChunksRes[0]['COUNT(*)'] || 0 : 0);
    const totalQueries = (totalQueriesRes[0] && totalQueriesRes[0].count) ? totalQueriesRes[0].count : (totalQueriesRes[0] ? totalQueriesRes[0]['COUNT(*)'] || 0 : 0);

    return {
      totalDocs: Number(totalDocs || 0),
      totalBytes: Number(totalBytes || 0),
      totalChunks: Number(totalChunks || 0),
      totalQueries: Number(totalQueries || 0)
    };
  },

  async getAllWithOwners() {
    return await db.query(`
      SELECT d.*, u.email as owner_email, u.full_name as owner_name
      FROM documents d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
  },

  async deleteByAdmin(id) {
    await db.query('DELETE FROM document_chunks WHERE document_id = ?', [id]);
    await db.query('DELETE FROM favorites WHERE document_id = ?', [id]);
    await db.query('DELETE FROM documents WHERE id = ?', [id]);
  }
};

module.exports = documentModel;
