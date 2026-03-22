import { useState, useCallback } from 'react'

// Common book name aliases for matching user input
const BOOK_ALIASES = {
  'gen': 'Genesis', 'exo': 'Exodus', 'exod': 'Exodus', 'lev': 'Leviticus',
  'num': 'Numbers', 'deut': 'Deuteronomy', 'josh': 'Joshua', 'judg': 'Judges',
  'ruth': 'Ruth', 'sam': '1 Samuel', 'kgs': '1 Kings', 'kings': '1 Kings',
  'chr': '1 Chronicles', 'chron': '1 Chronicles', 'ezra': 'Ezra',
  'neh': 'Nehemiah', 'est': 'Esther', 'esth': 'Esther', 'job': 'Job',
  'ps': 'Psalms', 'psa': 'Psalms', 'psalm': 'Psalms', 'prov': 'Proverbs',
  'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'song': 'Song of Solomon',
  'isa': 'Isaiah', 'jer': 'Jeremiah', 'lam': 'Lamentations',
  'ezek': 'Ezekiel', 'dan': 'Daniel', 'hos': 'Hosea', 'joel': 'Joel',
  'amos': 'Amos', 'obad': 'Obadiah', 'jonah': 'Jonah', 'mic': 'Micah',
  'nah': 'Nahum', 'hab': 'Habakkuk', 'zeph': 'Zephaniah', 'hag': 'Haggai',
  'zech': 'Zechariah', 'mal': 'Malachi', 'matt': 'Matthew', 'mat': 'Matthew',
  'mark': 'Mark', 'mk': 'Mark', 'luke': 'Luke', 'lk': 'Luke',
  'john': 'John', 'jn': 'John', 'acts': 'Acts', 'rom': 'Romans',
  'cor': '1 Corinthians', 'gal': 'Galatians', 'eph': 'Ephesians',
  'phil': 'Philippians', 'col': 'Colossians', 'thess': '1 Thessalonians',
  'tim': '1 Timothy', 'tit': 'Titus', 'philem': 'Philemon',
  'heb': 'Hebrews', 'jas': 'James', 'james': 'James', 'pet': '1 Peter',
  'peter': '1 Peter', 'jude': 'Jude', 'rev': 'Revelation',
}

function parseReference(input, books) {
  if (!books.length) return null

  const trimmed = input.trim()

  // Match patterns like "Genesis 1", "1 John 3", "Gen 1:16", "John 3:16"
  const refPattern = /^(\d?\s*[a-zA-Z]+(?:\s+of\s+[a-zA-Z]+)?)\s+(\d+)(?::(\d+))?$/i
  const match = trimmed.match(refPattern)

  if (!match) return null

  const bookInput = match[1].trim().toLowerCase()
  const chapter = parseInt(match[2], 10)

  // Try exact match on name or shortName first
  let book = books.find(
    b => b.name.toLowerCase() === bookInput || b.shortName.toLowerCase() === bookInput
  )

  // Try prefix match
  if (!book) {
    book = books.find(
      b => b.name.toLowerCase().startsWith(bookInput) || b.shortName.toLowerCase().startsWith(bookInput)
    )
  }

  // Try alias lookup
  if (!book) {
    // Handle numbered books like "1 john" -> look for alias "john" and match number
    const numMatch = bookInput.match(/^(\d)\s*(.+)$/)
    let aliasKey = bookInput.replace(/\s+/g, '')

    if (numMatch) {
      const num = numMatch[1]
      const name = numMatch[2]
      const aliasName = BOOK_ALIASES[name]
      if (aliasName) {
        book = books.find(b => b.name.toLowerCase() === `${num} ${aliasName.toLowerCase()}`)
      }
    }

    if (!book) {
      const aliasName = BOOK_ALIASES[aliasKey]
      if (aliasName) {
        book = books.find(b => b.name.toLowerCase() === aliasName.toLowerCase())
      }
    }
  }

  if (book && chapter >= 1 && chapter <= book.chapters) {
    return { bookId: book.id, chapter }
  }

  return null
}

function SearchBar({ books, currentBook, currentChapter, onNavigate, onSearch }) {
  const [input, setInput] = useState('')

  const placeholder = currentBook
    ? `${currentBook.name} ${currentChapter}`
    : 'Search or go to verse...'

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    if (!input.trim()) return

    const ref = parseReference(input, books)
    if (ref) {
      onNavigate(ref.bookId, ref.chapter)
      setInput('')
    } else {
      onSearch(input.trim())
      setInput('')
    }
  }, [input, books, onNavigate, onSearch])

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={placeholder}
        aria-label="Search or navigate to a Bible reference"
      />
      <button type="submit">Go</button>
    </form>
  )
}

export default SearchBar
