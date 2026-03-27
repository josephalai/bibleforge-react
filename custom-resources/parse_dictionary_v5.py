#!/usr/bin/env python3
"""
Metaphysical Bible Dictionary Parser — Version 5 (Definitive)
Combines v3's comprehensive entry capture with v4's rich structure.
Optimized for Bible reading interface with word-click integration.
"""

import json
import re
from html.parser import HTMLParser
from typing import List, Dict, Any, Optional, Tuple

# ─────────────────────────────────────────────
# HTML Extraction
# ─────────────────────────────────────────────

class PreTagExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_pre = False
        self.chunks = []

    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.in_pre = True

    def handle_endtag(self, tag):
        if tag == 'pre':
            self.in_pre = False

    def handle_data(self, data):
        if self.in_pre:
            self.chunks.append(data)


def extract_text(html_path: str) -> str:
    with open(html_path, 'r', encoding='utf-8') as f:
        extractor = PreTagExtractor()
        extractor.feed(f.read())
    return ''.join(extractor.chunks)


# ─────────────────────────────────────────────
# Book Abbreviation Map
# ─────────────────────────────────────────────

BOOK_MAP = {
    'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus',
    'Num': 'Numbers', 'Deut': 'Deuteronomy', 'Josh': 'Joshua',
    'Judg': 'Judges', 'Ruth': 'Ruth',
    'I Sam': '1 Samuel', 'II Sam': '2 Samuel',
    'I Kings': '1 Kings', 'II Kings': '2 Kings',
    'I Chron': '1 Chronicles', 'II Chron': '2 Chronicles',
    'Ezra': 'Ezra', 'Neh': 'Nehemiah', 'Esther': 'Esther',
    'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
    'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon',
    'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
    'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea',
    'Joel': 'Joel', 'Amos': 'Amos', 'Obad': 'Obadiah',
    'Jonah': 'Jonah', 'Jon': 'Jonah', 'Mic': 'Micah',
    'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah',
    'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
    'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke',
    'John': 'John', 'Acts': 'Acts', 'Rom': 'Romans',
    'I Cor': '1 Corinthians', 'II Cor': '2 Corinthians',
    'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians',
    'Col': 'Colossians',
    'I Thess': '1 Thessalonians', 'II Thess': '2 Thessalonians',
    'I Tim': '1 Timothy', 'II Tim': '2 Timothy',
    'Titus': 'Titus', 'Philem': 'Philemon', 'Heb': 'Hebrews',
    'Jas': 'James',
    'I Pet': '1 Peter', 'II Pet': '2 Peter',
    'I John': '1 John', 'II John': '2 John', 'III John': '3 John',
    'Jude': 'Jude', 'Rev': 'Revelation',
}

def normalize_book(abbr: str) -> str:
    abbr = abbr.strip().rstrip('.')
    return BOOK_MAP.get(abbr, abbr)


# ─────────────────────────────────────────────
# Scripture Reference Extraction
# ─────────────────────────────────────────────

def extract_scripture_refs(text: str) -> List[Dict]:
    """
    Extract all scripture refs like (Josh. 10:3), (I Kings 5:12).
    Returns deduplicated list sorted by book/chapter/verse.
    """
    if not text:
        return []

    refs = []
    seen = set()

    # Match patterns: (BookAbbr. Chapter:Verse), (BookAbbr: Chapter:Verse), (BookAbbr Chapter:Verse)
    pattern = re.compile(
        r'\(([IVX]{0,3}\s*[A-Z][a-z]+[.:,]?)\s*(\d+)[:\s](\d+)\)',
        re.UNICODE
    )

    for m in pattern.finditer(text):
        book_raw = m.group(1).strip()
        chapter  = int(m.group(2))
        verse    = int(m.group(3))
        book     = normalize_book(book_raw)
        key      = f"{book} {chapter}:{verse}"

        if key not in seen:
            seen.add(key)
            refs.append({'book': book, 'chapter': chapter, 'verse': verse, 'ref': key})

    return refs


# ─────────────────────────────────────────────
# Variant Parsing  (a, b, c ...)
# ─────────────────────────────────────────────

def parse_variants(text: str) -> List[Dict]:
    """
    Detect and split lettered variants (a B..., b C...) in biblical reference text.
    Only fires when the text contains at least one explicit 'letter CAPITAL' marker.
    """
    if not text:
        return []

    # Collapse the text for scanning
    flat = ' '.join(text.split())

    # Find variant boundaries: single lowercase letter followed by a capital word
    # e.g. "a An Amoritish" or "b A city"
    markers = list(re.finditer(r'(?<!\w)([a-e])\s+([A-Z])', flat))

    if not markers:
        return []

    variants = []
    for i, m in enumerate(markers):
        label = m.group(1)
        start = m.start(2)                           # start of the capital letter
        end   = markers[i + 1].start() if i + 1 < len(markers) else len(flat)
        meaning = flat[start:end].strip().rstrip()
        if meaning:
            variants.append({
                'label': label,
                'meaning': meaning,
                'scriptureRefs': extract_scripture_refs(meaning),
            })

    return variants


# ─────────────────────────────────────────────
# Header Parsing
# ─────────────────────────────────────────────

def parse_header(header: str) -> Optional[Dict]:
    """
    Parse the entry header line.

    Supported patterns
    ------------------
    Word, pron (Lang)— definition
    Word (Lang)— definition
    Word— definition
    Multi Word Name, pron (Lang)— definition
    Word (in A.V., AltSpell1; OtherBook, AltSpell2), pron (Lang)— definition
    """
    if '—' not in header:
        return None

    head, _, definition = header.partition('—')
    head = head.strip()
    definition = definition.strip()

    result = {
        'word':          None,
        'pronunciation': None,
        'etymology':     None,
        'altSpellings':  None,
        'definition':    definition or None,
    }

    # Strip "in A.V." variant-spelling parenthetical that can appear right after the word
    # e.g. "Hezekiah (in A.V., Zephaniah 1:1, Hizkiah; Nehemiah 10:17, Hizkijah), pron (Lang)"
    av_match = re.match(r'^([^(]+)\s*\(in A\.?\s*V\.?[^)]*\)(.*)', head, re.IGNORECASE)
    if av_match:
        word_candidate = av_match.group(1).strip()
        head = word_candidate + av_match.group(2)

    # Extract etymology from the LAST set of parentheses
    paren_m = re.search(r'\(([^)]+)\)\s*$', head)
    if paren_m:
        result['etymology'] = paren_m.group(1).strip()
        head = head[:paren_m.start()].strip()

    # Split word vs pronunciation on first comma
    if ',' in head:
        word_part, _, pron_part = head.partition(',')
        result['word']          = word_part.strip()
        result['pronunciation'] = pron_part.strip() or None
    else:
        result['word'] = head.strip()

    # Clean up any leftover parens that got into the word
    if result['word']:
        result['word'] = re.sub(r'\s*\([^)]*\)\s*', ' ', result['word']).strip()

    if not result['word']:
        return None

    return result


# ─────────────────────────────────────────────
# Block Detection
# ─────────────────────────────────────────────

def is_entry_header(line: str) -> bool:
    """
    True if this line looks like the start of a new dictionary entry.

    Primary rule:
      '—' in line  AND  ',' in first 100 chars
      Handles: Word, pron (Lang)— def | A.V. variants | quoted phrases

    Secondary rule (no-comma entries):
      '—' within first 30 chars  AND  before-dash part looks like a title
      Handles: God— | Adam— | Bible— | Christ— | Egypt— | Devil— etc.
      These major concept entries have no pronunciation so no comma.

    Must have content after the dash to exclude broken/continuation lines.
    Guard against body-text false positives: exclude lines starting with
    'Metaphysical' (section label inside entries).
    """
    s = line.strip()
    if not s or '—' not in s:
        return False

    dash_pos = s.index('—')

    # Must have content after the dash
    if not s[dash_pos + 1:].strip():
        return False

    # Primary rule: comma in first 100 chars
    if ',' in s[:100]:
        return True

    # Secondary rule: title-style entry with no pronunciation
    if dash_pos <= 30:
        before = s[:dash_pos].strip()
        if (before
                and len(before) >= 2
                and before[0].isupper()
                and not before.lower().startswith('metaphysical')):
            return True

    return False


# ─────────────────────────────────────────────
# Entry Block Parser
# ─────────────────────────────────────────────

def parse_block(block_lines: List[str]) -> Optional[Dict]:
    """Full parse of one dictionary block."""
    if not block_lines:
        return None

    header_info = parse_header(block_lines[0].strip())
    if not header_info or not header_info['word']:
        return None

    # Separate body into biblical-context lines vs metaphysical lines
    bio_lines  = []
    meta_lines = []
    in_meta    = False

    for line in block_lines[1:]:
        s = line.strip()
        if not s:
            continue

        if s.startswith('Metaphysical.'):
            in_meta = True
            rest = s[len('Metaphysical.'):].strip()
            if rest:
                meta_lines.append(rest)
        elif in_meta:
            meta_lines.append(s)
        else:
            bio_lines.append(s)

    bio_text  = ' '.join(bio_lines).strip()
    meta_text = ' '.join(meta_lines).strip()

    # Parse variants from bio_text
    variants = parse_variants(bio_text)

    # If no variants, treat bio_text as a single context note
    if not variants and bio_text:
        context = bio_text
    elif variants:
        context = None  # Variants cover it
    else:
        context = None

    # All scripture refs across ALL fields — bio, meta, and definition line
    all_text = ' '.join([header_info.get('definition', '') or '', bio_text, meta_text])
    all_refs = extract_scripture_refs(all_text)

    entry = {
        'word':           header_info['word'],
        'pronunciation':  header_info['pronunciation'],
        'etymology':      header_info['etymology'],
        'definition':     header_info['definition'],
        'context':        context,
        'variants':       variants if variants else None,
        'metaphysical':   meta_text or None,
        'scriptureRefs':  all_refs if all_refs else None,
    }

    # Drop None fields for clean output
    return {k: v for k, v in entry.items() if v is not None}


# ─────────────────────────────────────────────
# Main Parsing Loop
# ─────────────────────────────────────────────

def parse_all(text: str) -> List[Dict]:
    lines   = text.split('\n')
    entries = []
    current_block: List[str] = []

    for line in lines:
        if is_entry_header(line):
            if current_block:
                entry = parse_block(current_block)
                if entry:
                    entries.append(entry)
            current_block = [line]
        else:
            if current_block:
                current_block.append(line)

    # Don't miss the last block
    if current_block:
        entry = parse_block(current_block)
        if entry:
            entries.append(entry)

    return entries


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    HTML_PATH   = 'metaphysical-interpretation-of-the-bible.txt.html'
    OUTPUT_PATH = 'metaphysical-bible-dictionary.json'

    print("=" * 62)
    print("  METAPHYSICAL BIBLE DICTIONARY — v5 (Definitive)")
    print("=" * 62)

    print("\n[1/3] Extracting text from HTML...")
    text = extract_text(HTML_PATH)
    print(f"      ✓ {len(text):,} characters extracted")

    print("\n[2/3] Parsing all entries...")
    entries = parse_all(text)
    entries.sort(key=lambda e: e.get('word', '').lower())
    print(f"      ✓ {len(entries):,} entries parsed")

    print("\n[3/3] Writing JSON...")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    print(f"      ✓ Written to {OUTPUT_PATH}")

    # ── Accuracy Report ──────────────────────────────────────
    n = len(entries)
    fields = ['word', 'pronunciation', 'etymology', 'definition',
              'context', 'variants', 'metaphysical', 'scriptureRefs']

    print("\n" + "=" * 62)
    print("  ACCURACY REPORT")
    print("=" * 62)
    for f in fields:
        count = sum(1 for e in entries if f in e and e[f])
        pct   = count / n * 100
        bar   = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
        print(f"  {f:<20} {count:5}/{n}  ({pct:5.1f}%)  {bar}")

    total_variants = sum(len(e['variants']) for e in entries if 'variants' in e)
    total_refs     = sum(len(e['scriptureRefs']) for e in entries if 'scriptureRefs' in e)

    print(f"\n  Total variant definitions : {total_variants:,}")
    print(f"  Total scripture refs      : {total_refs:,}")

    # ── Sample: Debir ────────────────────────────────────────
    print("\n" + "=" * 62)
    print("  SAMPLE — Debir")
    print("=" * 62)
    sample = next((e for e in entries if e.get('word', '').lower() == 'debir'), entries[0])
    print(json.dumps(sample, indent=2))


if __name__ == '__main__':
    main()
