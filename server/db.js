const mysql = require("mysql2/promise");

let pool = null;

function createPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "bibleforge",
    password: process.env.DB_PASSWORD || "bibleforge",
    database: process.env.DB_NAME || "bf",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

async function isConnected() {
  try {
    const p = createPool();
    const conn = await p.getConnection();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

async function getVerses(book, chapter) {
  try {
    const p = createPool();
    const [rows] = await p.execute(
      "SELECT id, book, chapter, verse, words FROM bible_en WHERE book = ? AND chapter = ? ORDER BY id",
      [book, chapter]
    );
    return rows.map((r) => ({
      id: r.id,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      text: r.words,
    }));
  } catch {
    return null;
  }
}

async function searchVerses(query) {
  try {
    const p = createPool();
    const [rows] = await p.execute(
      "SELECT id, book, chapter, verse, words FROM bible_en WHERE words LIKE ? ORDER BY id LIMIT 100",
      [`%${query}%`]
    );
    return rows.map((r) => ({
      id: r.id,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      text: r.words,
    }));
  } catch {
    return null;
  }
}

module.exports = { isConnected, getVerses, searchVerses };
