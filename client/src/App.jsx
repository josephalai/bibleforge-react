import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import SearchBar from './components/SearchBar'
import BibleViewer from './components/BibleViewer'
import BookSelector from './components/BookSelector'
import SearchResults from './components/SearchResults'
import ThemeToggle from './components/ThemeToggle'
import WordDefinition from './components/WordDefinition'
import AuthModal from './components/AuthModal'
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
  const initialLoad = useRef(true)

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

  const currentBookData = books.find(b => b.id === currentBook)

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
    </div>
  )
}

export default App
