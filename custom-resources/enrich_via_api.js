#!/usr/bin/env node
/**
 * Iteratively sends each Gemini chunk to Claude API and saves responses.
 * Usage: ANTHROPIC_API_KEY=your_key node enrich_via_api.js
 *
 * Or for Gemini: GEMINI_API_KEY=your_key node enrich_via_api.js --gemini
 */

const fs      = require('fs');
const path    = require('path');
const https   = require('https');

const USE_GEMINI = process.argv.includes('--gemini');
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!USE_GEMINI && !CLAUDE_KEY) {
  console.error('Set ANTHROPIC_API_KEY or use --gemini with GEMINI_API_KEY');
  process.exit(1);
}
if (USE_GEMINI && !GEMINI_KEY) {
  console.error('Set GEMINI_API_KEY');
  process.exit(1);
}

// ── Find all chunk files ──────────────────────────────────────────────────────
const chunkFiles = fs.readdirSync(__dirname)
  .filter(f => f.match(/^gemini-chunk-\d+\.json$/))
  .sort()
  .map(f => path.join(__dirname, f));

if (!chunkFiles.length) {
  console.error('No chunk files found. Run enrich_strongs.js and split_for_gemini.js first.');
  process.exit(1);
}

console.log(`\nFound ${chunkFiles.length} chunks to process via ${USE_GEMINI ? 'Gemini' : 'Claude'}\n`);

// ── API call helpers ──────────────────────────────────────────────────────────

function callClaude(instructions, entries) {
  return new Promise((resolve, reject) => {
    const prompt = `${instructions}\n\nHere are the entries:\n${JSON.stringify(entries, null, 2)}`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // fast + cheap, accurate enough for matching
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callGemini(instructions, entries) {
  return new Promise((resolve, reject) => {
    const prompt = `${instructions}\n\nHere are the entries:\n${JSON.stringify(entries, null, 2)}`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path:     `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.candidates[0].content.parts[0].text);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractJSON(text) {
  // Strip markdown code fences if the model wrapped the response
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Find the JSON array
  const start = clean.indexOf('[');
  const end   = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in response');
  return JSON.parse(clean.slice(start, end + 1));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  const allResults = [];

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkPath     = chunkFiles[i];
    const chunkName     = path.basename(chunkPath);
    const responseFile  = chunkPath.replace('gemini-chunk-', 'gemini-response-');

    // Skip if already done
    if (fs.existsSync(responseFile)) {
      console.log(`  [${i+1}/${chunkFiles.length}] ${chunkName} — already done, skipping`);
      const existing = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
      allResults.push(...existing);
      continue;
    }

    const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
    console.log(`  [${i+1}/${chunkFiles.length}] ${chunkName} — ${chunk.entries.length} entries...`);

    let attempts = 0;
    let result = null;

    while (attempts < 3) {
      try {
        const raw = USE_GEMINI
          ? await callGemini(chunk._instructions, chunk.entries)
          : await callClaude(chunk._instructions, chunk.entries);

        result = extractJSON(raw);
        break;
      } catch (err) {
        attempts++;
        console.log(`    ⚠ Attempt ${attempts} failed: ${err.message}`);
        if (attempts < 3) await sleep(3000);
      }
    }

    if (!result) {
      console.log(`    ✗ Skipping chunk after 3 failed attempts`);
      continue;
    }

    // Save individual response file (so you can resume if interrupted)
    fs.writeFileSync(responseFile, JSON.stringify(result, null, 2));
    allResults.push(...result);

    console.log(`    ✓ Got ${result.length} matches`);

    // Brief pause between chunks to avoid rate limits
    if (i < chunkFiles.length - 1) await sleep(1000);
  }

  // ── Import all results into MIB ──────────────────────────────────────────
  console.log('\nImporting all results into MIB...');
  const { execSync } = require('child_process');

  const responseFiles = fs.readdirSync(__dirname)
    .filter(f => f.match(/^gemini-response-\d+\.json$/))
    .sort()
    .map(f => path.join(__dirname, f))
    .join(' ');

  if (responseFiles) {
    execSync(`node ${path.join(__dirname, 'import_strongs_review.js')} ${responseFiles}`, {
      stdio: 'inherit',
      cwd: __dirname,
    });
  }
}

main().catch(console.error);
