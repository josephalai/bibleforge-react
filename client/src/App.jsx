import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import SearchBar from './components/SearchBar'
import BibleViewer from './components/BibleViewer'
import BookSelector from './components/BookSelector'
import SearchResults from './components/SearchResults'
import ThemeToggle from './components/ThemeToggle'
import WordDefinition from './components/WordDefinition'
import AuthModal from './components/AuthModal'
import NotebookPanel from './components/NotebookPanel'
import QabalisticPanel from './components/QabalisticPanel'
import CompareTray from './components/CompareTray'
import CompareView from './components/CompareView'
import TeachingsList from './components/TeachingsList'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [books, setBooks] = useState([])
  const [currentBook, setCurrentBook] = useState(1)
  const [currentChapter, setCurrentChapter] = useState(1)
  const [verses, setVerses] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('bf-theme') || 'light')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBookSelector, setShowBookSelector] = useState(false)
  const [selectedWord, setSelectedWord] = useState(null)
  const [wordPosition, setWordPosition] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [stars, setStars] = useState([])
  const [notes, setNotes] = useState([])
  const [showNotebook, setShowNotebook] = useState(false)
  const initialLoad = useRef(true)
  const [qabalisticVerse, setQabalisticVerse] = useState(null) // {book, chapter, verse}
  const [compareVerses, setCompareVerses] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showTeachings, setShowTeachings] = useState(false)

  // Apply theme to body
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'theme-dark' : ''
    localStorage.setItem('bf-theme', theme)
  }, [theme])

  const fetchVerses = useCallback((bookId, chapter) => {
    setLoading(true)
    setError(null)
    fetch(`/api/verses/${bookId}/${chapter}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load verses')
        return res.json()
      })
      .then(data => {
        setVerses(data.verses || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('bf-token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchStarsAndNotes = useCallback((bookId, chapter) => {
    if (!user) {
      setStars([])
      setNotes([])
      return
    }
    const headers = getAuthHeaders()
    const opts = { headers, credentials: 'include' }

    fetch(`/api/stars?book=${bookId}&chapter=${chapter}`, opts)
      .then(res => {
        if (!res.ok) throw new Error('skip')
        return res.json()
      })
      .then(data => setStars(data))
      .catch(() => setStars([]))

    fetch(`/api/notes?book=${bookId}&chapter=${chapter}`, opts)
      .then(res => {
        if (!res.ok) throw new Error('skip')
        return res.json()
      })
      .then(data => setNotes(data))
      .catch(() => setNotes([]))
  }, [user, getAuthHeaders])

  // Fetch stars/notes when chapter or user changes
  useEffect(() => {
    fetchStarsAndNotes(currentBook, currentChapter)
  }, [currentBook, currentChapter, user, fetchStarsAndNotes])

  // Fetch books on mount, then load initial chapter
  useEffect(() => {
    fetch('/api/books')
      .then(res => res.json())
      .then(data => {
        setBooks(data)
        if (initialLoad.current) {
          initialLoad.current = false
          fetchVerses(1, 1)
        }
      })
      .catch(() => {
        setError('Failed to load books')
        setLoading(false)
      })
  }, [fetchVerses])

  const handleNavigate = useCallback((bookId, chapter) => {
    setCurrentBook(bookId)
    setCurrentChapter(chapter)
    setSearchResults(null)
    setShowBookSelector(false)
    fetchVerses(bookId, chapter)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [fetchVerses])

  const handleSearch = useCallback((query) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSearchQuery(query)
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(res => {
        if (!res.ok) throw new Error('Search failed')
        return res.json()
      })
      .then(data => {
        setSearchResults(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchResults(null)
    setSearchQuery('')
  }, [])

  const handleWordClick = useCallback((word, position) => {
    setSelectedWord(word)
    setWordPosition(position)
  }, [])

  const handleCloseDefinition = useCallback(() => {
    setSelectedWord(null)
    setWordPosition(null)
  }, [])

  const handleToggleStar = useCallback(async (verseNum, currentlyStarred) => {
    if (!user) return
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() }
    const body = JSON.stringify({ book: currentBook, chapter: currentChapter, verse: verseNum })
    try {
      const res = await fetch('/api/stars', {
        method: currentlyStarred ? 'DELETE' : 'POST',
        headers,
        credentials: 'include',
        body,
      })
      if (res.ok) {
        if (currentlyStarred) {
          setStars(prev => prev.filter(s => s.verse !== verseNum))
        } else {
          setStars(prev => [...prev, { verse: verseNum, book: currentBook, chapter: currentChapter }])
        }
      }
    } catch {
      // silently fail
    }
  }, [user, currentBook, currentChapter, getAuthHeaders])

  const handleEditNote = useCallback(async (verseNum, content) => {
    if (!user) return
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() }
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ book: currentBook, chapter: currentChapter, verse: verseNum, content }),
      })
      if (res.ok) {
        const saved = await res.json()
        setNotes(prev => {
          const existing = prev.findIndex(n => n.verse === verseNum)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = saved
            return updated
          }
          return [...prev, saved]
        })
      }
    } catch {
      // silently fail
    }
  }, [user, currentBook, currentChapter, getAuthHeaders])

  const currentBookData = books.find(b => b.id === currentBook)

  const handleAddCompare = useCallback((bookId, chapter, verse) => {
    setCompareVerses(prev => {
      const exists = prev.some(v => v.book === bookId && v.chapter === chapter && v.verse === verse)
      if (exists) return prev
      if (prev.length >= 10) return prev
      return [...prev, { book: bookId, chapter, verse }]
    })
  }, [])

  const handleRemoveCompare = useCallback((index) => {
    setCompareVerses(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleShowQabalistic = useCallback((bookId, chapter, verse) => {
    setQabalisticVerse({ book: bookId, chapter, verse })
  }, [])

  const handleChapterChange = useCallback((delta) => {
    const book = books.find(b => b.id === currentBook)
    if (!book) return
    const next = currentChapter + delta
    if (next >= 1 && next <= book.chapters) {
      handleNavigate(currentBook, next)
    }
  }, [books, currentBook, currentChapter, handleNavigate])

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">BibleForge</div>
        <SearchBar
          books={books}
          currentBook={currentBookData}
          currentChapter={currentChapter}
          onNavigate={handleNavigate}
          onSearch={handleSearch}
        />
        <div className="header-controls">
          <button
            className="book-selector-toggle"
            onClick={() => setShowBookSelector(true)}
          >
            {currentBookData ? currentBookData.shortName : '...'} {currentChapter}
          </button>
          {authLoading ? null : user ? (
            <div className="user-controls">
              <button
                className="notebook-toggle-btn"
                onClick={() => setShowNotebook(v => !v)}
                aria-label="Toggle notebook"
                title="Notebook"
              >
                📓
              </button>
              <button
                className="notebook-toggle-btn"
                onClick={() => setShowTeachings(v => !v)}
                aria-label="Toggle teachings"
                title="Teachings"
              >
                📚
              </button>
              <span className="user-display-name">{user.displayName || user.email}</span>
              <button className="sign-out-btn" onClick={logout}>Sign Out</button>
            </div>
          ) : (
            <button className="sign-in-btn" onClick={() => setShowAuthModal(true)}>Sign In</button>
          )}
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
        </div>
      </header>

      <main className="main-content">
        {searchResults ? (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            books={books}
            onNavigate={handleNavigate}
            onBack={handleClearSearch}
            loading={loading}
          />
        ) : (
          <BibleViewer
            verses={verses}
            bookName={currentBookData?.name || ''}
            chapter={currentChapter}
            totalChapters={currentBookData?.chapters || 1}
            loading={loading}
            error={error}
            onChapterChange={handleChapterChange}
            onWordClick={handleWordClick}
            stars={stars}
            notes={notes}
            onToggleStar={handleToggleStar}
            onEditNote={handleEditNote}
            onShowAuthModal={() => setShowAuthModal(true)}
            user={user}
            currentBook={currentBook}
            onAddCompare={handleAddCompare}
            onShowQabalistic={handleShowQabalistic}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </main>

      {showBookSelector && (
        <BookSelector
          books={books}
          currentBook={currentBook}
          currentChapter={currentChapter}
          onSelect={handleNavigate}
          onClose={() => setShowBookSelector(false)}
        />
      )}

      {selectedWord && (
        <WordDefinition
          word={selectedWord}
          position={wordPosition}
          onClose={handleCloseDefinition}
          testament={currentBookData?.testament}
        />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showNotebook && user && (
        <NotebookPanel
          books={books}
          currentBook={currentBook}
          currentChapter={currentChapter}
          user={user}
          onClose={() => setShowNotebook(false)}
          onNavigate={handleNavigate}
        />
      )}

      {qabalisticVerse && (
        <QabalisticPanel
          book={qabalisticVerse.book}
          chapter={qabalisticVerse.chapter}
          verse={qabalisticVerse.verse}
          bookName={books.find(b => b.id === qabalisticVerse.book)?.name || ''}
          onClose={() => setQabalisticVerse(null)}
        />
      )}

      <CompareTray
        compareVerses={compareVerses}
        books={books}
        onRemove={handleRemoveCompare}
        onClear={() => setCompareVerses([])}
        onCompare={() => setShowCompare(true)}
      />

      {showCompare && compareVerses.length >= 2 && (
        <CompareView
          compareVerses={compareVerses}
          books={books}
          onClose={() => setShowCompare(false)}
        />
      )}

      {showTeachings && user && (
        <TeachingsList
          user={user}
          books={books}
          onClose={() => setShowTeachings(false)}
          onNavigate={handleNavigate}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  )
}

export default App
