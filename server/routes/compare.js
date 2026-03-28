/**
 * Verse comparison routes — compare multiple verses side-by-side.
 */
const express = require('express');
const router = express.Router();
const bible = require('../data/bible');
const books = require('../data/books');
const { getStrongsForWord } = require('../data/word-map');
const { getLexiconEntry } = require('../data/lexicon');
const { getGematria } = require('../data/gematria');

let getMIBEntry;
try {
  getMIBEntry = require('../data/mib').getMIBEntry;
} catch (_) {
  getMIBEntry = () => null;
}

/**
 * Enrich a single verse with Strong's, Hebrew roots, gematria, MIB data.
 */
function enrichVerse(bookId, chapter, verseNum) {
  const bookInfo = books[bookId];
  if (!bookInfo) return null;

  const allVerses = bible.getVerses(bookId, chapter);
  const verse = allVerses.find(v => v.verse === verseNum);
  if (!verse) return null;

  const rawWords = verse.text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  const wordData = [];
  const strongsSet = new Set();
  const rootSet = new Set();
  let totalGematria = 0;

  for (const word of rawWords) {
    const strongs = getStrongsForWord(word.toLowerCase());
    const hebrewStrongs = strongs ? strongs.find(s => s.startsWith('H')) : null;
    const greekStrongs = strongs ? strongs.find(s => s.startsWith('G')) : null;
    const bestStrongs = hebrewStrongs || greekStrongs || null;

    let hebrew = null;
    let gematria = null;
    let root = null;

    if (bestStrongs) {
      strongsSet.add(bestStrongs);
      const entry = getLexiconEntry(bestStrongs);
      if (entry) {
        hebrew = entry.base_word || null;
        // Extract root
        const derivStr = entry.data?.deriv || '';
        const rootMatch = derivStr.match(/H(\d+)/);
        if (rootMatch && bestStrongs.startsWith('H')) {
          root = 'H' + parseInt(rootMatch[1], 10);
          rootSet.add(root);
        }
        if (entry.base_word) {
          const gem = getGematria(entry.base_word);
          if (gem && gem.totalValue) {
            gematria = gem.totalValue;
            totalGematria += gem.totalValue;
          }
        }
      }
    }

    const mib = getMIBEntry(word.toLowerCase());

    wordData.push({
      english: word,
      strongs: bestStrongs,
      hebrew,
      root,
      gematria,
      mib: mib ? mib.definition || mib.metaphysical : null,
    });
  }

  return {
    book: bookId,
    bookName: bookInfo.name,
    chapter,
    verse: verseNum,
    text: verse.text,
    words: wordData,
    strongsNumbers: [...strongsSet],
    roots: [...rootSet],
    totalGematria,
  };
}

/**
 * POST /api/compare
 * Body: { verses: [{ book, chapter, verse }, ...] }
 */
router.post('/', (req, res) => {
  const { verses } = req.body;

  if (!verses || !Array.isArray(verses) || verses.length < 1) {
    return res.status(400).json({ error: 'verses array is required with at least 1 entry' });
  }

  if (verses.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 verses can be compared at once' });
  }

  const enriched = [];
  for (const ref of verses) {
    const bookId = parseInt(ref.book, 10);
    const chapter = parseInt(ref.chapter, 10);
    const verse = parseInt(ref.verse, 10);

    if (isNaN(bookId) || isNaN(chapter) || isNaN(verse) ||
        bookId < 1 || bookId > 66 || chapter < 1 || verse < 1) {
      continue;
    }

    const data = enrichVerse(bookId, chapter, verse);
    if (data) enriched.push(data);
  }

  if (!enriched.length) {
    return res.status(404).json({ error: 'No valid verses found' });
  }

  // Find shared Strong's numbers across verses
  const allStrongs = enriched.map(v => new Set(v.strongsNumbers));
  const sharedStrongs = [];
  if (enriched.length > 1) {
    for (const sn of allStrongs[0]) {
      if (allStrongs.every(set => set.has(sn))) {
        const entry = getLexiconEntry(sn);
        sharedStrongs.push({
          strongsNumber: sn,
          word: entry?.base_word || '',
          meaning: entry?.data?.def?.short || '',
        });
      }
    }
  }

  // Find shared roots across verses
  const allRoots = enriched.map(v => new Set(v.roots));
  const sharedRoots = [];
  if (enriched.length > 1) {
    for (const root of allRoots[0]) {
      if (allRoots.every(set => set.has(root))) {
        const entry = getLexiconEntry(root);
        sharedRoots.push({
          strongsNumber: root,
          word: entry?.base_word || '',
          meaning: entry?.data?.def?.short || '',
        });
      }
    }
  }

  res.json({
    verses: enriched,
    sharedStrongs,
    sharedRoots,
  });
});

module.exports = router;
