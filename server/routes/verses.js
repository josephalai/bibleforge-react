const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getPool } = require('../db');

const router = express.Router();

// ── Stars ──────────────────────────────────────────────

// POST /api/stars — toggle star on a verse
router.post('/stars', requireAuth, async (req, res) => {
  const { book, chapter, verse } = req.body;
  if (!book || !chapter || !verse) {
    return res.status(400).json({ error: 'book, chapter, and verse are required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    await pool.execute(
      'INSERT INTO starred_verses (user_id, book, chapter, verse) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id',
      [req.user.id, book, chapter, verse]
    );
    res.json({ starred: true, book, chapter, verse });
  } catch (err) {
    res.status(500).json({ error: 'Failed to star verse' });
  }
});

// DELETE /api/stars — remove a star
router.delete('/stars', requireAuth, async (req, res) => {
  const { book, chapter, verse } = req.body;
  if (!book || !chapter || !verse) {
    return res.status(400).json({ error: 'book, chapter, and verse are required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    await pool.execute(
      'DELETE FROM starred_verses WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?',
      [req.user.id, book, chapter, verse]
    );
    res.json({ starred: false, book, chapter, verse });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove star' });
  }
});

// GET /api/stars/all — all starred verses for user
router.get('/stars/all', requireAuth, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, created_at FROM starred_verses WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stars' });
  }
});

// GET /api/stars?book=1&chapter=1 — stars for a chapter
router.get('/stars', requireAuth, async (req, res) => {
  const book = parseInt(req.query.book, 10);
  const chapter = parseInt(req.query.chapter, 10);
  if (isNaN(book) || isNaN(chapter)) {
    return res.status(400).json({ error: 'book and chapter query params required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, created_at FROM starred_verses WHERE user_id = ? AND book = ? AND chapter = ?',
      [req.user.id, book, chapter]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stars' });
  }
});

// ── Notes ──────────────────────────────────────────────

// POST /api/notes — create or update a note (upsert)
router.post('/notes', requireAuth, async (req, res) => {
  const { book, chapter, verse, content } = req.body;
  if (!book || !chapter || !verse || content == null) {
    return res.status(400).json({ error: 'book, chapter, verse, and content are required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO verse_notes (user_id, book, chapter, verse, content) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)',
      [req.user.id, book, chapter, verse, content]
    );
    const noteId = result.insertId || null;
    // Fetch the saved note to return it
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, content, created_at, updated_at FROM verse_notes WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?',
      [req.user.id, book, chapter, verse]
    );
    res.json(rows[0] || { id: noteId, book, chapter, verse, content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// PUT /api/notes/:id — update note by id
router.put('/notes/:id', requireAuth, async (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (isNaN(noteId) || content == null) {
    return res.status(400).json({ error: 'Valid note id and content are required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'UPDATE verse_notes SET content = ? WHERE id = ? AND user_id = ?',
      [content, noteId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, content, created_at, updated_at FROM verse_notes WHERE id = ?',
      [noteId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id — delete note by id
router.delete('/notes/:id', requireAuth, async (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Valid note id required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'DELETE FROM verse_notes WHERE id = ? AND user_id = ?',
      [noteId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// GET /api/notes/all — all notes for user (notebook)
router.get('/notes/all', requireAuth, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, content, created_at, updated_at FROM verse_notes WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/search?q=keyword — search notes content
router.get('/notes/search', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'Search query parameter q is required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, content, created_at, updated_at FROM verse_notes WHERE user_id = ? AND content LIKE ? ORDER BY updated_at DESC',
      [req.user.id, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

// GET /api/notes?book=1&chapter=1 — notes for a chapter
router.get('/notes', requireAuth, async (req, res) => {
  const book = parseInt(req.query.book, 10);
  const chapter = parseInt(req.query.chapter, 10);
  if (isNaN(book) || isNaN(chapter)) {
    return res.status(400).json({ error: 'book and chapter query params required' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, book, chapter, verse, content, created_at, updated_at FROM verse_notes WHERE user_id = ? AND book = ? AND chapter = ?',
      [req.user.id, book, chapter]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

module.exports = router;
