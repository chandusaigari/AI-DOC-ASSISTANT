const db = require('./db');

const chunkModel = {
  async insertBatch(chunks) {
    if (!chunks || chunks.length === 0) return [];
    const insertedIds = [];
    for (const chunk of chunks) {
      const res = await db.query(
        `INSERT INTO document_chunks 
        (document_id, user_id, chunk_index, page_number, section_title, content, token_count, embedding_vector)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chunk.document_id,
          chunk.user_id,
          chunk.chunk_index,
          chunk.page_number || 1,
          chunk.section_title || 'General',
          chunk.content,
          chunk.token_count || 0,
          JSON.stringify(chunk.embedding_vector || [])
        ]
      );
      insertedIds.push(res.insertId);
    }
    return insertedIds;
  },

  async updateEmbedding(chunkId, embeddingVector) {
    return await db.query(
      'UPDATE document_chunks SET embedding_vector = ? WHERE id = ?',
      [JSON.stringify(embeddingVector || []), chunkId]
    );
  },

  async getByDocument(documentId, userId) {
    return await db.query(
      'SELECT * FROM document_chunks WHERE document_id = ? AND user_id = ? ORDER BY chunk_index ASC',
      [documentId, userId]
    );
  },

  async getByUser(userId, documentId = null, sessionId = null) {
    let sql = `
      SELECT c.*, d.session_id, d.title as document_title, d.original_filename 
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.user_id = ?
    `;
    const params = [userId];

    if (sessionId) {
      sql += ' AND d.session_id = ?';
      params.push(sessionId);
    }

    if (documentId) {
      sql += ' AND c.document_id = ?';
      params.push(documentId);
    }

    sql += ' ORDER BY c.id ASC';
    return await db.query(sql, params);
  },

  async getByPage(userId, pageNumber, documentId = null) {
    let sql = `
      SELECT c.*, d.session_id, d.title as document_title, d.original_filename 
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.user_id = ? AND c.page_number = ?
    `;
    const params = [userId, pageNumber];

    if (documentId) {
      sql += ' AND c.document_id = ?';
      params.push(documentId);
    }

    sql += ' ORDER BY c.document_id ASC, c.chunk_index ASC';
    return await db.query(sql, params);
  },

  async getByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return await db.query(
      `SELECT c.*, d.session_id, d.title as document_title, d.original_filename 
       FROM document_chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE c.id IN (${placeholders})`,
      ids
    );
  },

  async searchByKeywords(userId, tokens, documentId = null, limit = 15, sessionId = null) {
    if (!tokens || tokens.length === 0) return [];

    const caseStmts = [];
    const likeConds = [];
    const params = [];

    // For SUM of CASE WHEN LOWER(content) LIKE '%token%' THEN 1 ELSE 0 END
    tokens.forEach(token => {
      caseStmts.push('(CASE WHEN LOWER(c.content) LIKE ? THEN 1 ELSE 0 END)');
      params.push(`%${token.toLowerCase()}%`);
    });

    const matchScoreSql = caseStmts.join(' + ');

    let sql = `
      SELECT c.*, d.session_id, d.title as document_title, d.original_filename,
      (${matchScoreSql}) AS match_score
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.user_id = ?
    `;
    const baseParams = [userId];

    if (sessionId) {
      sql += ' AND d.session_id = ?';
      baseParams.push(sessionId);
    }

    if (documentId) {
      sql += ' AND c.document_id = ?';
      baseParams.push(documentId);
    }

    tokens.forEach(token => {
      likeConds.push('LOWER(c.content) LIKE ?');
      baseParams.push(`%${token.toLowerCase()}%`);
    });

    sql += ` AND (${likeConds.join(' OR ')})`;
    sql += ' ORDER BY match_score DESC, c.id ASC LIMIT ?';
    baseParams.push(limit);

    const fullParams = [...params, ...baseParams];
    return await db.query(sql, fullParams);
  }
};

module.exports = chunkModel;
