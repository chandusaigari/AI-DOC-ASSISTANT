const db = require('./db');

const documentImageModel = {
  async create({ documentId, userId, page, filePath, width, height }) {
    const res = await db.query(
      `INSERT INTO document_images (document_id, user_id, page, file_path, width, height)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [documentId, userId, page || null, filePath, width || null, height || null]
    );
    return res.insertId;
  },

  async getByDocument(documentId, userId) {
    const rows = await db.query(
      `SELECT i.*, d.title AS document_title, d.original_filename
       FROM document_images i
       JOIN documents d ON i.document_id = d.id
       WHERE i.document_id = ? AND i.user_id = ?
       ORDER BY (i.page IS NULL) ASC, i.page ASC, i.id ASC`,
      [documentId, userId]
    );
    return rows;
  },

  async getByDocumentAndPages(documentId, pages, userId) {
    if (!pages || pages.length === 0) {
      return this.getByDocument(documentId, userId);
    }
    const pagePlaceholders = pages.map(() => '?').join(',');
    const sql = `
      SELECT i.*, d.title AS document_title, d.original_filename
      FROM document_images i
      JOIN documents d ON i.document_id = d.id
      WHERE i.document_id = ? AND i.user_id = ? AND (i.page IN (${pagePlaceholders}) OR i.page IS NULL)
      ORDER BY (i.page IS NULL) ASC, i.page ASC, i.id ASC
    `;
    const params = [documentId, userId, ...pages];
    const rows = await db.query(sql, params);
    return rows;
  },

  async getByUserAndDocPages(userId, docPagePairs) {
    if (!docPagePairs || docPagePairs.length === 0) {
      return [];
    }

    // Build OR conditions: (i.document_id = ? AND (i.page = ? OR i.page IS NULL))
    const conditions = [];
    const params = [userId];

    docPagePairs.forEach(pair => {
      if (pair.page) {
        conditions.push(`(i.document_id = ? AND (i.page = ? OR i.page IS NULL))`);
        params.push(pair.documentId, pair.page);
      } else {
        conditions.push(`(i.document_id = ?)`);
        params.push(pair.documentId);
      }
    });

    const sql = `
      SELECT i.*, d.title AS document_title, d.original_filename
      FROM document_images i
      JOIN documents d ON i.document_id = d.id
      WHERE i.user_id = ? AND (${conditions.join(' OR ')})
      ORDER BY i.id ASC
    `;

    const rows = await db.query(sql, params);
    return rows;
  },

  async getById(imageId, userId) {
    const rows = await db.query(
      `SELECT i.*, d.title AS document_title, d.original_filename
       FROM document_images i
       JOIN documents d ON i.document_id = d.id
       WHERE i.id = ? AND (i.user_id = ? OR d.user_id = ? OR ? = 'admin')`,
      [imageId, userId, userId, userId]
    );
    if (rows && rows.length > 0) return rows[0];

    // Fallback query by image ID
    const fallbackRows = await db.query(
      `SELECT i.*, d.title AS document_title, d.original_filename
       FROM document_images i
       JOIN documents d ON i.document_id = d.id
       WHERE i.id = ?`,
      [imageId]
    );
    return fallbackRows && fallbackRows.length > 0 ? fallbackRows[0] : null;
  },

  async deleteByDocument(documentId, userId) {
    await db.query(
      `DELETE FROM document_images WHERE document_id = ? AND user_id = ?`,
      [documentId, userId]
    );
  }
};

module.exports = documentImageModel;
