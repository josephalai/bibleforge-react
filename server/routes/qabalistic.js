/**
 * Qabalistic verse meaning routes — word-by-word data lookup (no AI).
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

// Suarès letter meanings for the 22 Hebrew letters
const SUARES_MEANINGS = {
  'א': 'Aleph — infinite, timeless pulsation of life-death-life; the breath of the Intemporal',
  'ב': 'Bayt — archetype of all containers/dwellings; that which holds and gives form',
  'ג': 'Ghimel — organic movement; the camel that carries life through the desert',
  'ד': 'Dallet — resistance; the door that must be opened through effort',
  'ה': 'Hay — life; the breath of existence, universal life principle',
  'ו': 'Vav — fertilizing agent; the hook/nail that connects above and below',
  'ז': 'Zayn — indeterminate possibilities; the weapon/sword of discernment',
  'ח': 'Hhayt — unstructured energy/consciousness; raw potential',
  'ט': 'Tayt — female archetypal energy; the cell/shelter of new formation',
  'י': 'Yod — existence/hand; the point of manifestation, divine spark',
  'כ': 'Kaf — container that receives; the palm/hand/receptacle',
  'ל': 'Lammed — organic movement in connected direction; the ox-goad',
  'מ': 'Mem — the waters; the maternal, passive resistance forming substance',
  'נ': 'Nun — individual life; the fish moving through the waters of existence',
  'ס': 'Samekh — female cosmic fertility; support structure',
  'ע': 'Ayn — eye; the spring/source that sees and projects reality',
  'פ': 'Pay — undifferentiated cosmic energy; the mouth that speaks creation',
  'צ': 'Tsade — feminine structuring energy; the fishhook catching life',
  'ק': 'Qof — cosmic Aleph in the body; the back of the head, transcendence in matter',
  'ר': 'Raysh — the cosmic container of all existence; the head/beginning',
  'ש': 'Sheen — breath of God; the Spirit/fire that transforms',
  'ת': 'Tav — cosmic resistance; the cross/mark of completion and synthesis',
  'ך': 'Kaf (final) — container in its cosmic finality',
  'ם': 'Mem (final) — waters in their cosmic completion',
  'ן': 'Nun (final) — individual life in its cosmic extension',
  'ף': 'Pay (final) — cosmic energy in its ultimate expression',
  'ץ': 'Tsade (final) — structuring energy in cosmic completion',
};

/**
 * POST /api/qabalistic-meaning
 * Body: { book, chapter, startVerse, endVerse }
 */
router.post('/', (req, res) => {
  const { book, chapter, startVerse, endVerse } = req.body;

  if (!book || !chapter || !startVerse) {
    return res.status(400).json({ error: 'book, chapter, and startVerse are required' });
  }

  const bookId = parseInt(book, 10);
  const ch = parseInt(chapter, 10);
  const sv = parseInt(startVerse, 10);
  const ev = parseInt(endVerse || startVerse, 10);

  if (isNaN(bookId) || isNaN(ch) || isNaN(sv) || isNaN(ev)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  if (bookId < 1 || bookId > 66 || ch < 1 || sv < 1 || ev < 1 || sv > ev) {
    return res.status(400).json({ error: 'Invalid parameter ranges' });
  }

  const bookInfo = books[bookId];
  if (!bookInfo) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const allVerses = bible.getVerses(bookId, ch);
  const selectedVerses = allVerses.filter(v => v.verse >= sv && v.verse <= ev);

  if (!selectedVerses.length) {
    return res.status(404).json({ error: 'Verses not found' });
  }

  const result = selectedVerses.map(v => {
    const rawWords = v.text.split(/\s+/).filter(Boolean);
    const words = rawWords.map(rawWord => {
      const english = rawWord.replace(/[^a-zA-Z'-]/g, '');
      if (!english) return { english: rawWord, hebrew: null, strongs: null, gematria: null, mib: null, suaresMeaning: null };

      const strongs = getStrongsForWord(english.toLowerCase());
      // Prefer Hebrew Strong's for OT
      const hebrewStrongs = strongs ? strongs.find(s => s.startsWith('H')) : null;
      const greekStrongs = strongs ? strongs.find(s => s.startsWith('G')) : null;
      const bestStrongs = hebrewStrongs || greekStrongs || null;

      let hebrew = null;
      let gematria = null;
      let suaresMeaning = null;

      if (bestStrongs) {
        const entry = getLexiconEntry(bestStrongs);
        if (entry && entry.base_word) {
          hebrew = entry.base_word;
          const gem = getGematria(entry.base_word);
          if (gem) {
            gematria = {
              letters: gem.letters.map(l => ({
                char: l.character,
                symbol: l.symbol,
                value: l.value,
                meaning: l.meaning,
                suares: SUARES_MEANINGS[l.character] || null,
              })),
              value: gem.totalValue,
            };
            // Build combined Suarès meaning
            const suaresParts = gem.letters
              .map(l => SUARES_MEANINGS[l.character])
              .filter(Boolean);
            if (suaresParts.length) {
              suaresMeaning = suaresParts.join(' → ');
            }
          }
        }
      }

      const mib = getMIBEntry(english.toLowerCase());

      return {
        english: rawWord,
        hebrew,
        strongs: bestStrongs,
        gematria,
        mib: mib ? { word: mib.word, definition: mib.definition, metaphysical: mib.metaphysical } : null,
        suaresMeaning,
      };
    });

    return {
      verse: v.verse,
      text: v.text,
      words,
    };
  });

  res.json({
    book: bookId,
    bookName: bookInfo.name,
    chapter: ch,
    verses: result,
  });
});

module.exports = router;
