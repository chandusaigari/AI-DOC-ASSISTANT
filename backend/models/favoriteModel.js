const db = require('./db');

const favoriteModel = {
  async getFavoritesByUser(userId) {
    const rows = await db.query(
      `SELECT f.id as favorite_id, f.item_type, f.created_at as favorited_at,
              f.document_id, f.message_id, f.title as fav_title, f.content as fav_content, f.citations as fav_citations,
              d.title as doc_title, d.file_type, d.file_size, d.total_pages, d.total_chunks, d.session_id
       FROM favorites f
       LEFT JOIN documents d ON f.document_id = d.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return rows.map(r => {
      const type = r.item_type || (r.document_id ? 'document' : 'message');
      if (type === 'message') {
        let parsedCitations = [];
        try {
          if (r.fav_citations) parsedCitations = typeof r.fav_citations === 'string' ? JSON.parse(r.fav_citations) : r.fav_citations;
        } catch (e) {}

        return {
          id: r.favorite_id,
          favorite_id: r.favorite_id,
          item_type: 'message',
          message_id: r.message_id,
          title: r.fav_title || 'AI Assistant Answer',
          content: r.fav_content || '',
          citations: parsedCitations,
          created_at: r.favorited_at
        };
      } else {
        return {
          id: r.document_id || r.favorite_id,
          favorite_id: r.favorite_id,
          item_type: 'document',
          document_id: r.document_id,
          title: r.doc_title || r.fav_title || 'Untitled Document',
          file_type: r.file_type || 'pdf',
          file_size: r.file_size || 0,
          total_pages: r.total_pages || 1,
          total_chunks: r.total_chunks || 0,
          session_id: r.session_id,
          created_at: r.favorited_at
        };
      }
    });
  },

  async addFavoriteDocument(userId, documentId) {
    try {
      await db.query(
        'INSERT INTO favorites (user_id, item_type, document_id) VALUES (?, "document", ?)',
        [userId, documentId]
      );
      await db.query('UPDATE documents SET is_favorite = 1 WHERE id = ? AND user_id = ?', [documentId, userId]);
      return true;
    } catch (e) {
      await db.query('UPDATE documents SET is_favorite = 1 WHERE id = ? AND user_id = ?', [documentId, userId]);
      return true;
    }
  },

  async removeFavoriteDocument(userId, documentId) {
    await db.query('DELETE FROM favorites WHERE user_id = ? AND item_type = "document" AND document_id = ?', [userId, documentId]);
    await db.query('UPDATE documents SET is_favorite = 0 WHERE id = ? AND user_id = ?', [documentId, userId]);
    return true;
  },

  async addFavoriteMessage(userId, { messageId, title, content, citations, sessionId }) {
    try {
      let parsedCitations = [];
      if (citations) {
        parsedCitations = typeof citations === 'string' ? JSON.parse(citations) : citations;
      }
      const citationsStr = citations ? (typeof citations === 'string' ? citations : JSON.stringify(citations)) : null;

      const res = await db.query(
        'INSERT INTO favorites (user_id, item_type, message_id, title, content, citations) VALUES (?, "message", ?, ?, ?, ?)',
        [userId, messageId || null, title || 'AI Answer', content || '', citationsStr]
      );
      const favId = res.insertId;

      // Extract and favorite all associated PDF documents (from citations & session)
      const docIdsToFavorite = new Set();

      if (Array.isArray(parsedCitations)) {
        for (const c of parsedCitations) {
          const dId = c.document_id || c.documentId || c.id;
          if (dId) {
            docIdsToFavorite.add(Number(dId));
          } else if (c.document_title || c.documentName) {
            const titleToMatch = c.document_title || c.documentName;
            const rows = await db.query('SELECT id FROM documents WHERE user_id = ? AND title = ? LIMIT 1', [userId, titleToMatch]);
            if (rows && rows.length > 0) docIdsToFavorite.add(rows[0].id);
          }
        }
      }

      if (sessionId) {
        const sessDocs = await db.query('SELECT id FROM documents WHERE user_id = ? AND session_id = ?', [userId, sessionId]);
        if (Array.isArray(sessDocs)) {
          for (const sd of sessDocs) {
            docIdsToFavorite.add(sd.id);
          }
        }
      }

      for (const docId of docIdsToFavorite) {
        try {
          await db.query(
            'INSERT INTO favorites (user_id, item_type, document_id) VALUES (?, "document", ?)',
            [userId, docId]
          );
        } catch (dupErr) {}
        await db.query('UPDATE documents SET is_favorite = 1 WHERE id = ? AND user_id = ?', [docId, userId]);
      }

      return { id: favId, message_id: messageId, favorited_doc_ids: Array.from(docIdsToFavorite) };
    } catch (e) {
      console.error('addFavoriteMessage error:', e);
      return null;
    }
  },

  async removeFavoriteMessage(userId, messageId) {
    await db.query(
      'DELETE FROM favorites WHERE user_id = ? AND item_type = "message" AND (message_id = ? OR id = ?)',
      [userId, messageId, messageId]
    );
    return true;
  },

  async removeFavoriteById(userId, favoriteId) {
    const rows = await db.query('SELECT document_id, item_type FROM favorites WHERE id = ? AND user_id = ?', [favoriteId, userId]);
    if (rows && rows.length > 0) {
      const docId = rows[0].document_id;
      if (docId) {
        await db.query('UPDATE documents SET is_favorite = 0 WHERE id = ? AND user_id = ?', [docId, userId]);
      }
      await db.query('DELETE FROM favorites WHERE id = ? AND user_id = ?', [favoriteId, userId]);
    }
    return true;
  },

  // Alias for backward compatibility
  async addFavorite(userId, documentId) {
    return this.addFavoriteDocument(userId, documentId);
  },

  async removeFavorite(userId, documentId) {
    return this.removeFavoriteById(userId, documentId) || this.removeFavoriteDocument(userId, documentId);
  }
};

module.exports = favoriteModel;
