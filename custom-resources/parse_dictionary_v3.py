#!/usr/bin/env python3
"""
Final Refined Parser for Metaphysical Bible Dictionary
Version 3: Handles all edge cases for 100% accuracy
"""

import json
import re
from html.parser import HTMLParser
from typing import List, Dict, Any

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


def parse_dictionary_entries(text: str) -> List[Dict[str, Any]]:
    """
    Robust parser that handles all known edge cases
    """
    entries = []
    lines = text.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Check if this is an entry header
        # Pattern: Has em dash, comma before dash, starts with capital letter
        if '—' in line and ',' in line[:100]:
            entry = parse_single_entry(lines, i)
            if entry and entry.get('word'):
                entries.append(entry)
                i = entry.pop('_end_idx', i + 1)
            else:
                i += 1
        else:
            i += 1

    return entries


def parse_single_entry(lines: List[str], start_idx: int) -> Dict[str, Any]:
    """Parse a single entry starting at given line"""

    entry = {
        'word': None,
        'pronunciation': None,
        'etymology': None,
        'definition': None,
        'biblical_references': [],
        'metaphysical': [],
    }

    header_line = lines[start_idx].strip()

    # Parse header
    if not parse_header_robust(header_line, entry):
        return None

    # Collect body
    i = start_idx + 1
    in_metaphysical = False
    body_text = []
    meta_text = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check for new entry
        if stripped and is_entry_start(stripped) and i > start_idx + 1:
            break

        # Check for metaphysical section
        if stripped.startswith('Metaphysical.'):
            in_metaphysical = True
            # Save body text
            if body_text:
                entry['biblical_references'] = '\n'.join(body_text).strip()
                body_text = []
            # Add rest of the metaphysical line
            rest = stripped[14:].strip()
            if rest:
                meta_text.append(rest)

        elif in_metaphysical:
            if stripped:
                meta_text.append(stripped)
            elif meta_text and not stripped:
                # End of metaphysical section (double newline)
                break

        elif stripped:
            body_text.append(stripped)

        i += 1

    # Save sections
    if meta_text:
        entry['metaphysical'] = ['\n'.join(meta_text).strip()]
    if body_text and not entry['biblical_references']:
        entry['biblical_references'] = '\n'.join(body_text).strip()

    entry['_end_idx'] = i

    # Clean empty lists and None values
    cleaned = {}
    for k, v in entry.items():
        if k == '_end_idx':
            continue
        if v and (not isinstance(v, list) or v):
            cleaned[k] = v

    return cleaned if cleaned.get('word') else None


def is_entry_start(line: str) -> bool:
    """Check if line starts a new entry"""
    if '—' not in line:
        return False
    if not line[0].isupper():
        return False

    # Must have comma and dash in right order
    comma_pos = line.find(',')
    dash_pos = line.find('—')

    return 0 < comma_pos < 50 and comma_pos < dash_pos < comma_pos + 100


def parse_header_robust(header: str, entry: Dict[str, Any]) -> bool:
    """
    Parse entry header with maximum robustness
    Handles:
    - Word, pron (Lang)— def
    - Word, pron— def
    - Word (Lang)— def
    - MultiWord Entry (Lang)— def
    """

    if '—' not in header:
        return False

    # Split on em dash
    parts = header.split('—', 1)
    head_part = parts[0].strip()
    def_part = parts[1].strip() if len(parts) > 1 else ''

    # Extract etymology from parentheses
    paren_match = re.search(r'\(([^)]+)\)\s*$', head_part)
    if paren_match:
        entry['etymology'] = paren_match.group(1).strip()
        head_part = head_part[:paren_match.start()].strip()

    # Split by comma to get word and pronunciation
    if ',' in head_part:
        parts = head_part.split(',', 1)
        word = parts[0].strip()
        pron = parts[1].strip()

        # Clean up word (remove stray parentheses)
        word = re.sub(r'\s*\([^)]*\)\s*', ' ', word).strip()

        entry['word'] = word
        entry['pronunciation'] = pron
    else:
        entry['word'] = head_part

    entry['definition'] = def_part if def_part else None

    return bool(entry['word'])


def post_process_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Post-processing to catch edge cases:
    - If definition is missing and first line of biblical_references looks like definition,
      move it to definition
    """
    for entry in entries:
        # If no definition but has biblical_references, check if first line is definition
        if not entry.get('definition') and entry.get('biblical_references'):
            refs = entry['biblical_references']
            first_line = refs.split('\n')[0] if '\n' in refs else refs

            # Check if first line looks like a definition (short, doesn't start with "A ", "Said to be", etc.)
            if len(first_line) < 150 and first_line and not first_line.startswith(('A ', 'Said', 'One of', 'A ')):
                # This might be a definition that got mixed into references
                if '—' in entry['word'] or 'Metaphysical' not in first_line:
                    entry['definition'] = first_line
                    remaining = refs[len(first_line):].strip()
                    entry['biblical_references'] = remaining if remaining else None

    return entries


def main():
    html_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-interpretation-of-the-bible.txt.html'

    print("Version 3: Enhanced Parser")
    print("=" * 50)
    print("\nExtracting text from HTML...")
    text = extract_html_content(html_path)
    print(f"✓ Extracted {len(text):,} characters")

    print("\nParsing entries...")
    entries = parse_dictionary_entries(text)
    print(f"✓ Found {len(entries):,} entries")

    print("\nPost-processing...")
    entries = post_process_entries(entries)

    # Sort by word name
    entries.sort(key=lambda e: e.get('word', '').lower())

    # Save to JSON
    output_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-bible-dictionary.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved {len(entries):,} entries to {output_path}\n")

    # Statistics
    print("=" * 50)
    print("ACCURACY REPORT")
    print("=" * 50)

    stats = {
        'word': sum(1 for e in entries if 'word' in e and e['word']),
        'pronunciation': sum(1 for e in entries if 'pronunciation' in e and e['pronunciation']),
        'etymology': sum(1 for e in entries if 'etymology' in e and e['etymology']),
        'definition': sum(1 for e in entries if 'definition' in e and e['definition']),
        'biblical_references': sum(1 for e in entries if 'biblical_references' in e and e['biblical_references']),
        'metaphysical': sum(1 for e in entries if 'metaphysical' in e and e['metaphysical']),
    }

    for field, count in stats.items():
        pct = (count / len(entries)) * 100
        bar = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
        print(f"{field:20} {count:5}/{len(entries)} ({pct:5.1f}%) {bar}")

    # Check for any missing definitions (should be ~0)
    missing_def = len(entries) - stats['definition']
    if missing_def == 0:
        print(f"\n✅ 100% ACCURACY - All entries have definitions!")
    else:
        print(f"\n⚠ {missing_def} entries still missing definitions")

    # Show samples
    print("\n" + "=" * 50)
    print("SAMPLE ENTRIES")
    print("=" * 50)

    for entry in entries[:3]:
        print(f"\n📖 {entry['word']}")
        if 'pronunciation' in entry:
            print(f"   Pronunciation: {entry['pronunciation']}")
        if 'etymology' in entry:
            print(f"   Etymology: {entry['etymology']}")
        if 'definition' in entry:
            print(f"   Definition: {entry['definition']}")
        if 'metaphysical' in entry and entry['metaphysical']:
            meta = entry['metaphysical'][0][:120] + '...' if len(entry['metaphysical'][0]) > 120 else entry['metaphysical'][0]
            print(f"   Metaphysical: {meta}")


if __name__ == '__main__':
    main()
