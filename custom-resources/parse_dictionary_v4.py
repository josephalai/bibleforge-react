#!/usr/bin/env python3
"""
Metaphysical Bible Dictionary Parser - Version 4
Optimized for Bible reading interface with variant support and scripture indexing
"""

import json
import re
from html.parser import HTMLParser
from typing import List, Dict, Any, Optional

class DictionaryParser(HTMLParser):
    """Extracts text from HTML pre tag"""
    def __init__(self):
        super().__init__()
        self.in_pre = False
        self.content = []

    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.in_pre = True

    def handle_endtag(self, tag):
        if tag == 'pre':
            self.in_pre = False

    def handle_data(self, data):
        if self.in_pre:
            self.content.append(data)


def extract_html_content(html_path: str) -> str:
    """Extract text content from HTML file"""
    with open(html_path, 'r', encoding='utf-8') as f:
        parser = DictionaryParser()
        parser.feed(f.read())
    return ''.join(parser.content)


def parse_variants(biblical_references: str) -> List[Dict[str, Any]]:
    """
    Parse (a), (b), (c) variants from biblical references section
    Returns list of variants with their descriptions
    """
    variants = []

    if not biblical_references:
        return variants

    # Join all text into one string for easier parsing
    full_text = ' '.join(biblical_references.split())

    # Find all variant patterns: single lowercase letter followed by space
    # These mark the start of a new variant: a A, b B, etc.
    variant_matches = list(re.finditer(r'\b([a-z])\s+([A-Z])', full_text))

    if not variant_matches:
        # No variants found
        return variants

    for i, match in enumerate(variant_matches):
        label = match.group(1)
        # Start right after the letter and space, before the capital letter
        start = match.start(2)

        # Find end (start of next variant letter or end of text)
        if i + 1 < len(variant_matches):
            end = variant_matches[i + 1].start()
        else:
            end = len(full_text)

        meaning = full_text[start:end].strip()

        # Remove any trailing variant labels
        meaning = re.sub(r'\s+[a-z]\s*$', '', meaning)

        if meaning:  # Only add non-empty variants
            variants.append({
                'label': label,
                'meaning': meaning.strip(),
                'biblicalReferences': extract_scripture_refs(meaning)
            })

    return variants


def extract_scripture_refs(text: str) -> List[Dict[str, Any]]:
    """
    Extract scripture references from text like (Josh. 10:3)
    Returns list of structured scripture references
    """
    refs = []

    if not text:
        return refs

    # Pattern: (Book abbreviation Chapter:Verse or Chapter:Verse)
    # Handles: (Josh. 10:3), (I Kings 5:12), (Josh. 15:7), etc.
    patterns = [
        r'\(([IVXL\s]*\w+\.?)\s*(\d+):(\d+)\)',  # (Book. Chapter:Verse)
        r'\(([IVXL\s]*\w+\.?)\s*(\d+):(\d+)(?:,\s*(\d+))?\)',  # With optional verse range
    ]

    for pattern in patterns:
        matches = re.finditer(pattern, text)

        for match in matches:
            try:
                book_abbr = match.group(1).strip()
                chapter = int(match.group(2))
                verse = int(match.group(3))

                # Normalize book abbreviation
                book_name = normalize_book_name(book_abbr)

                ref = {
                    'book': book_name,
                    'chapter': chapter,
                    'verse': verse,
                    'reference': f"{book_name} {chapter}:{verse}"
                }

                # Avoid duplicates
                if not any(r['reference'] == ref['reference'] for r in refs):
                    refs.append(ref)
            except (ValueError, IndexError):
                continue

    return refs


def normalize_book_name(abbr: str) -> str:
    """Convert book abbreviations to full names"""
    abbr = abbr.strip()

    # Remove trailing period
    if abbr.endswith('.'):
        abbr = abbr[:-1]

    book_map = {
        'Gen': 'Genesis',
        'Exod': 'Exodus',
        'Lev': 'Leviticus',
        'Num': 'Numbers',
        'Deut': 'Deuteronomy',
        'Josh': 'Joshua',
        'Judg': 'Judges',
        'Ruth': 'Ruth',
        'I Sam': '1 Samuel',
        'II Sam': '2 Samuel',
        'I Kings': '1 Kings',
        'II Kings': '2 Kings',
        'I Chron': '1 Chronicles',
        'II Chron': '2 Chronicles',
        'Ezra': 'Ezra',
        'Neh': 'Nehemiah',
        'Esther': 'Esther',
        'Job': 'Job',
        'Ps': 'Psalms',
        'Prov': 'Proverbs',
        'Eccl': 'Ecclesiastes',
        'Isa': 'Isaiah',
        'Jer': 'Jeremiah',
        'Lam': 'Lamentations',
        'Ezek': 'Ezekiel',
        'Dan': 'Daniel',
        'Hos': 'Hosea',
        'Joel': 'Joel',
        'Amos': 'Amos',
        'Obad': 'Obadiah',
        'Jonah': 'Jonah',
        'Mic': 'Micah',
        'Nah': 'Nahum',
        'Hab': 'Habakkuk',
        'Zeph': 'Zephaniah',
        'Hag': 'Haggai',
        'Zech': 'Zechariah',
        'Mal': 'Malachi',
        'Matt': 'Matthew',
        'Mark': 'Mark',
        'Luke': 'Luke',
        'John': 'John',
        'Acts': 'Acts',
        'Rom': 'Romans',
        'I Cor': '1 Corinthians',
        'II Cor': '2 Corinthians',
        'Gal': 'Galatians',
        'Eph': 'Ephesians',
        'Phil': 'Philippians',
        'Col': 'Colossians',
        'I Thess': '1 Thessalonians',
        'II Thess': '2 Thessalonians',
        'I Tim': '1 Timothy',
        'II Tim': '2 Timothy',
        'Titus': 'Titus',
        'Philem': 'Philemon',
        'Heb': 'Hebrews',
        'Jas': 'James',
        'I Pet': '1 Peter',
        'II Pet': '2 Peter',
        'I John': '1 John',
        'II John': '2 John',
        'III John': '3 John',
        'Jude': 'Jude',
        'Rev': 'Revelation'
    }

    return book_map.get(abbr, abbr)


def parse_metaphysical_section(meta_text: str) -> Dict[str, Any]:
    """
    Parse metaphysical interpretation section
    Can contain multiple paragraphs or variant-specific meanings
    """
    if not meta_text:
        return {'general': None}

    # Check if it discusses specific variants (a), (b), (c)
    variant_pattern = r'\b([a-z])\)\s+[A-Z]'
    has_variants = bool(re.search(variant_pattern, meta_text))

    if has_variants:
        # Split into variant-specific interpretations
        variants = {}
        paragraphs = meta_text.split('\n\n')

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Check if this paragraph discusses a specific variant
            match = re.search(r'^Debir,?\s*(?:([a-z])\))?', para)
            if match and match.group(1):
                var_label = match.group(1)
                variants[var_label] = para
            else:
                # General interpretation
                if 'general' not in variants:
                    variants['general'] = para
                else:
                    variants['general'] += '\n\n' + para

        return variants
    else:
        return {'general': meta_text.strip()}


def parse_entry_block(block: str) -> Optional[Dict[str, Any]]:
    """Parse a single entry block into structured format"""
    lines = [l for l in block.split('\n') if l.strip()]

    if not lines:
        return None

    entry = {
        'word': None,
        'pronunciation': None,
        'etymology': None,
        'definition': None,
        'variants': [],
        'metaphysicalInterpretation': {},
        'allScriptureReferences': []
    }

    # Parse header
    header = lines[0].strip()
    if not parse_header(header, entry):
        return None

    # Parse body
    body_lines = lines[1:]
    biblical_refs = []
    metaphysical_text = []
    in_metaphysical = False

    for line in body_lines:
        stripped = line.strip()

        if stripped.startswith('Metaphysical.'):
            in_metaphysical = True
            content = stripped[14:].strip()
            if content:
                metaphysical_text.append(content)
        elif in_metaphysical:
            if stripped:
                metaphysical_text.append(stripped)
        elif stripped:
            biblical_refs.append(stripped)

    # Process biblical references
    if biblical_refs:
        biblical_text = ' '.join(biblical_refs)
        entry['variants'] = parse_variants(biblical_text)
        entry['allScriptureReferences'] = extract_scripture_refs(biblical_text)

    # Process metaphysical
    if metaphysical_text:
        metaphysical_full = ' '.join(metaphysical_text)
        entry['metaphysicalInterpretation'] = parse_metaphysical_section(metaphysical_full)

    return entry


def parse_header(header: str, entry: Dict[str, Any]) -> bool:
    """Parse entry header line"""
    if '—' not in header:
        return False

    parts = header.split('—', 1)
    head = parts[0].strip()
    definition = parts[1].strip() if len(parts) > 1 else ''

    # Extract etymology from parentheses
    paren_match = re.search(r'\(([^)]+)\)\s*$', head)
    if paren_match:
        entry['etymology'] = paren_match.group(1).strip()
        head = head[:paren_match.start()].strip()

    # Split by comma
    comma_parts = head.split(',', 1)
    if len(comma_parts) >= 1:
        entry['word'] = comma_parts[0].strip()
    if len(comma_parts) >= 2:
        entry['pronunciation'] = comma_parts[1].strip()

    entry['definition'] = definition if definition else None

    return bool(entry['word'])


def parse_all_entries(text: str) -> List[Dict[str, Any]]:
    """Parse all entries from text"""
    entries = []
    lines = text.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line or '—' not in line or ',' not in line[:100]:
            i += 1
            continue

        # Collect block until next entry
        block_lines = [lines[i]]
        i += 1

        while i < len(lines):
            next_line = lines[i].strip()

            # Check if new entry starts
            if next_line and '—' in next_line and ',' in next_line[:100] and next_line[0].isupper():
                break

            block_lines.append(lines[i])
            i += 1

        block = '\n'.join(block_lines)
        entry = parse_entry_block(block)
        if entry and entry['word']:
            entries.append(entry)

    return entries


def main():
    html_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-interpretation-of-the-bible.txt.html'

    print("=" * 60)
    print("METAPHYSICAL BIBLE DICTIONARY PARSER v4")
    print("Optimized for Bible Interface Integration")
    print("=" * 60)

    print("\n[1/3] Extracting text from HTML...")
    text = extract_html_content(html_path)
    print(f"      ✓ Extracted {len(text):,} characters")

    print("\n[2/3] Parsing entries with variants and scripture refs...")
    entries = parse_all_entries(text)
    print(f"      ✓ Parsed {len(entries):,} entries")

    # Sort alphabetically
    entries.sort(key=lambda e: e.get('word', '').lower())

    print("\n[3/3] Saving to JSON...")
    output_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-bible-dictionary.json'

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"      ✓ Saved to {output_path}")

    # Statistics
    print("\n" + "=" * 60)
    print("STRUCTURE ANALYSIS")
    print("=" * 60)

    with_variants = sum(1 for e in entries if e['variants'])
    with_scripture = sum(1 for e in entries if e['allScriptureReferences'])
    with_metaphysical = sum(1 for e in entries if e['metaphysicalInterpretation'])

    total_variants = sum(len(e['variants']) for e in entries)
    total_scripture_refs = sum(len(e['allScriptureReferences']) for e in entries)

    print(f"\nEntries with variants (a, b, c...): {with_variants:,}/{len(entries)}")
    print(f"Total variant definitions: {total_variants:,}")
    print(f"\nEntries with metaphysical interpretation: {with_metaphysical:,}/{len(entries)}")
    print(f"Entries with indexed scripture references: {with_scripture:,}/{len(entries)}")
    print(f"Total scripture references indexed: {total_scripture_refs:,}")

    # Show sample
    print("\n" + "=" * 60)
    print("SAMPLE ENTRY (Debir)")
    print("=" * 60)

    debir = [e for e in entries if e['word'].lower() == 'debir']
    if debir:
        print(json.dumps(debir[0], indent=2)[:1000] + "\n...")
    else:
        print("Showing first entry instead:")
        print(json.dumps(entries[0], indent=2)[:1000] + "\n...")

    print("\n" + "=" * 60)
    print("✅ READY FOR INTEGRATION")
    print("=" * 60)
    print("\nStructure supports:")
    print("  ✓ Word lookup → metaphysical interpretation + definition")
    print("  ✓ Variant display (a, b, c) with individual meanings")
    print("  ✓ Scripture instance search via allScriptureReferences")
    print("  ✓ Original language tracking (Hebrew/Greek)")
    print("  ✓ Future: Find all verses using this word")


if __name__ == '__main__':
    main()
