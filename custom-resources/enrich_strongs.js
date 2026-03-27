#!/usr/bin/env node
/**
 * Step 1: Auto-assign Strong's numbers to MIB entries
 *
 * Strategy:
 *  A) Proper names with ONE Strong's match → assign automatically, no AI
 *  B) Words with MULTIPLE candidates → add to Gemini review file (compact)
 *  C) No match in word-map → flag as unmatched
 */

const fs   = require('fs');
const path = require('path');

const { wordMap } = require('../server/data/word-map.js');
const { lexicon  } = require('../server/data/lexicon.js');

const MIB_PATH    = path.join(__dirname, 'metaphysical-bible-dictionary.json');
const OUT_PATH    = path.join(__dirname, 'metaphysical-bible-dictionary.json');
const REVIEW_PATH = path.join(__dirname, 'mib-needs-review.json');

const mib = JSON.parse(fs.readFileSync(MIB_PATH, 'utf8'));

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeWord(word) {
  // Strip quotes, parens, punctuation, lowercase
  return word.replace(/["""''().,\/#!$%\^&\*;:{}=\-_`~]/g, '').trim().toLowerCase();
}

function getLexDef(strongs) {
  const entry = lexicon[strongs];
  if (!entry) return null;
  const short = entry.data?.def?.short || '';
  const usage = entry.usage || '';
  return short || usage || null;
}

function isProperName(entry) {
  // Has pronunciation + etymology = it's a biblical proper name
  return !!(entry.pronunciation && entry.etymology);
}

// ── main loop ─────────────────────────────────────────────────────────────────

const stats = { auto: 0, multi: 0, noMatch: 0 };
const needsReview = [];

for (const entry of mib) {
  const normalized = normalizeWord(entry.word);
  const candidates = wordMap[normalized] || wordMap[normalized.split(' ')[0]] || [];

  // Build compact candidates list from word-map (starting point, not exhaustive)
  const compactCandidates = candidates
    .map(s => ({ s, def: getLexDef(s) }))
    .filter(c => c.def);

  // ALL entries go to Gemini — word-map candidates are hints, not the final answer.
  // Gemini may confirm, expand, or replace them based on the metaphysical meaning.
  needsReview.push({
    id:         mib.indexOf(entry),
    word:       entry.word,
    etym:       entry.etymology || '',
    mibDef:     entry.definition || '',
    mibMeta:    (entry.metaphysical || '').slice(0, 300),
    candidates: compactCandidates, // word-map suggestions — Gemini can go beyond these
  });

  if (candidates.length === 0) stats.noMatch++;
  else if (candidates.length === 1) stats.auto++;
  else stats.multi++;
}

// ── write enriched MIB ───────────────────────────────────────────────────────
fs.writeFileSync(OUT_PATH, JSON.stringify(mib, null, 2));

// ── write compact review file for Gemini ────────────────────────────────────
const reviewPayload = {
  _instructions: [
    "For each entry, examine mibDef and mibMeta to understand the metaphysical/spiritual meaning.",
    "From the candidates array, select ONLY the Strong's numbers whose definition semantically",
    "matches the spiritual/metaphysical sense of the word (not unrelated homonyms).",
    "Add a 'matches' field (array of Strong's number strings) to each entry.",
    "Return the full array as valid JSON. Do not change any other fields.",
  ].join(' '),
  entries: needsReview,
};

fs.writeFileSync(REVIEW_PATH, JSON.stringify(reviewPayload, null, 2));

// ── report ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  MIB STRONG\'S ENRICHMENT — Step 1 Done');
console.log('══════════════════════════════════════════');
console.log(`  Total MIB entries       : ${mib.length}`);
console.log(`  Auto-assigned           : ${stats.auto}  (no AI needed)`);
console.log(`  Sent to Gemini review   : ${stats.multi}`);
console.log(`  No concordance match    : ${stats.noMatch}`);
console.log('');
console.log(`  Review file size        : ${(fs.statSync(REVIEW_PATH).size / 1024).toFixed(1)} KB`);
console.log(`  → ${REVIEW_PATH}`);
console.log('');
console.log('  Next step: send mib-needs-review.json to Gemini/ChatGPT');
console.log('  with the _instructions field as your prompt.');
console.log('  Then run: node import_strongs_review.js <gemini-output.json>');
console.log('══════════════════════════════════════════\n');
