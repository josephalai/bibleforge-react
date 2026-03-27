#!/usr/bin/env node
/**
 * Step 3: Import Gemini's matched Strong's numbers back into the MIB JSON
 * Usage: node import_strongs_review.js <gemini-output.json>
 */

const fs   = require('fs');
const path = require('path');
const { lexicon } = require('../server/data/lexicon.js');

const geminiFiles = process.argv.slice(2);
if (!geminiFiles.length) {
  console.error('Usage: node import_strongs_review.js gemini-response-01.json gemini-response-02.json ...');
  process.exit(1);
}

const MIB_PATH = path.join(__dirname, 'metaphysical-bible-dictionary.json');
const mib      = JSON.parse(fs.readFileSync(MIB_PATH, 'utf8'));

// Merge all response files into one flat array
const entries = [];
for (const file of geminiFiles) {
  const raw      = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fileEntries = Array.isArray(raw) ? raw : raw.entries || [];
  entries.push(...fileEntries);
  console.log(`  Loaded ${fileEntries.length} entries from ${path.basename(file)}`);
}

let imported = 0;
let skipped  = 0;

for (const item of entries) {
  const matches = item.matches;
  if (!matches || matches.length === 0) { skipped++; continue; }

  const mibEntry = mib[item.id];
  if (!mibEntry) { skipped++; continue; }

  mibEntry.strongsNumbers = matches;
  mibEntry.strongsLang    = matches[0]?.startsWith('H') ? 'Hebrew'
                          : matches[0]?.startsWith('G') ? 'Greek'
                          : 'Mixed';
  imported++;
}

fs.writeFileSync(MIB_PATH, JSON.stringify(mib, null, 2));

console.log('\n══════════════════════════════════════════');
console.log('  MIB STRONG\'S ENRICHMENT — Step 3 Done');
console.log('══════════════════════════════════════════');
console.log(`  Imported : ${imported}`);
console.log(`  Skipped  : ${skipped}`);
console.log(`  MIB saved to ${MIB_PATH}`);

// Final stats
const withStrongs = mib.filter(e => e.strongsNumbers?.length).length;
console.log(`\n  Final: ${withStrongs}/${mib.length} entries have Strong's numbers`);
console.log('══════════════════════════════════════════\n');
