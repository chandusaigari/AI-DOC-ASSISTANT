const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let mysqlPool = null;
let dbConnected = false;
let retryTimer = null;
const activeMode = 'mysql';

async function initDB() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'knowledgeai_db';

  console.log(`Connecting to MySQL Database at ${host}:${port}...`);

  try {
    // 1. Initial connection without database to ensure DB exists
    const sysConn = await mysql.createConnection({
      host,
      port,
      user,
      password
    });
    await sysConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await sysConn.end();

    // 2. Create pool connected to knowledgeai_db
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await mysqlPool.getConnection();
    connection.release();
    
    dbConnected = true;
    console.log(`Successfully connected to MySQL database [${database}].`);

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    await createTables();
    return true;
  } catch (err) {
    dbConnected = false;
    console.warn(`MySQL connection error: ${err.message}. Server will continue running; API calls will return 503 until MySQL is available.`);
    
    // Schedule background retry if not already retrying
    if (!retryTimer) {
      retryTimer = setInterval(async () => {
        console.log('Retrying MySQL database connection...');
        await initDB();
      }, 10000);
    }
    return false;
  }
}

function isDbConnected() {
  return dbConnected;
}

async function query(sql, params = []) {
  if (!dbConnected || !mysqlPool) {
    throw new Error('MySQL Database is not connected.');
  }

  const [rows, fields] = await mysqlPool.query(sql, params);
  if (rows && rows.insertId !== undefined) {
    return { insertId: rows.insertId, affectedRows: rows.affectedRows, rows };
  }
  return rows;
}

async function createTables() {
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NULL,
      google_id VARCHAR(255) DEFAULT NULL,
      role VARCHAR(50) DEFAULT 'user',
      grok_api_key VARCHAR(255) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const documentsTable = `
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_size INT NOT NULL,
      status VARCHAR(50) DEFAULT 'processed',
      total_pages INT DEFAULT 0,
      total_chunks INT DEFAULT 0,
      is_favorite INT DEFAULT 0,
      extracted_text LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const chunksTable = `
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      user_id INT NOT NULL,
      chunk_index INT NOT NULL,
      page_number INT DEFAULT 1,
      section_title VARCHAR(255) DEFAULT 'General',
      content LONGTEXT NOT NULL,
      token_count INT DEFAULT 0,
      embedding_vector LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const chatTable = `
    CREATE TABLE IF NOT EXISTS chat_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      document_id INT DEFAULT NULL,
      question LONGTEXT NOT NULL,
      answer LONGTEXT NOT NULL,
      citations LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const favoritesTable = `
    CREATE TABLE IF NOT EXISTS favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      document_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_doc_unique (user_id, document_id)
    ) ENGINE=InnoDB;
  `;

  const feedbackTable = `
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      rating INT NOT NULL DEFAULT 5,
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const documentImagesTable = `
    CREATE TABLE IF NOT EXISTS document_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      user_id INT NOT NULL,
      page INT DEFAULT NULL,
      file_path VARCHAR(500) NOT NULL,
      width INT DEFAULT NULL,
      height INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_doc_page (document_id, page),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB;
  `;

  const sessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(50) DEFAULT '📁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_user (user_id)
    ) ENGINE=InnoDB;
  `;

  const chatThreadsTable = `
    CREATE TABLE IF NOT EXISTS chat_threads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_session (session_id),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB;
  `;

  const chatMessagesTable = `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      thread_id INT NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content LONGTEXT NOT NULL,
      sources LONGTEXT DEFAULT NULL,
      images LONGTEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_thread (thread_id)
    ) ENGINE=InnoDB;
  `;

  await query(userTable);
  await query(documentsTable);
  await query(chunksTable);
  await query(chatTable);
  await query(favoritesTable);
  await query(feedbackTable);
  await query(documentImagesTable);
  await query(sessionsTable);
  await query(chatThreadsTable);
  await query(chatMessagesTable);

  // Add session_id column to documents table if missing
  try {
    await query("ALTER TABLE documents ADD COLUMN session_id INT DEFAULT NULL;");
  } catch (e) {
    // Column already exists
  }

  // Users table Google OAuth migration
  try {
    await query("ALTER TABLE users MODIFY password VARCHAR(255) NULL;");
  } catch (e) {}

  try {
    await query("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL;");
  } catch (e) {}

  // Favorites table migration for AI Message bookmarks
  try { await query("ALTER TABLE favorites ADD COLUMN item_type VARCHAR(50) DEFAULT 'document';"); } catch (e) {}
  try { await query("ALTER TABLE favorites ADD COLUMN message_id INT DEFAULT NULL;"); } catch (e) {}
  try { await query("ALTER TABLE favorites ADD COLUMN title VARCHAR(255) DEFAULT NULL;"); } catch (e) {}
  try { await query("ALTER TABLE favorites ADD COLUMN content LONGTEXT DEFAULT NULL;"); } catch (e) {}
  try { await query("ALTER TABLE favorites ADD COLUMN citations LONGTEXT DEFAULT NULL;"); } catch (e) {}
  try { await query("ALTER TABLE favorites MODIFY document_id INT DEFAULT NULL;"); } catch (e) {}

  // Chat History table migration for session_id & thread_id
  try { await query("ALTER TABLE chat_history ADD COLUMN session_id INT DEFAULT NULL;"); } catch (e) {}
  try { await query("ALTER TABLE chat_history ADD COLUMN thread_id INT DEFAULT NULL;"); } catch (e) {}

  // Automatic Migration: Migrate legacy documents into an auto-created "General" session per user
  try {
    const unassignedUsers = await query("SELECT DISTINCT user_id FROM documents WHERE session_id IS NULL");
    if (Array.isArray(unassignedUsers)) {
      for (const u of unassignedUsers) {
        let generalSession = await query("SELECT id FROM sessions WHERE user_id = ? AND name = 'General'", [u.user_id]);
        let generalId = generalSession && generalSession[0] ? generalSession[0].id : null;
        if (!generalId) {
          const res = await query("INSERT INTO sessions (user_id, name, icon) VALUES (?, 'General', '📁')", [u.user_id]);
          generalId = res.insertId;
        }
        await query("UPDATE documents SET session_id = ? WHERE user_id = ? AND session_id IS NULL", [generalId, u.user_id]);
      }
    }
  } catch (migErr) {
    console.warn('[Session DB Migration Warning]:', migErr.message);
  }

  console.log('All MySQL database tables initialized cleanly.');
}

function getActiveMode() {
  return 'mysql';
}

module.exports = {
  initDB,
  query,
  getActiveMode,
  isDbConnected
};
