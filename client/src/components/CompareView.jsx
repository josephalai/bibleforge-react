import { useState, useEffect } from 'react'

function CompareView({ compareVerses, books, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verses: compareVerses }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Comparison failed')
        return res.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [compareVerses])

  function getRef(v) {
    return `${v.bookName} ${v.chapter}:${v.verse}`
  }

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={e => e.stopPropagation()}>
        <div className="compare-header">
          <h2 className="compare-title">Verse Comparison</h2>
          <button className="compare-close" onClick={onClose}>×</button>
        </div>

        {loading && <div className="compare-loading">Loading comparison data…</div>}
        {error && <div className="compare-error">{error}</div>}

        {data && (
          <div className="compare-body">
            {/* Shared connections summary */}
            {(data.sharedStrongs.length > 0 || data.sharedRoots.length > 0) && (
              <div className="compare-shared">
                <h3 className="compare-shared-title">Shared Connections</h3>
                {data.sharedStrongs.length > 0 && (
                  <div className="compare-shared-section">
                    <span className="compare-shared-label">Shared Strong's:</span>
                    {data.sharedStrongs.map((s, i) => (
                      <span key={i} className="compare-shared-chip">
                        {s.strongsNumber} {s.word && `(${s.word})`}
                        {s.meaning && ` — ${s.meaning}`}
                      </span>
                    ))}
                  </div>
                )}
                {data.sharedRoots.length > 0 && (
                  <div className="compare-shared-section">
                    <span className="compare-shared-label">Shared Roots:</span>
                    {data.sharedRoots.map((r, i) => (
                      <span key={i} className="compare-shared-chip">
                        {r.strongsNumber} {r.word && `(${r.word})`}
                        {r.meaning && ` — ${r.meaning}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Side-by-side panels */}
            <div className="compare-panels">
              {data.verses.map((v, vi) => (
                <div key={vi} className="compare-panel">
                  <div className="compare-panel-header">
                    <span className="compare-panel-ref">{getRef(v)}</span>
                    <span className="compare-panel-gematria">Σ {v.totalGematria}</span>
                  </div>
                  <div className="compare-panel-text">{v.text}</div>
                  <div className="compare-panel-words">
                    {v.words.filter(w => w.strongs).map((w, wi) => {
                      const isShared = data.sharedStrongs.some(s => s.strongsNumber === w.strongs)
                      return (
                        <span
                          key={wi}
                          className={`compare-word-chip ${isShared ? 'compare-word-shared' : ''}`}
                          title={`${w.strongs} ${w.hebrew || ''} ${w.mib || ''}`}
                        >
                          {w.english}
                          {w.gematria ? ` (${w.gematria})` : ''}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompareView
