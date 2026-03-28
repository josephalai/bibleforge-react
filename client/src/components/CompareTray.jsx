function CompareTray({ compareVerses, books, onRemove, onClear, onCompare }) {
  if (!compareVerses || compareVerses.length === 0) return null

  function getRef(v) {
    const book = books.find(b => b.id === v.book)
    return `${book ? book.shortName : v.book} ${v.chapter}:${v.verse}`
  }

  return (
    <div className="compare-tray">
      <div className="compare-tray-label">Compare ({compareVerses.length})</div>
      <div className="compare-tray-items">
        {compareVerses.map((v, i) => (
          <span key={i} className="compare-tray-chip">
            {getRef(v)}
            <button
              className="compare-tray-chip-remove"
              onClick={() => onRemove(i)}
              aria-label="Remove from comparison"
            >×</button>
          </span>
        ))}
      </div>
      <div className="compare-tray-actions">
        <button
          className="compare-tray-btn compare-tray-go"
          onClick={onCompare}
          disabled={compareVerses.length < 2}
        >
          Compare
        </button>
        <button className="compare-tray-btn compare-tray-clear" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  )
}

export default CompareTray
