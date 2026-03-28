const express = require('express');
const { lexicon, getLexiconEntry } = require('../data/lexicon');
const { wordMap } = require('../data/word-map');
const bible = require('../data/bible');
const books = require('../data/books');
let getMIBEntry;
try {
  getMIBEntry = require('../data/mib').getMIBEntry;
} catch (_) {
  getMIBEntry = () => null;
}
const { getGematria } = require('../data/gematria');

const concordanceRouter = express.Router();
const rootsRouter = express.Router();
const hebrewOriginRouter = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reverse map: Strong's number → array of clean English words.
 * Built once at module load.
 */
const strongsToWords = {};
for (const [word, nums] of Object.entries(wordMap)) {
  const clean = word.replace(/[^a-z]/gi, '').toLowerCase();
  if (!clean) continue;
  for (const num of nums) {
    if (!strongsToWords[num]) strongsToWords[num] = new Set();
    strongsToWords[num].add(clean);
  }
}
for (const key of Object.keys(strongsToWords)) {
  strongsToWords[key] = [...strongsToWords[key]];
}

/**
 * Search bible verses for any of the given words (word-boundary match).
 * Returns all matching verse objects grouped by canonical book order.
 */
function findVersesWithWords(words) {
  if (!words || !words.length) return [];

  const patterns = words.map(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
  });

  const results = [];
  for (let bookIdx = 1; bookIdx <= 66; bookIdx++) {
    const bookInfo = books[bookIdx];
    if (!bookInfo) continue;
    for (let ch = 1; ch <= bookInfo.chapters; ch++) {
      const verses = bible.getVerses(bookIdx, ch);
      for (const v of verses) {
        if (v.text && patterns.some(p => p.test(v.text))) {
          results.push({
            book: bookInfo.id,
            bookName: bookInfo.name,
            chapter: v.chapter,
            verse: v.verse,
            text: v.text,
          });
        }
      }
    }
  }
  return results;
}

/**
 * Extract the first H-number from a derivation string.
 */
function extractRootNumber(derivStr) {
  if (!derivStr) return null;
  const m = derivStr.match(/H(\d+)/);
  return m ? 'H' + parseInt(m[1], 10) : null;
}

/**
 * Extract a Hebrew origin H-number from a Greek lexicon deriv string.
 */
function extractHebrewOrigin(derivStr) {
  if (!derivStr) return null;
  if (!derivStr.toLowerCase().includes('hebrew')) return null;
  const m = derivStr.match(/H(\d+)/);
  return m ? 'H' + parseInt(m[1], 10) : null;
}

// ── Feature 6: Concordance / Metaphysical Verse Search ─────────────────────

// GET /api/concordance/strongs/:strongsNumber
concordanceRouter.get('/strongs/:strongsNumber', (req, res) => {
  const sn = req.params.strongsNumber.toUpperCase();
  const entry = getLexiconEntry(sn);
  if (!entry) {
    return res.status(404).json({ error: `Strong's number ${sn} not found` });
  }

  const words = strongsToWords[sn] || [];
  const verses = findVersesWithWords(words);

  res.json({
    strongsNumber: sn,
    originalWord: entry.base_word,
    shortDefinition: entry.data?.def?.short || '',
    words,
    totalCount: verses.length,
    verses,
  });
});

// GET /api/concordance/metaphysical/:word
concordanceRouter.get('/metaphysical/:word', (req, res) => {
  const word = req.params.word;
  const mibEntry = getMIBEntry(word);

  // Find verses containing the word itself
  const searchWords = [word.toLowerCase().replace(/[^a-z]/gi, '')].filter(Boolean);
  const verses = findVersesWithWords(searchWords);

  res.json({
    word,
    mibEntry: mibEntry || null,
    relatedWords: [],
    totalCount: verses.length,
    verses,
  });
});

// ── Feature 8A: Hebrew Root (Shoresh) Finder ───────────────────────────────

// GET /api/roots/:strongsNumber
rootsRouter.get('/:strongsNumber', (req, res) => {
  const sn = req.params.strongsNumber.toUpperCase();
  const entry = getLexiconEntry(sn);
  if (!entry) {
    return res.status(404).json({ error: `Strong's number ${sn} not found` });
  }

  // Extract root from deriv field
  const derivStr = entry.data?.deriv || '';
  const rootNum = sn.startsWith('H') ? extractRootNumber(derivStr) : null;
  const rootEntry = rootNum ? getLexiconEntry(rootNum) : null;

  // Find all entries derived from the same root
  const derivedWords = [];
  if (rootNum) {
    const allKeys = Object.keys(lexicon);
    for (const key of allKeys) {
      if (key === sn || key === rootNum) continue;
      if (!key.startsWith('H')) continue;
      const e = lexicon[key];
      const d = e?.data?.deriv || '';
      if (extractRootNumber(d) === rootNum) {
        derivedWords.push({
          strongsNumber: key,
          word: e.base_word,
          shortDefinition: e.data?.def?.short || '',
          usage: e.usage || '',
        });
      }
      if (derivedWords.length >= 50) break;
    }
  }

  // Word DNA: gematria letter breakdown for the Hebrew word
  const wordDNA = sn.startsWith('H') ? getGematria(entry.base_word) : null;

  const root = rootEntry ? {
    number: rootNum,
    word: rootEntry.base_word,
    meaning: rootEntry.data?.def?.short || '',
  } : null;

  res.json({
    strongsNumber: sn,
    word: entry.base_word,
    root,
    derivedWords,
    wordDNA: wordDNA ? {
      letters: wordDNA.letters.map(l => ({
        character: l.character,
        symbol: l.symbol,
        value: l.value,
        meaning: l.meaning,
      })),
      totalValue: wordDNA.totalValue,
    } : null,
  });
});

// ── Feature 8B: Greek→Hebrew Mapping ───────────────────────────────────────

// GET /api/hebrew-origin/:greekStrongs
hebrewOriginRouter.get('/:greekStrongs', (req, res) => {
  const gn = req.params.greekStrongs.toUpperCase();
  if (!gn.startsWith('G')) {
    return res.status(400).json({ error: 'Expected a Greek Strong\'s number (G...)' });
  }

  const entry = getLexiconEntry(gn);
  if (!entry) {
    return res.status(404).json({ error: `Strong's number ${gn} not found` });
  }

  const derivStr = entry.data?.deriv || '';
  const hebrewNum = extractHebrewOrigin(derivStr);
  const hebrewEntry = hebrewNum ? getLexiconEntry(hebrewNum) : null;

  let hebrewOrigin = null;
  if (hebrewEntry) {
    const gem = getGematria(hebrewEntry.base_word);
    hebrewOrigin = {
      strongsNumber: hebrewNum,
      word: hebrewEntry.base_word,
      meaning: hebrewEntry.data?.def?.short || '',
      pronunciation: hebrewEntry.data?.pronun?.dic || '',
      gematria: gem ? {
        totalValue: gem.totalValue,
        letters: gem.letters.map(l => ({
          character: l.character,
          symbol: l.symbol,
          value: l.value,
          meaning: l.meaning,
        })),
      } : null,
    };
  }

  res.json({
    greekStrongs: gn,
    greekWord: entry.base_word,
    hebrewOrigin,
  });
});

module.exports = { concordanceRouter, rootsRouter, hebrewOriginRouter };
