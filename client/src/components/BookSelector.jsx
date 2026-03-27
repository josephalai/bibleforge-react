import { useState, useEffect, useCallback } from 'react'

function BookSelector({ books, currentBook, currentChapter, onSelect, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null)

  const otBooks = books.filter(b => b.testament === 'OT')
  const ntBooks = books.filter(b => b.testament === 'NT')

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleBookClick = useCallback((book) => {
    if (book.chapters === 1) {
      onSelect(book.id, 1)
    } else {
      setSelectedBook(book)
    }
  }, [onSelect])

  const handleChapterClick = useCallback((chapter) => {
    if (selectedBook) {
      onSelect(selectedBook.id, chapter)
    }
  }, [selectedBook, onSelect])

  const renderBookGrid = (bookList) => (
    <div className="books-grid">
      {bookList.map(book => (
        <button
          key={book.id}
          className={`book-btn${book.id === currentBook ? ' active' : ''}`}
          onClick={() => handleBookClick(book)}
          title={book.name}
        >
          {book.shortName}
        </button>
      ))}
    </div>
  )

  return (
    <div className="book-selector-overlay" onClick={handleOverlayClick}>
      <div className="book-selector" role="dialog" aria-label="Select a book and chapter">
        <div className="book-selector-title">Select Book &amp; Chapter</div>

        <div className="testament-section">
          <div className="testament-heading">Old Testament</div>
          {renderBookGrid(otBooks)}
        </div>

        <div className="testament-section">
          <div className="testament-heading">New Testament</div>
          {renderBookGrid(ntBooks)}
        </div>

        {selectedBook && (
          <div className="chapter-select-section">
            <div className="chapter-select-label">{selectedBook.name} — Select Chapter</div>
            <div className="chapters-grid">
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  className={`chapter-btn${selectedBook.id === currentBook && ch === currentChapter ? ' active' : ''}`}
                  onClick={() => handleChapterClick(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BookSelector
