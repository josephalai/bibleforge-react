#!/usr/bin/env python3
"""
Bible Word Lookup
─────────────────
For any given word, displays:
  1. Basic English definition
  2. Hebrew / Greek concordance (Strong's)
  3. Metaphysical interpretation (Fillmore's MIB)

Usage:
  python3 lookup.py light
  python3 lookup.py "Aaron"
  python3 lookup.py love --all     # show all Strong's matches, not just top
"""

import json
import re
import subprocess
import sys
import textwrap
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
DATA      = ROOT / "server" / "data"
MIB_PATH  = Path(__file__).parent / "metaphysical-bible-dictionary.json"

# ── Terminal colours ──────────────────────────────────────────────────────────
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    GOLD    = "\033[38;5;220m"
    CYAN    = "\033[38;5;117m"
    GREEN   = "\033[38;5;114m"
    PURPLE  = "\033[38;5;183m"
    BLUE    = "\033[38;5;75m"
    RED     = "\033[38;5;203m"
    WHITE   = "\033[97m"
    LINE    = "\033[38;5;240m"

def divider(label="", char="─", width=64):
    if label:
        side = (width - len(label) - 2) // 2
        print(f"{C.LINE}{char * side} {C.BOLD}{C.GOLD}{label}{C.RESET}{C.LINE} {char * side}{C.RESET}")
    else:
        print(f"{C.LINE}{char * width}{C.RESET}")

def wrap(text, indent=4, width=64):
    prefix = " " * indent
    return "\n".join(
        textwrap.fill(line, width=width, initial_indent=prefix, subsequent_indent=prefix)
        for line in text.split("\n") if line.strip()
    )

# ── Load data via Node (avoids re-implementing JS modules) ────────────────────

def load_js_data():
    """Use Node to dump word-map and lexicon to JSON once."""
    script = """
const { wordMap } = require('./server/data/word-map.js');
const { lexicon  } = require('./server/data/lexicon.js');
process.stdout.write(JSON.stringify({ wordMap, lexicon }));
"""
    result = subprocess.run(
        ["node", "-e", script],
        cwd=str(ROOT),
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"{C.RED}Error loading concordance data:{C.RESET}", result.stderr)
        sys.exit(1)
    return json.loads(result.stdout)

def load_mib():
    with open(MIB_PATH, "r") as f:
        return json.load(f)

# ── Lookup helpers ────────────────────────────────────────────────────────────

def normalize(word):
    return re.sub(r"[^\w\s-]", "", word).strip().lower()

def flatten_long(long_def):
    """Recursively flatten nested definition arrays."""
    if isinstance(long_def, str):
        return [long_def]
    result = []
    for item in long_def:
        result.extend(flatten_long(item))
    return result

def get_strongs_entries(word, word_map, lexicon, show_all=False):
    norm = normalize(word)
    candidates = word_map.get(norm) or word_map.get(norm.split()[0]) or []

    if not candidates:
        return []

    entries = []
    for s in candidates:
        entry = lexicon.get(s)
        if not entry:
            continue

        data    = entry.get("data", {})
        def_    = data.get("def", {})
        pronun  = data.get("pronun", {})
        lang    = "Hebrew" if s.startswith("H") else "Greek"

        entries.append({
            "strongs":   s,
            "lang":      lang,
            "base_word": entry.get("base_word", ""),
            "short_def": def_.get("short", ""),
            "long_def":  flatten_long(def_.get("long", [])),
            "usage":     entry.get("usage", ""),
            "pos":       entry.get("pos", ""),
            "pronun":    pronun.get("sbl") or pronun.get("dic") or "",
            "ipa":       pronun.get("ipa", ""),
        })

    return entries if show_all else entries[:3]

def get_mib_entries(word, mib):
    norm = normalize(word)
    matches = []

    for entry in mib:
        entry_word = normalize(entry.get("word", ""))

        # Exact match first
        if entry_word == norm:
            matches.insert(0, entry)
            continue

        # Starts with
        if entry_word.startswith(norm) or norm.startswith(entry_word):
            matches.append(entry)
            continue

        # Check if the word is in the Strong's numbers we assigned
        strongs = entry.get("strongsNumbers", [])
        if strongs:
            for e in matches:
                pass  # already checked above

    return matches[:3]

def get_mib_by_strongs(strongs_list, mib):
    """Find MIB entries that were assigned any of the given Strong's numbers."""
    matches = []
    seen = set()
    for entry in mib:
        for s in entry.get("strongsNumbers", []):
            if s in strongs_list and id(entry) not in seen:
                matches.append(entry)
                seen.add(id(entry))
                break
    return matches[:5]

# ── Display ───────────────────────────────────────────────────────────────────

def print_header(word):
    print()
    width = 64
    print(f"{C.LINE}{'═' * width}{C.RESET}")
    title = f"  BIBLE WORD LOOKUP  ·  \"{word.upper()}\""
    print(f"{C.BOLD}{C.GOLD}{title}{C.RESET}")
    print(f"{C.LINE}{'═' * width}{C.RESET}")

def print_basic(word, strongs_entries):
    print()
    divider("BASIC DEFINITION")

    if not strongs_entries:
        print(f"    {C.DIM}No concordance entry found for \"{word}\"{C.RESET}")
        return

    # Use the first/primary entry for the basic definition
    e = strongs_entries[0]
    short = e["short_def"] or (e["long_def"][0] if e["long_def"] else "—")

    print(f"\n  {C.WHITE}{C.BOLD}{word.capitalize()}{C.RESET}  {C.DIM}(English){C.RESET}")
    print(f"  {C.CYAN}{short}{C.RESET}")

    if e["usage"]:
        print(f"\n  {C.DIM}Also used as:{C.RESET} {C.DIM}{e['usage']}{C.RESET}")

def print_concordance(strongs_entries):
    print()
    divider("ORIGINAL LANGUAGE  (Strong's Concordance)")

    if not strongs_entries:
        print(f"    {C.DIM}No Strong's entries found{C.RESET}")
        return

    for e in strongs_entries:
        lang_color = C.BLUE if e["lang"] == "Hebrew" else C.PURPLE
        print()
        print(f"  {C.BOLD}{lang_color}{e['strongs']}{C.RESET}  "
              f"{C.BOLD}{C.WHITE}{e['base_word']}{C.RESET}  "
              f"{C.DIM}({e['lang']}){C.RESET}")

        if e["pronun"]:
            print(f"  {C.DIM}Transliteration:{C.RESET} {C.GREEN}{e['pronun']}{C.RESET}"
                  + (f"   {C.DIM}IPA: /{e['ipa']}/{C.RESET}" if e["ipa"] else ""))

        if e["short_def"]:
            print(f"  {C.CYAN}{e['short_def']}{C.RESET}")

        if e["long_def"]:
            print(f"  {C.DIM}Extended meanings:{C.RESET}")
            for meaning in e["long_def"][:6]:
                print(f"    {C.DIM}·{C.RESET} {meaning}")

        if e["pos"]:
            pos_map = {
                "n-m": "noun (masculine)", "n-f": "noun (feminine)",
                "v": "verb", "adj": "adjective", "adv": "adverb",
                "prep": "preposition", "conj": "conjunction",
            }
            print(f"  {C.DIM}Part of speech: {pos_map.get(e['pos'], e['pos'])}{C.RESET}")

def print_metaphysical(mib_entries):
    print()
    divider("METAPHYSICAL INTERPRETATION  (Charles Fillmore)")

    if not mib_entries:
        print(f"    {C.DIM}No metaphysical entry found{C.RESET}")
        return

    for entry in mib_entries:
        word    = entry.get("word", "")
        pron    = entry.get("pronunciation", "")
        etym    = entry.get("etymology", "")
        defn    = entry.get("definition", "")
        meta    = entry.get("metaphysical", "")
        context = entry.get("context", "")
        strongs = entry.get("strongsNumbers", [])
        refs    = entry.get("scriptureRefs", [])
        variants = entry.get("variants", [])

        print()
        # Word + pronunciation + etymology
        header = f"  {C.BOLD}{C.GOLD}{word}{C.RESET}"
        if pron:
            header += f"  {C.GREEN}{pron}{C.RESET}"
        if etym:
            header += f"  {C.DIM}({etym}){C.RESET}"
        print(header)

        # Literal definition
        if defn:
            print(f"\n  {C.DIM}Literal meaning:{C.RESET}")
            print(wrap(defn, indent=4))

        # Variants (a, b, c...)
        if variants:
            print(f"\n  {C.DIM}Biblical variants:{C.RESET}")
            for v in variants:
                label   = v.get("label", "")
                meaning = v.get("meaning", "")
                vrefs   = v.get("scriptureRefs", [])
                ref_str = "  ".join(r["ref"] for r in vrefs[:3])
                print(f"    {C.DIM}({label}){C.RESET} {meaning[:120]}")
                if ref_str:
                    print(f"        {C.DIM}↳ {ref_str}{C.RESET}")

        # Context / biblical reference
        if context and not variants:
            print(f"\n  {C.DIM}Biblical context:{C.RESET}")
            print(wrap(context[:400], indent=4))

        # Metaphysical interpretation — the star of the show
        if meta:
            print(f"\n  {C.PURPLE}{C.BOLD}Metaphysical Interpretation:{C.RESET}")
            paragraphs = [p.strip() for p in meta.split("\n\n") if p.strip()]
            if not paragraphs:
                paragraphs = [meta]
            for para in paragraphs[:3]:
                print(wrap(para, indent=4, width=68))
                if len(paragraphs) > 1:
                    print()

        # Strong's cross-references
        if strongs:
            print(f"\n  {C.DIM}Strong's numbers:{C.RESET} "
                  f"{C.DIM}{', '.join(strongs[:8])}{C.RESET}")

        # Scripture references
        if refs:
            ref_list = "  ".join(r["ref"] for r in refs[:5])
            print(f"  {C.DIM}Scripture refs:{C.RESET}  {C.DIM}{ref_list}{C.RESET}")

        if len(mib_entries) > 1:
            print(f"\n  {C.LINE}{'·' * 40}{C.RESET}")

def print_footer():
    print()
    divider(char="─")
    print()

# ── Main ──────────────────────────────────────────────────────────────────────

def lookup(word, show_all=False):
    print(f"\n{C.DIM}Loading concordance data...{C.RESET}", end="\r")
    js_data = load_js_data()
    mib     = load_mib()
    print(" " * 40, end="\r")  # clear loading line

    word_map = js_data["wordMap"]
    lexicon  = js_data["lexicon"]

    # Get concordance entries
    strongs_entries = get_strongs_entries(word, word_map, lexicon, show_all)

    # Get all Strong's numbers for this word
    all_strongs = [e["strongs"] for e in get_strongs_entries(word, word_map, lexicon, show_all=True)]

    # Find MIB entries — first by word name, then by Strong's cross-reference
    mib_entries = get_mib_entries(word, mib)
    if not mib_entries and all_strongs:
        mib_entries = get_mib_by_strongs(all_strongs, mib)

    # Print
    print_header(word)
    print_basic(word, strongs_entries)
    print_concordance(strongs_entries)
    print_metaphysical(mib_entries)
    print_footer()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"\n{C.RED}Usage: python3 lookup.py <word> [--all]{C.RESET}\n")
        sys.exit(1)

    query    = sys.argv[1]
    show_all = "--all" in sys.argv

    lookup(query, show_all)
