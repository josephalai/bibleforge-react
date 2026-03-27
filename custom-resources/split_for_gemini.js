#!/usr/bin/env node
/**
 * Splits mib-needs-review.json into chunks ready to paste into Gemini GUI.
 * Each chunk is a self-contained JSON file with instructions + ~500 entries.
 */

const fs   = require('fs');
const path = require('path');

const REVIEW_PATH = path.join(__dirname, 'mib-needs-review.json');
const CHUNK_SIZE  = 100;

const review  = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
const entries = review.entries;

const INSTRUCTIONS = `You are helping enrich a Metaphysical Bible Dictionary (MIB) with Strong's concordance numbers.

For each entry in the "entries" array:
- "word" is the biblical word or concept
- "etym" is its original language (Heb. = Hebrew, Gk. = Greek)
- "mibDef" is its literal definition
- "mibMeta" is its metaphysical/spiritual interpretation (may be truncated)
- "candidates" are Strong's numbers suggested by a word-map lookup — these are hints ONLY, not exhaustive

Your task:
1. Using your knowledge of Hebrew and Greek Strong's concordance, identify ALL Strong's numbers
   whose meaning semantically matches the spiritual/metaphysical sense of this word.
2. The candidates list is a starting point — you may confirm some, discard others, and ADD
   additional Strong's numbers not in the candidates list if they genuinely match.
3. Use "etym" to stay in the right language (Heb. → H numbers, Gk. → G numbers) unless
   the concept clearly spans both Testaments.
4. Exclude unrelated homonyms (e.g. H7043 "light/trivial in weight" does NOT match
   "light" as divine illumination).

Return ONLY a valid JSON array — no explanation, no markdown, no code fences:
[
  { "id": <same id from input>, "matches": ["H216", "H215", "G5457"] },
  { "id": <same id from input>, "matches": [] },
  ...
]

Every entry in the input must appear in your output. Empty "matches" is valid if nothing fits.`;

// Split into chunks
const chunks = [];
for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
  chunks.push(entries.slice(i, i + CHUNK_SIZE));
}

// Write each chunk
chunks.forEach((chunk, i) => {
  const num      = String(i + 1).padStart(2, '0');
  const filename = `gemini-chunk-${num}.json`;
  const outPath  = path.join(__dirname, filename);

  const payload = {
    _instructions: INSTRUCTIONS,
    _chunk: `${i + 1} of ${chunks.length}`,
    _entry_range: `ids ${chunk[0].id}–${chunk[chunk.length - 1].id}`,
    entries: chunk,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  chunk ${num}: ${chunk.length} entries  ${kb} KB  →  ${filename}`);
});

console.log(`\n  Total chunks : ${chunks.length}`);
console.log(`  Total entries: ${entries.length}`);
console.log('\n  Paste each file into Gemini. Save responses as:');
chunks.forEach((_, i) => {
  console.log(`    gemini-response-${String(i+1).padStart(2,'0')}.json`);
});
console.log('\n  Then run: node import_strongs_review.js gemini-response-*.json');
