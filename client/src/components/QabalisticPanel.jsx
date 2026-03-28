import { useState, useEffect } from 'react'

function QabalisticPanel({ book, chapter, verse, bookName, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/qabalistic-meaning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book, chapter, startVerse: verse, endVerse: verse }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
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
  }, [book, chapter, verse])

  return (
    <div className="qabalistic-overlay" onClick={onClose}>
      <div className="qabalistic-modal" onClick={e => e.stopPropagation()}>
        <div className="qabalistic-header">
          <h2 className="qabalistic-title">✡ Qabalistic Meaning</h2>
          <span className="qabalistic-ref">{bookName} {chapter}:{verse}</span>
          <button className="qabalistic-close" onClick={onClose}>×</button>
        </div>

        <div className="qabalistic-body">
          {loading && <div className="qabalistic-loading">Loading word-by-word breakdown…</div>}
          {error && <div className="qabalistic-error">{error}</div>}

          {data && data.verses && data.verses.map((v, vi) => (
            <div key={vi} className="qabalistic-verse">
              <div className="qabalistic-verse-text">{v.text}</div>
              <div className="qabalistic-words">
                {v.words.filter(w => w.strongs).map((w, wi) => (
                  <div key={wi} className="qabalistic-word-card">
                    <div className="qabalistic-word-header">
                      <span className="qabalistic-word-english">{w.english}</span>
                      {w.hebrew && <span className="qabalistic-word-hebrew">{w.hebrew}</span>}
                      {w.strongs && <span className="qabalistic-word-strongs">{w.strongs}</span>}
                      {w.gematria && <span className="qabalistic-word-gval">= {w.gematria.value}</span>}
                    </div>

                    {w.gematria && w.gematria.letters && (
                      <div className="qabalistic-letters">
                        {w.gematria.letters.map((l, li) => (
                          <div key={li} className="qabalistic-letter-row">
                            <span className="qabalistic-letter-char">{l.char}</span>
                            <span className="qabalistic-letter-symbol">{l.symbol}</span>
                            <span className="qabalistic-letter-value">{l.value}</span>
                            {l.suares && (
                              <span className="qabalistic-letter-suares">{l.suares}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {w.mib && (
                      <div className="qabalistic-mib">
                        <span className="qabalistic-mib-label">MIB:</span>
                        <span className="qabalistic-mib-text">
                          {w.mib.definition || w.mib.metaphysical || 'N/A'}
                        </span>
                      </div>
                    )}

                    {w.suaresMeaning && (
                      <div className="qabalistic-suares-meaning">
                        <span className="qabalistic-suares-label">Suarès Letter Flow:</span>
                        <span className="qabalistic-suares-text">{w.suaresMeaning}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QabalisticPanel
