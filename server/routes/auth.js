const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [email, passwordHash, displayName || null]
    );

    const user = {
      id: result.insertId,
      email,
      display_name: displayName || null,
    };

    const token = generateToken(user);
    setTokenCookie(res, token);

    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, password_hash, display_name, avatar_url FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    setTokenCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const pool = db.getPool();
    if (!pool) {
      // Fall back to token data if DB is unavailable
      return res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          displayName: req.user.displayName,
        },
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
