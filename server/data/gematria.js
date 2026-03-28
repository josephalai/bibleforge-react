/**
 * Gematria / Qabalistic cipher lookup (Carlo Suarès — Cipher of Genesis).
 * Loaded once at startup.
 */

const fs = require('fs');
const path = require('path');

const gemCandidates = [
  process.env.GEMATRIA_PATH,
  path.join(__dirname, 'gematria.json'),
  path.join(__dirname, '..', '..', 'custom-resources', 'gematria.json'),
].filter(Boolean);
const gematriaPath = gemCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } })
  || path.join(__dirname, 'gematria.json');

const raw      = require(gematriaPath);
const symbols  = raw.suares_cipher_of_genesis.autiot_symbols;
const meta     = raw.suares_cipher_of_genesis;

// Build char → symbol map (handles combined chars like ב = Bayt/Vayt)
const charMap = {};
for (const sym of symbols) {
  charMap[sym.hebrew_character] = sym;
}

// Hebrew Unicode ranges for nikud (vowel points) and cantillation marks
// Strip these so we work with consonants only
const NIKUD_RE = /[\u0591-\u05C7]/g;

/**
 * Break a Hebrew word into its gematria components.
 * @param {string} hebrewWord - Hebrew word possibly with nikud/vowel marks
 * @returns {{ letters: Array, totalValue: number, structuralLevels: object } | null}
 */
function getGematria(hebrewWord) {
  if (!hebrewWord) return null;

  // Strip nikud/cantillation marks, keep only consonants
  const consonants = hebrewWord.replace(NIKUD_RE, '').split('').filter(c => c.trim());

  if (!consonants.length) return null;

  const letters = [];
  let totalValue = 0;

  for (const char of consonants) {
    const sym = charMap[char];
    if (sym) {
      letters.push({
        character:   sym.hebrew_character,
        symbol:      sym.symbol,
        value:       sym.numerical_value,
        level:       sym.level,
        meaning:     sym.meaning,
        imagery:     sym.imagery,
        formula:     sym.formula,
        connections: sym.connections || [],
      });
      totalValue += sym.numerical_value;
    } else {
      // Character not in gematria table (punctuation, space, etc.) — skip
    }
  }

  if (!letters.length) return null;

  return {
    word:            hebrewWord,
    consonants:      consonants.join(''),
    letters,
    totalValue,
    structuralLevels: meta.structural_levels,
  };
}

module.exports = { getGematria };
