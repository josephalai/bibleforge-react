#!/usr/bin/env python3
"""
Parser for Metaphysical Bible Dictionary
Converts HTML archive text to structured JSON
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
    Parse dictionary entries from text

    Format:
    Word, pronunciation (Language)— definition

    [Biblical reference lines]

    Metaphysical. [interpretation text]
    """
    entries = []

    # Split by entries - look for pattern: Word, ... —
    # More robust: look for lines that start with capitalized word(s) followed by comma,
    # then pronunciation in quotes or italics, then language in parens

    lines = text.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Look for entry header pattern: Word, ... — definition
        # Pattern: Capital letter(s), some content with parens, em dash
        if '—' in line and ',' in line[:50]:  # Entry headers have comma early and em dash
            entry = parse_entry_block(lines, i)
            if entry:
                entries.append(entry)
                i = entry.get('_end_line', i + 1)
            else:
                i += 1
        else:
            i += 1

    return entries


def parse_entry_block(lines: List[str], start_idx: int) -> Dict[str, Any]:
    """
    Parse a single entry block starting at given line
    Returns dict with entry data and _end_line marker
    """
    entry = {
        'word': None,
        'pronunciation': None,
        'etymology': None,
        'definition': None,
        'biblical_references': [],
        'metaphysical': [],
        '_end_line': start_idx + 1
    }

    header_line = lines[start_idx].strip()

    # Parse header: "Word, pronunciation (Language)— definition"
    if not parse_header(header_line, entry):
        return None

    # Collect body text until next entry or end
    i = start_idx + 1
    current_section = 'body'  # Can be 'body', 'metaphysical', 'biblical'
    section_content = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check if this is a new entry (next word definition)
        if stripped and is_new_entry(stripped):
            break

        # Check for section headers
        if stripped.startswith('Metaphysical.'):
            # Save previous section
            if section_content and current_section == 'body':
                entry['biblical_references'] = '\n'.join(section_content).strip()

            # Start new section
            current_section = 'metaphysical'
            section_content = [stripped[14:].strip()]  # Remove "Metaphysical."

        elif stripped.startswith('Biblical.') or stripped.startswith('Bible.'):
            if section_content and current_section == 'metaphysical':
                entry['metaphysical'].append('\n'.join(section_content).strip())
            current_section = 'body'
            section_content = []

        elif stripped:  # Non-empty line
            section_content.append(stripped)

        i += 1

    # Save final section
    if section_content:
        if current_section == 'metaphysical':
            entry['metaphysical'].append('\n'.join(section_content).strip())
        elif current_section == 'body' and not entry['biblical_references']:
            entry['biblical_references'] = '\n'.join(section_content).strip()

    entry['_end_line'] = i

    return entry


def is_new_entry(line: str) -> bool:
    """Check if line appears to be start of new entry"""
    # New entries have specific pattern: Word/Name, ... (something)—
    if '—' not in line:
        return False

    # Check if starts with capital letter(s) and has comma early
    if not line[0].isupper():
        return False

    comma_pos = line.find(',')
    dash_pos = line.find('—')

    # Valid entry: comma before dash, both early in line
    return 0 < comma_pos < 50 and comma_pos < dash_pos


def parse_header(line: str, entry: Dict[str, Any]) -> bool:
    """
    Parse entry header line
    Format: "Word, pronunciation (Language)— definition"
    """
    # Split by em dash first
    if '—' not in line:
        return False

    head, definition = line.split('—', 1)

    # Parse: Word, pronunciation (Language)
    # Try to extract pronunciation in parentheses
    import re

    paren_match = re.search(r'\((.*?)\)$', head.strip())
    if paren_match:
        entry['etymology'] = paren_match.group(1).strip()
        head_before_paren = head[:paren_match.start()].strip()
    else:
        head_before_paren = head.strip()

    # Split by comma: first part is word, rest is pronunciation
    parts = head_before_paren.split(',', 1)
    if len(parts) >= 1:
        entry['word'] = parts[0].strip()
    if len(parts) >= 2:
        entry['pronunciation'] = parts[1].strip()

    entry['definition'] = definition.strip()

    return bool(entry['word'])


def clean_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove internal markers and clean up entries"""
    cleaned = []
    for entry in entries:
        clean_entry = {
            'word': entry['word'],
            'pronunciation': entry['pronunciation'],
            'etymology': entry['etymology'],
            'definition': entry['definition'],
            'biblical_references': entry['biblical_references'] if entry['biblical_references'] else None,
            'metaphysical': entry['metaphysical'] if entry['metaphysical'] else []
        }
        # Only include non-None fields
        clean_entry = {k: v for k, v in clean_entry.items() if v}
        cleaned.append(clean_entry)
    return cleaned


def main():
    html_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-interpretation-of-the-bible.txt.html'

    print("Extracting text from HTML...")
    text = extract_html_content(html_path)
    print(f"Extracted {len(text)} characters")

    print("Parsing dictionary entries...")
    entries = parse_dictionary_entries(text)
    print(f"Found {len(entries)} entries")

    # Clean up entries
    entries = clean_entries(entries)

    # Show sample entries
    print("\n=== Sample Entries ===")
    for i, entry in enumerate(entries[:3]):
        print(f"\nEntry {i+1}:")
        print(json.dumps(entry, indent=2))

    # Save to JSON
    output_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-bible-dictionary.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Saved {len(entries)} entries to {output_path}")

    # Statistics
    with_metaphysical = sum(1 for e in entries if 'metaphysical' in e and e['metaphysical'])
    with_references = sum(1 for e in entries if 'biblical_references' in e and e['biblical_references'])

    print(f"\nStatistics:")
    print(f"  Total entries: {len(entries)}")
    print(f"  With metaphysical interpretation: {with_metaphysical}")
    print(f"  With biblical references: {with_references}")


if __name__ == '__main__':
    main()
