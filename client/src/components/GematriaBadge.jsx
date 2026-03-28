import { useState, useEffect, useRef } from 'react'

function GematriaBadge({ bookId, chapter, verse, value }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleBadgeClick(e) {
    e.stopPropagation()
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (!detail) {
      setLoading(true)
      fetch(`/api/gematria/verse/${bookId}/${chapter}/${verse}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setDetail(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }

  return (
    <span className="gematria-badge-wrapper">
      <button
        className="gematria-badge-pill"
        onClick={handleBadgeClick}
        title={`Gematria: ${value}`}
        aria-label={`Gematria value ${value}`}
      >
        {value}
      </button>
      {open && (
        <span className="gematria-badge-popup" ref={popupRef}>
          <span className="gematria-badge-popup-header">
            <span className="gematria-badge-popup-title">✡ Gematria: {value}</span>
            <button className="gematria-badge-popup-close" onClick={() => setOpen(false)}>×</button>
          </span>
          <span className="gematria-badge-popup-body">
            {loading && <span className="gematria-badge-loading">Loading breakdown…</span>}
            {detail && detail.breakdown && detail.breakdown.length > 0 && (
              <span className="gematria-badge-breakdown">
                {detail.breakdown.map((w, i) => (
                  <span key={i} className="gematria-badge-word">
                    <span className="gematria-badge-english">{w.english}</span>
                    <span className="gematria-badge-hebrew">{w.hebrew}</span>
                    <span className="gematria-badge-strongs">{w.strongs}</span>
                    <span className="gematria-badge-wval">= {w.value}</span>
                  </span>
                ))}
              </span>
            )}
            {detail && detail.matches && detail.matches.length > 0 && (
              <span className="gematria-badge-matches">
                <span className="gematria-badge-matches-title">Matching verses ({detail.matches.length})</span>
                {detail.matches.slice(0, 5).map((m, i) => (
                  <span key={i} className="gematria-badge-match-item">
                    {m.bookName} {m.chapter}:{m.verse} ({m.value})
                  </span>
                ))}
              </span>
            )}
            {detail && (!detail.breakdown || detail.breakdown.length === 0) && !loading && (
              <span className="gematria-badge-loading">No breakdown available</span>
            )}
          </span>
        </span>
      )}
    </span>
  )
}

export default GematriaBadge
