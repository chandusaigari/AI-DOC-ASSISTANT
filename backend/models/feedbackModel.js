const db = require('./db');

const feedbackModel = {
  async create({ userId, category, rating, message }) {
    const res = await db.query(
      `INSERT INTO feedback (user_id, category, rating, message) VALUES (?, ?, ?, ?)`,
      [userId, category || 'General', rating || 5, message]
    );
    return res.insertId;
  },

  async getByUser(userId) {
    return await db.query(
      `SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  },

  async getAllWithUsers() {
    return await db.query(`
      SELECT f.*, u.email as user_email, u.full_name as user_name, u.role as user_role
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `);
  },

  async deleteByAdmin(id) {
    await db.query(`DELETE FROM feedback WHERE id = ?`, [id]);
  },

  async getStats() {
    const rows = await db.query(`
      SELECT 
        COUNT(*) as total_feedback,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM feedback
    `);
    const r = rows[0] || {};
    return {
      totalFeedback: Number(r.total_feedback || 0),
      avgRating: Number(parseFloat(r.avg_rating || 0).toFixed(1))
    };
  }
};

module.exports = feedbackModel;
