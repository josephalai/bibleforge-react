function BibleViewer({ verses, bookName, chapter, totalChapters, loading, error, onChapterChange, onWordClick }) {
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

  function handleWordClick(e, word) {
    // Strip punctuation from edges for lookup
    const cleaned = word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
    if (cleaned && onWordClick) {
      const rect = e.currentTarget.getBoundingClientRect()
      onWordClick(cleaned, {
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      })
    }
  }

  function renderVerseText(text) {
    const words = text.split(/(\s+)/)
    return words.map((token, i) => {
      if (/^\s+$/.test(token)) return token
      return (
        <span
          key={i}
          className="word-clickable"
          onClick={(e) => handleWordClick(e, token)}
        >
          {token}
        </span>
      )
    })
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
            <span className="verse-text">{renderVerseText(v.text)} </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default BibleViewer
