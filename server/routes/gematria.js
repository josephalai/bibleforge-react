/**
 * Gematria routes for verse-level and word-level gematria lookups.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const { getGematria } = require('../data/gematria');
const { getLexiconEntry, lexicon } = require('../data/lexicon');
const { getStrongsForWord } = require('../data/word-map');
const bible = require('../data/bible');
const books = require('../data/books');

// Load pre-computed verse gematria
const verseGematriaPath = path.join(__dirname, '..', 'data', 'verse-gematria.json');
let verseGematria = {};
try {
  verseGematria = require(verseGematriaPath);
} catch {
  console.warn('verse-gematria.json not found — run server/scripts/compute-verse-gematria.js');
}

/**
 * GET /api/gematria/verse/:book/:chapter/:verse
 * Returns gematria value for a specific verse + word breakdown + matching verses
 */
router.get('/verse/:book/:chapter/:verse', (req, res) => {
  const bookId = parseInt(req.params.book, 10);
  const chapter = parseInt(req.params.chapter, 10);
  const verseNum = parseInt(req.params.verse, 10);

  if (isNaN(bookId) || isNaN(chapter) || isNaN(verseNum)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  // Get the verse text
  const verses = bible.getVerses(bookId, chapter);
  const verse = verses?.find(v => v.verse === verseNum);
  if (!verse) {
    return res.status(404).json({ error: 'Verse not found' });
  }

  // Compute word-by-word breakdown on the fly
  const words = verse.text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  const breakdown = [];
  let totalValue = 0;

  for (const word of words) {
    const strongs = getStrongsForWord(word.toLowerCase());
    if (!strongs) continue;
    const hebrewStrongs = strongs.find(s => s.startsWith('H'));
    if (!hebrewStrongs) continue;
    const entry = getLexiconEntry(hebrewStrongs);
    if (!entry || !entry.base_word) continue;
    const gem = getGematria(entry.base_word);
    if (!gem || !gem.totalValue) continue;

    totalValue += gem.totalValue;
    breakdown.push({
      english: word,
      hebrew: entry.base_word,
      strongs: hebrewStrongs,
      value: gem.totalValue,
      letters: gem.letters.map(l => ({
        char: l.character,
        symbol: l.symbol,
        value: l.value,
        meaning: l.meaning,
      })),
    });
  }

  // Find matching verses (exact match)
  const matches = findMatchingVerses(totalValue, 'exact', bookId, chapter, verseNum);

  res.json({
    book: bookId,
    chapter,
    verse: verseNum,
    text: verse.text,
    totalValue,
    breakdown,
    matches: matches.slice(0, 20),
  });
});

/**
 * GET /api/gematria/matches?value=913&mode=exact|range|multiples
 */
router.get('/matches', (req, res) => {
  const value = parseInt(req.query.value, 10);
  const mode = req.query.mode || 'exact';

  if (isNaN(value) || value < 1) {
    return res.status(400).json({ error: 'Invalid value' });
  }

  const matches = findMatchingVerses(value, mode);
  res.json({ value, mode, matches: matches.slice(0, 50) });
});

/**
 * GET /api/gematria/word-matches?value=913
 * Find all Hebrew words in the lexicon with this gematria value
 */
router.get('/word-matches', (req, res) => {
  const value = parseInt(req.query.value, 10);
  if (isNaN(value) || value < 1) {
    return res.status(400).json({ error: 'Invalid value' });
  }

  const matches = [];
  const lexKeys = Object.keys(lexicon);
  for (const key of lexKeys) {
    if (!key.startsWith('H')) continue;
    const entry = lexicon[key];
    if (!entry || !entry.base_word) continue;
    const gem = getGematria(entry.base_word);
    if (gem && gem.totalValue === value) {
      matches.push({
        strongsNumber: key,
        hebrewWord: entry.base_word,
        pronunciation: entry.data?.pronun?.dic || '',
        meaning: entry.data?.def?.short || '',
      });
    }
    if (matches.length >= 50) break;
  }

  res.json({ value, words: matches });
});

/**
 * GET /api/gematria/chapter/:book/:chapter
 * Returns gematria values for all verses in a chapter (for badges)
 */
router.get('/chapter/:book/:chapter', (req, res) => {
  const bookId = parseInt(req.params.book, 10);
  const chapter = parseInt(req.params.chapter, 10);

  if (isNaN(bookId) || isNaN(chapter)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const key = `${bookId}:${chapter}`;
  const data = verseGematria[key] || [];
  res.json({ book: bookId, chapter, verses: data });
});

// Helper: find verses with matching gematria values
function findMatchingVerses(targetValue, mode, excludeBook, excludeChapter, excludeVerse) {
  const matches = [];
  if (!targetValue) return matches;

  for (const [key, verses] of Object.entries(verseGematria)) {
    const [bookId, chapter] = key.split(':').map(Number);
    const bookInfo = books[bookId];
    if (!bookInfo) continue;

    for (const v of verses) {
      // Skip the source verse
      if (bookId === excludeBook && chapter === excludeChapter && v.verse === excludeVerse) continue;

      let isMatch = false;
      if (mode === 'exact') {
        isMatch = v.value === targetValue;
      } else if (mode === 'range') {
        const margin = targetValue * 0.05;
        isMatch = v.value >= targetValue - margin && v.value <= targetValue + margin;
      } else if (mode === 'multiples') {
        isMatch = (targetValue % v.value === 0 || v.value % targetValue === 0)
          && v.value !== targetValue;
      }

      if (isMatch) {
        matches.push({
          book: bookId,
          bookName: bookInfo.name,
          chapter,
          verse: v.verse,
          value: v.value,
        });
        if (matches.length >= 50) return matches;
      }
    }
  }
  return matches;
}

module.exports = router;
