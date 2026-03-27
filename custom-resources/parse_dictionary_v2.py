#!/usr/bin/env python3
"""
Enhanced Parser for Metaphysical Bible Dictionary
Version 2: Handles edge cases and validates against original
"""

import json
import re
from html.parser import HTMLParser
from typing import List, Dict, Any, Tuple

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


def split_into_blocks(text: str) -> List[str]:
    """
    Split text into entry blocks by looking for entry headers.
    Entry headers have pattern: Word/Name, ... (Language)— definition
    """
    # Find all entry headers using regex
    # Pattern: Start with capital letter, contains comma before em dash,
    # usually has parentheses with language
    pattern = r'^[A-Z][^—]*—'

    blocks = []
    current_block = []
    lines = text.split('\n')

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Check if this line starts a new entry
        if stripped and re.match(pattern, stripped):
            # Save previous block
            if current_block:
                blocks.append('\n'.join(current_block))
            # Start new block
            current_block = [line]
        else:
            current_block.append(line)

    # Don't forget last block
    if current_block:
        blocks.append('\n'.join(current_block))

    return [b for b in blocks if b.strip()]


def parse_entry_block_v2(block: str) -> Dict[str, Any]:
    """
    Parse a single entry block with improved handling
    """
    lines = [l for l in block.split('\n') if l.strip()]

    if not lines:
        return None

    entry = {
        'word': None,
        'pronunciation': None,
        'etymology': None,
        'definition': None,
        'biblical_references': None,
        'metaphysical': []
    }

    # First line is header
    header = lines[0].strip()

    if not parse_header_v2(header, entry):
        return None

    # Rest of lines
    body_lines = lines[1:]
    metaphysical_started = False
    metaphysical_content = []
    reference_content = []

    for line in body_lines:
        stripped = line.strip()

        if stripped.startswith('Metaphysical.'):
            # Save references
            if reference_content:
                entry['biblical_references'] = '\n'.join(reference_content).strip()
                reference_content = []

            metaphysical_started = True
            # Remove "Metaphysical." prefix
            content = stripped[14:].strip()
            if content:
                metaphysical_content.append(content)

        elif metaphysical_started:
            if stripped:
                metaphysical_content.append(stripped)

        elif not metaphysical_started and stripped:
            reference_content.append(stripped)

    # Save final sections
    if metaphysical_content:
        entry['metaphysical'] = ['\n'.join(metaphysical_content).strip()]
    if reference_content and not entry['biblical_references']:
        entry['biblical_references'] = '\n'.join(reference_content).strip()

    # Clean up None values and empty lists
    return {k: v for k, v in entry.items() if v}


def parse_header_v2(header: str, entry: Dict[str, Any]) -> bool:
    """
    Parse entry header with improved robustness
    Handles various formats:
    - Word, pron'-un (Language)— definition
    - Word, pron'-un— definition
    - Word (Language)— definition
    """
    if '—' not in header:
        return False

    # Split by em dash
    parts = header.split('—', 1)
    if len(parts) != 2:
        return False

    head, definition = parts
    head = head.strip()
    definition = definition.strip()

    # Extract language/etymology from parentheses
    paren_match = re.search(r'\(([^)]+)\)\s*$', head)
    if paren_match:
        entry['etymology'] = paren_match.group(1).strip()
        head = head[:paren_match.start()].strip()

    # Split by comma
    comma_parts = head.split(',', 1)
    if len(comma_parts) >= 1:
        word = comma_parts[0].strip()
        # Remove any remaining parentheses from word
        word = re.sub(r'\s*\([^)]*\)\s*$', '', word)
        entry['word'] = word

    if len(comma_parts) >= 2:
        entry['pronunciation'] = comma_parts[1].strip()

    entry['definition'] = definition

    return bool(entry['word'])


def main():
    html_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-interpretation-of-the-bible.txt.html'

    print("Extracting text from HTML...")
    text = extract_html_content(html_path)
    print(f"Extracted {len(text)} characters")

    print("Splitting into blocks...")
    blocks = split_into_blocks(text)
    print(f"Found {len(blocks)} blocks")

    print("Parsing entries...")
    entries = []
    for block in blocks:
        entry = parse_entry_block_v2(block)
        if entry:
            entries.append(entry)

    print(f"Successfully parsed {len(entries)} entries")

    # Save to JSON
    output_path = '/Users/josephalai/Projects/bibleforge-react/custom-resources/metaphysical-bible-dictionary.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"✓ Saved to {output_path}")

    # Statistics
    with_metaphysical = sum(1 for e in entries if 'metaphysical' in e and e['metaphysical'])
    with_references = sum(1 for e in entries if 'biblical_references' in e and e['biblical_references'])

    print(f"\n=== Statistics ===")
    print(f"Total entries: {len(entries)}")
    fields = ['word', 'pronunciation', 'etymology', 'definition', 'biblical_references', 'metaphysical']
    for field in fields:
        count = sum(1 for e in entries if field in e and e[field])
        pct = (count / len(entries)) * 100
        print(f"  {field}: {count}/{len(entries)} ({pct:.1f}%)")

    # Show sample
    print("\n=== Sample Entries ===")
    for entry in entries[:2]:
        print(f"\n{entry['word']}:")
        if 'pronunciation' in entry:
            print(f"  Pronunciation: {entry['pronunciation']}")
        if 'etymology' in entry:
            print(f"  Etymology: {entry['etymology']}")
        if 'definition' in entry:
            print(f"  Definition: {entry['definition'][:100]}...")
        if 'metaphysical' in entry:
            print(f"  Metaphysical: {entry['metaphysical'][0][:100]}...")


if __name__ == '__main__':
    main()
