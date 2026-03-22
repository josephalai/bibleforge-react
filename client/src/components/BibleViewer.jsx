function BibleViewer({ verses, bookName, chapter, totalChapters, loading, error, onChapterChange }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        <h2>Unable to load</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="bible-viewer">
      <div className="chapter-header">
        <h1 className="chapter-title">{bookName} {chapter}</h1>
        <div className="chapter-nav">
          <button
            onClick={() => onChapterChange(-1)}
            disabled={chapter <= 1}
            aria-label="Previous chapter"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => onChapterChange(1)}
            disabled={chapter >= totalChapters}
            aria-label="Next chapter"
          >
            Next ▶
          </button>
        </div>
      </div>

      <div className="verses-container">
        {verses.map(v => (
          <span className="verse" key={v.id ?? `${v.chapter}-${v.verse}`}>
            <sup className="verse-number">{v.verse}</sup>
            <span className="verse-text">{v.text} </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default BibleViewer
