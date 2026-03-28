/**
 * Metaphysical Bible Dictionary (Fillmore) lookup helpers.
 * Loaded once at startup — 3,668 entries, ~4MB.
 */

const fs = require('fs');
const path = require('path');
// Production: file copied into server/data/ by Dockerfile
// Dev: MIB_PATH env var points to the mounted custom-resources location
// Local dev fallback: try custom-resources/ relative to project root
const candidates = [
  process.env.MIB_PATH,
  path.join(__dirname, 'metaphysical-bible-dictionary.json'),
  path.join(__dirname, '..', '..', 'custom-resources', 'metaphysical-bible-dictionary.json'),
].filter(Boolean);
const mibPath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const mib = mibPath ? require(mibPath) : [];

function normalize(word) {
  return word.replace(/[^a-z0-9\s-]/gi, '').trim().toLowerCase();
}

/**
 * Find a MIB entry by English word name only.
 * Strong's cross-reference is intentionally NOT used here — too many false
 * positives from mis-tagged enrichment data cause wildly wrong results.
 * @param {string} word - English KJV word
 * @returns {object|null}
 */
function getMIBEntry(word) {
  const norm = normalize(word);
  if (!norm) return null;

  // 1. Exact match
  const exact = mib.find(e => normalize(e.word) === norm);
  if (exact) return exact;

  // 2. Prefix match — lookup word starts with an MIB entry word
  // e.g. "jehovah" matches "Jehovah-jireh", or "aaron" matches "Aaron"
  // Guard: MIB entry word must be at least 4 chars to avoid spurious matches
  const prefix = mib.find(e => {
    const en = normalize(e.word);
    return en.length >= 4 && (en.startsWith(norm) || norm.startsWith(en));
  });
  return prefix || null;
}

module.exports = { getMIBEntry };
