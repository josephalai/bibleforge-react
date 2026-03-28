/**
 * Teachings CRUD routes — manual teaching management (no AI).
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getPool } = require('../db');

const router = express.Router();

// POST /api/teachings — create a teaching
router.post('/', requireAuth, async (req, res) => {
  const { title, description, contentJson } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO teachings (user_id, title, description, content_json) VALUES (?, ?, ?, ?)',
      [req.user.id, title.trim(), description || null, contentJson || null]
    );
    res.status(201).json({
      id: result.insertId,
      userId: req.user.id,
      title: title.trim(),
      description: description || null,
      contentJson: contentJson || null,
      isAiGenerated: false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create teaching' });
  }
});

// GET /api/teachings — list user's teachings
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      `SELECT t.id, t.title, t.description, t.is_ai_generated, t.created_at, t.updated_at,
              COUNT(tv.id) AS verse_count
       FROM teachings t
       LEFT JOIN teaching_verses tv ON tv.teaching_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      isAiGenerated: !!r.is_ai_generated,
      verseCount: r.verse_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teachings' });
  }
});

// GET /api/teachings/:id — get single teaching with verses
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid teaching ID' });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, title, description, content_json, is_ai_generated, created_at, updated_at FROM teachings WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teaching not found' });

    const teaching = rows[0];
    const [verses] = await pool.execute(
      'SELECT id, book, chapter, verse, order_index, notes FROM teaching_verses WHERE teaching_id = ? ORDER BY order_index',
      [id]
    );

    res.json({
      id: teaching.id,
      title: teaching.title,
      description: teaching.description,
      contentJson: teaching.content_json,
      isAiGenerated: !!teaching.is_ai_generated,
      createdAt: teaching.created_at,
      updatedAt: teaching.updated_at,
      verses: verses.map(v => ({
        id: v.id,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        orderIndex: v.order_index,
        notes: v.notes,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teaching' });
  }
});

// PUT /api/teachings/:id — update teaching
router.put('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid teaching ID' });

  const { title, description, contentJson } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'UPDATE teachings SET title = ?, description = ?, content_json = ? WHERE id = ? AND user_id = ?',
      [title.trim(), description || null, contentJson || null, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Teaching not found' });
    res.json({ id, title: title.trim(), description: description || null, contentJson: contentJson || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update teaching' });
  }
});

// DELETE /api/teachings/:id — delete teaching
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid teaching ID' });

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const [result] = await pool.execute(
      'DELETE FROM teachings WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Teaching not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete teaching' });
  }
});

// POST /api/teachings/:id/verses — add verse to teaching
router.post('/:id/verses', requireAuth, async (req, res) => {
  const teachingId = parseInt(req.params.id, 10);
  if (isNaN(teachingId)) return res.status(400).json({ error: 'Invalid teaching ID' });

  const { book, chapter, verse, notes } = req.body;
  if (!book || !chapter || !verse) {
    return res.status(400).json({ error: 'book, chapter, and verse are required' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    // Verify ownership
    const [rows] = await pool.execute(
      'SELECT id FROM teachings WHERE id = ? AND user_id = ?',
      [teachingId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teaching not found' });

    // Get next order index
    const [maxRows] = await pool.execute(
      'SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM teaching_verses WHERE teaching_id = ?',
      [teachingId]
    );
    const nextIdx = (maxRows[0]?.max_idx ?? -1) + 1;

    const [result] = await pool.execute(
      'INSERT INTO teaching_verses (teaching_id, book, chapter, verse, order_index, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [teachingId, book, chapter, verse, nextIdx, notes || null]
    );
    res.status(201).json({
      id: result.insertId,
      teachingId,
      book,
      chapter,
      verse,
      orderIndex: nextIdx,
      notes: notes || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add verse' });
  }
});

// DELETE /api/teachings/:id/verses/:verseId — remove verse from teaching
router.delete('/:id/verses/:verseId', requireAuth, async (req, res) => {
  const teachingId = parseInt(req.params.id, 10);
  const verseId = parseInt(req.params.verseId, 10);
  if (isNaN(teachingId) || isNaN(verseId)) {
    return res.status(400).json({ error: 'Invalid teaching or verse ID' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    // Verify ownership through teaching
    const [rows] = await pool.execute(
      'SELECT id FROM teachings WHERE id = ? AND user_id = ?',
      [teachingId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teaching not found' });

    const [result] = await pool.execute(
      'DELETE FROM teaching_verses WHERE id = ? AND teaching_id = ?',
      [verseId, teachingId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Verse not found in teaching' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove verse' });
  }
});

module.exports = router;
