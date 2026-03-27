import { useCallback } from 'react'

function SearchResults({ results, query, books, onNavigate, onBack, loading }) {
  const getBookName = useCallback((bookId) => {
    const book = books.find(b => b.id === bookId)
    return book ? book.name : `Book ${bookId}`
  }, [books])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Searching...</span>
      </div>
    )
  }

  const items = results?.results || []

  return (
    <div className="search-results">
      <button className="search-back-btn" onClick={onBack}>
        ← Back to reading
      </button>

      <div className="search-results-header">
        <h2>Results for &ldquo;{query}&rdquo;</h2>
        <div className="search-results-count">
          {items.length} verse{items.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {items.length === 0 ? (
        <div className="search-no-results">
          No verses matched your search. Try different keywords.
        </div>
      ) : (
        items.map((item, idx) => (
          <div
            key={item.id ?? idx}
            className="search-result-item"
            onClick={() => onNavigate(item.book, item.chapter)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onNavigate(item.book, item.chapter)
            }}
          >
            <div className="search-result-ref">
              {getBookName(item.book)} {item.chapter}:{item.verse}
            </div>
            <div className="search-result-text">{item.text}</div>
          </div>
        ))
      )}
    </div>
  )
}

export default SearchResults
