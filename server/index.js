require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const bibleData = require("./data/bible");
const books = require("./data/books");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Rate limit all requests: 200 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(cors());
app.use(compression());
app.use(express.json());

// Serve static files in production (Docker)
const staticPath = process.env.STATIC_PATH;
if (staticPath) {
  app.use(express.static(path.resolve(__dirname, staticPath)));
}

let useDb = false;

// Determine data source on startup
async function initDataSource() {
  useDb = await db.isConnected();
  if (useDb) {
    console.log("Connected to MySQL database");
  } else {
    console.log("MySQL unavailable — using embedded JSON data");
  }
}

// GET /api/health
app.get("/api/health", async (_req, res) => {
  const dbConnected = await db.isConnected();
  res.json({
    status: "ok",
    dataSource: dbConnected ? "mysql" : "embedded",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/books
app.get("/api/books", (_req, res) => {
  const list = books.filter(Boolean).map((b) => ({
    id: b.id,
    name: b.name,
    shortName: b.shortName,
    chapters: b.chapters,
    testament: b.testament,
  }));
  res.json(list);
});

// GET /api/verses/:book/:chapter
app.get("/api/verses/:book/:chapter", async (req, res) => {
  const book = parseInt(req.params.book, 10);
  const chapter = parseInt(req.params.chapter, 10);

  if (isNaN(book) || isNaN(chapter) || book < 1 || book > 66 || chapter < 1) {
    return res.status(400).json({ error: "Invalid book or chapter" });
  }

  const bookInfo = books[book];
  if (!bookInfo || chapter > bookInfo.chapters) {
    return res.status(404).json({ error: "Book or chapter not found" });
  }

  if (useDb) {
    const rows = await db.getVerses(book, chapter);
    if (rows) return res.json({ book: bookInfo, verses: rows });
  }

  // Fallback to embedded data
  const verses = bibleData.getVerses(book, chapter);
  res.json({ book: bookInfo, verses });
});

// GET /api/search?q=keyword
app.get("/api/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    return res.status(400).json({ error: "Missing search query parameter 'q'" });
  }

  if (useDb) {
    const rows = await db.searchVerses(q);
    if (rows) return res.json({ query: q, results: rows });
  }

  // Fallback to embedded data
  const results = bibleData.searchVerses(q);
  res.json({ query: q, results });
});

// SPA fallback — serve index.html for non-API routes in production
if (staticPath) {
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(__dirname, staticPath, "index.html"));
  });
}

initDataSource().then(() => {
  app.listen(PORT, () => {
    console.log(`BibleForge server listening on port ${PORT}`);
  });
});
