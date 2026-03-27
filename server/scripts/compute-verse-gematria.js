#!/usr/bin/env node
/**
 * Pre-compute Gematria values for every OT verse.
 * For each verse, maps English words → Strong's → Hebrew → gematria value.
 * Output: server/data/verse-gematria.json keyed by "book:chapter"
 */

const fs = require('fs');
const path = require('path');
const bible = require('../data/bible');
const books = require('../data/books');
const { getStrongsForWord } = require('../data/word-map');
const { getLexiconEntry } = require('../data/lexicon');
const { getGematria } = require('../data/gematria');

const OUTPUT = path.join(__dirname, '..', 'data', 'verse-gematria.json');

function computeVerseGematria(verseText) {
  const words = verseText.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  let totalValue = 0;
  const breakdown = [];

  for (const word of words) {
    const strongs = getStrongsForWord(word.toLowerCase());
    if (!strongs) continue;

    // Pick the first Hebrew Strong's number
    const hebrewStrongs = strongs.find(s => s.startsWith('H'));
    if (!hebrewStrongs) continue;

    const entry = getLexiconEntry(hebrewStrongs);
    if (!entry || !entry.base_word) continue;

    const gem = getGematria(entry.base_word);
    if (!gem || !gem.totalValue) continue;

    totalValue += gem.totalValue;
    breakdown.push({
      e: word,        // english
      h: entry.base_word,  // hebrew
      s: hebrewStrongs,    // strongs
      v: gem.totalValue,   // value
    });
  }

  if (totalValue === 0) return null;
  return { value: totalValue };
}

function main() {
  console.log('Computing verse gematria for all OT verses...');
  const result = {};
  let verseCount = 0;
  let computedCount = 0;

  // OT books: 1-39
  for (let bookId = 1; bookId <= 39; bookId++) {
    const book = books[bookId];
    if (!book) continue;

    for (let ch = 1; ch <= book.chapters; ch++) {
      const key = `${bookId}:${ch}`;
      const verses = bible.getVerses(bookId, ch);
      if (!verses || !verses.length) continue;

      const chapterData = [];
      for (const v of verses) {
        verseCount++;
        const gem = computeVerseGematria(v.text);
        if (gem) {
          computedCount++;
          chapterData.push({ verse: v.verse, ...gem });
        }
      }
      if (chapterData.length) {
        result[key] = chapterData;
      }
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result));
  console.log(`Done. ${computedCount}/${verseCount} verses computed. Written to ${OUTPUT}`);
}

main();
