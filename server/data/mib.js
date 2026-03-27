/**
 * Metaphysical Bible Dictionary (Fillmore) lookup helpers.
 * Loaded once at startup — 3,668 entries, ~4MB.
 */

const path = require('path');
const mib = require(path.join(__dirname, '../../custom-resources/metaphysical-bible-dictionary.json'));

function normalize(word) {
  return word.replace(/[^a-z0-9\s-]/gi, '').trim().toLowerCase();
}

/**
 * Find a MIB entry by English word name, with Strong's fallback.
 * @param {string} word - English KJV word
 * @param {string[]} strongsNumbers - Strong's numbers to cross-reference (e.g. ["H216","G5457"])
 * @returns {object|null}
 */
function getMIBEntry(word, strongsNumbers = []) {
  const norm = normalize(word);
  if (!norm) return null;

  // 1. Exact match
  const exact = mib.find(e => normalize(e.word) === norm);
  if (exact) return exact;

  // 2. Prefix match (e.g. "Jehovah-jireh" matched by "jehovah")
  const prefix = mib.find(e => normalize(e.word).startsWith(norm) || norm.startsWith(normalize(e.word)));
  if (prefix) return prefix;

  // 3. Strong's number cross-reference
  if (strongsNumbers.length > 0) {
    const byStrongs = mib.find(e =>
      (e.strongsNumbers || []).some(s => strongsNumbers.includes(s))
    );
    if (byStrongs) return byStrongs;
  }

  return null;
}

module.exports = { getMIBEntry };
