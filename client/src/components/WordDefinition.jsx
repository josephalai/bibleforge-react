import { useState, useEffect, useRef } from 'react'

const TOGGLE_KEY = 'bf_popup_toggles'

function loadToggles() {
  try {
    const saved = localStorage.getItem(TOGGLE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { concordance: true, metaphysical: true, gematria: true }
}

function saveToggles(t) {
  try { localStorage.setItem(TOGGLE_KEY, JSON.stringify(t)) } catch {}
}

// Expandable letter card for gematria breakdown
function LetterCard({ letter }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="gematria-letter-card">
      <button className="gematria-letter-header" onClick={() => setOpen(o => !o)}>
        <span className="gematria-char">{letter.character}</span>
        <span className="gematria-symbol">{letter.symbol}</span>
        <span className="gematria-value">{letter.value}</span>
        <span className="gematria-level">{letter.level}</span>
        <span className="gematria-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="gematria-letter-body">
          {letter.meaning && (
            <p className="gematria-meaning">{letter.meaning}</p>
          )}
          {letter.imagery && (
            <p className="gematria-imagery"><em>{letter.imagery}</em></p>
          )}
          {letter.formula && (
            <div className="gematria-formula">
              <span className="gematria-formula-label">Spelled: </span>
              {letter.formula.hebrew_array.join(' · ')}
              <span className="gematria-formula-nums">
                ({letter.formula.numerical_breakdown.join(' + ')} = {letter.formula.numerical_breakdown.reduce((a,b) => a+b, 0)})
              </span>
            </div>
          )}
          {letter.connections && letter.connections.length > 0 && (
            <div className="gematria-connections">
              {letter.connections.map((c, i) => (
                <div key={i} className="gematria-connection">
                  <span className="gematria-connection-target">{c.target}</span>
                  <span className="gematria-connection-rel">{c.relationship}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Verse list for concordance/metaphysical search results
const VERSE_DISPLAY_CAP = 20

function VerseResultsList({ verses, onNavigate }) {
  const [showAll, setShowAll] = useState(false)
  if (!verses || !verses.length) return <p className="word-definition-none">No verses found.</p>
  const capped = !showAll && verses.length > VERSE_DISPLAY_CAP
  const displayed = capped ? verses.slice(0, VERSE_DISPLAY_CAP) : verses
  return (
    <div className="concordance-verse-results">
      {displayed.map((v, i) => (
        <button
          key={i}
          className="concordance-verse-item"
          onClick={() => onNavigate && onNavigate(v.book, v.chapter, v.verse)}
        >
          <span className="concordance-verse-ref">{v.bookName} {v.chapter}:{v.verse}</span>
          <span className="concordance-verse-text">{v.text}</span>
        </button>
      ))}
      {capped && (
        <button className="concordance-action-btn" onClick={() => setShowAll(true)}>
          Show all {verses.length} results
        </button>
      )}
      {showAll && verses.length > VERSE_DISPLAY_CAP && (
        <button className="concordance-action-btn" onClick={() => setShowAll(false)}>
          Show less ▲
        </button>
      )}
    </div>
  )
}

function WordDefinition({ word, position, onClose, testament, onNavigate }) {
  const [data, setData]         = useState(null)
  const [mib, setMib]           = useState(null)
  const [gematria, setGematria] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [toggles, setToggles]   = useState(loadToggles)
  const [expanded, setExpanded] = useState(false)
  const popupRef                = useRef(null)

  // Concordance verse search state
  const [concordanceVerses, setConcordanceVerses] = useState(null)
  const [concordanceLoading, setConcordanceLoading] = useState(false)

  // Metaphysical verse search state
  const [metaVerses, setMetaVerses] = useState(null)
  const [metaLoading, setMetaLoading] = useState(false)

  // Word DNA / root state
  const [rootData, setRootData] = useState(null)
  const [rootLoading, setRootLoading] = useState(false)

  // Greek→Hebrew origin state
  const [hebrewOrigin, setHebrewOrigin] = useState(null)

  // Reset to compact whenever a new word is selected
  useEffect(() => {
    setExpanded(false)
    setConcordanceVerses(null)
    setMetaVerses(null)
    setRootData(null)
    setHebrewOrigin(null)
  }, [word])

  useEffect(() => {
    if (!word) return
    setLoading(true)
    setData(null)
    setMib(null)
    setGematria(null)

    const params = testament ? `?testament=${testament}` : ''

    fetch(`/api/define/${encodeURIComponent(word)}${params}`)
      .then(res => res.json())
      .then(defResult => {
        setData(defResult)

        const hebrewWord = defResult?.concordance?.originalWord
        const isHebrew   = defResult?.concordance?.language === 'Hebrew'
        const isGreek    = defResult?.concordance?.language === 'Greek'
        const strongsNum = defResult?.concordance?.strongsNumber

        // If Greek word, check for Hebrew origin
        if (isGreek && strongsNum) {
          fetch(`/api/hebrew-origin/${encodeURIComponent(strongsNum)}`)
            .then(r => r.ok ? r.json() : null)
            .then(ho => { if (ho?.hebrewOrigin) setHebrewOrigin(ho.hebrewOrigin) })
            .catch(() => {})
        }

        return Promise.all([
          fetch(`/api/metaphysical/${encodeURIComponent(word)}`)
            .then(res => res.ok ? res.json() : null).catch(() => null),
          (isHebrew && hebrewWord)
            ? fetch(`/api/gematria?word=${encodeURIComponent(hebrewWord)}`)
                .then(res => res.ok ? res.json() : null).catch(() => null)
            : Promise.resolve(null),
        ])
      })
      .then(([mibResult, gemResult]) => {
        if (mibResult?.word) setMib(mibResult)
        if (gemResult?.letters?.length) setGematria(gemResult)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [word, testament])

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose()
    }
    function handleEscape(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  function toggle(key) {
    setToggles(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveToggles(next)
      return next
    })
  }

  // Fetch concordance verses for the current Strong's number
  function handleFindConcordanceVerses() {
    if (concordanceVerses) { setConcordanceVerses(null); return }
    const sn = data?.concordance?.strongsNumber
    if (!sn || concordanceLoading) return
    setConcordanceLoading(true)
    fetch(`/api/concordance/strongs/${encodeURIComponent(sn)}`)
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        setConcordanceVerses(result?.verses || [])
        setConcordanceLoading(false)
      })
      .catch(() => setConcordanceLoading(false))
  }

  // Fetch metaphysical verses
  function handleFindMetaVerses() {
    if (metaVerses) { setMetaVerses(null); return }
    if (!word || metaLoading) return
    setMetaLoading(true)
    fetch(`/api/concordance/metaphysical/${encodeURIComponent(word)}`)
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        setMetaVerses(result?.verses || [])
        setMetaLoading(false)
      })
      .catch(() => setMetaLoading(false))
  }

  // Fetch root/shoresh data
  function handleFindRoots() {
    if (rootData) { setRootData(null); return }
    const sn = data?.concordance?.strongsNumber
    if (!sn || rootLoading) return
    setRootLoading(true)
    fetch(`/api/roots/${encodeURIComponent(sn)}`)
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        setRootData(result)
        setRootLoading(false)
      })
      .catch(() => setRootLoading(false))
  }

  if (!word) return null

  const concordance = data?.concordance
  const definition  = data?.definition
  const anyVisible  = toggles.concordance || toggles.metaphysical || toggles.gematria

  // ── Compact speech-bubble popup ──────────────────────────────────────────
  if (!expanded) {
    const POPUP_WIDTH       = 360
    const ARROW_SIZE        = 10
    const COMPACT_MAX_HEIGHT = 260
    const VIEWPORT_MARGIN   = 8   // min gap from viewport edges
    const ARROW_EDGE_MARGIN = 20  // min distance of arrow tip from popup edge
    const style = {}
    let arrowLeft = '50%'
    let showBelow = false

    if (position) {
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Center popup horizontally on the word, clamped to viewport
      let left = position.x - POPUP_WIDTH / 2
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - POPUP_WIDTH - VIEWPORT_MARGIN))

      // Arrow offset within the popup so it points at the word's center
      const arrowCenter = position.x - left
      arrowLeft = `${Math.max(ARROW_EDGE_MARGIN, Math.min(arrowCenter, POPUP_WIDTH - ARROW_EDGE_MARGIN))}px`

      // position.y is rect.top of the word element; check if popup fits above
      if (position.y - COMPACT_MAX_HEIGHT - ARROW_SIZE < VIEWPORT_MARGIN) {
        // Not enough room above — show below the word
        showBelow = true
        style.position = 'fixed'
        style.left     = left
        style.top      = (position.bottom ?? position.y) + ARROW_SIZE
      } else {
        // Show above the word; bottom CSS offset places popup's bottom edge just above word top
        style.position = 'fixed'
        style.left     = left
        style.bottom   = vh - position.y + ARROW_SIZE
      }

      style['--arrow-left'] = arrowLeft
    }

    return (
      <div
        className={`word-definition-popup word-definition-compact${showBelow ? ' arrow-above' : ' arrow-below'}`}
        ref={popupRef}
        style={style}
      >
        {/* ── Header ── */}
        <div className="word-definition-header">
          <span className="word-definition-word">{word}</span>
          <button className="word-definition-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Summary body ── */}
        <div className="word-definition-body compact-body">
          {loading ? (
            <span className="word-definition-loading">Looking up…</span>
          ) : concordance ? (
            <>
              <div className="concordance-original">
                <span className="concordance-original-word">{concordance.originalWord}</span>
                <span className="concordance-separator">|</span>
                <span className="concordance-pronunciation">{concordance.pronunciation}</span>
              </div>
              <p className="concordance-short-def">{concordance.shortDefinition}</p>
            </>
          ) : definition ? (
            <p className="word-definition-text">{definition}</p>
          ) : (
            <p className="word-definition-none">No definition available.</p>
          )}
        </div>

        {/* ── HR + More button ── */}
        <hr className="compact-hr" />
        <div className="compact-footer">
          <button className="more-button" onClick={() => setExpanded(true)}>+ More</button>
        </div>
      </div>
    )
  }

  // ── Expanded full-screen modal ───────────────────────────────────────────
  return (
    <div className="word-definition-overlay">
      <div className="word-definition-modal" ref={popupRef}>

        {/* ── Header ── */}
        <div className="word-definition-header">
          <span className="word-definition-word">{word}</span>
          <button className="word-definition-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Toggle bar ── */}
        <div className="popup-toggles">
          <label className="popup-toggle">
            <input type="checkbox" checked={toggles.concordance} onChange={() => toggle('concordance')} />
            <span>Concordance</span>
          </label>
          <label className="popup-toggle">
            <input type="checkbox" checked={toggles.metaphysical} onChange={() => toggle('metaphysical')} />
            <span>Metaphysical</span>
          </label>
          <label className="popup-toggle">
            <input type="checkbox" checked={toggles.gematria} onChange={() => toggle('gematria')} />
            <span>Gematria</span>
          </label>
        </div>

        {/* ── Body ── */}
        <div className="word-definition-body">
          {loading ? (
            <span className="word-definition-loading">Looking up…</span>
          ) : (
            <>
              {/* ── Concordance ── */}
              {toggles.concordance && (
                concordance ? (
                  <div className="concordance-content">
                    <div className="concordance-strongs">
                      Strong&apos;s #{concordance.strongsNumber}
                      <span className="concordance-lang">{concordance.language}</span>
                    </div>
                    <div className="concordance-original">
                      <span className="concordance-original-word">{concordance.originalWord}</span>
                      <span className="concordance-separator">|</span>
                      <span className="concordance-pronunciation">{concordance.pronunciation}</span>
                    </div>
                    <p className="concordance-short-def">{concordance.shortDefinition}</p>
                    {concordance.detailedDefinition && concordance.detailedDefinition.length > 0 && (
                      <div className="concordance-section">
                        <div className="concordance-section-title">Detailed Definition</div>
                        <ul className="concordance-detailed-list">
                          {concordance.detailedDefinition.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {concordance.rootForm && (
                      <div className="concordance-section">
                        <div className="concordance-section-title">Root Form</div>
                        <div className="concordance-original">
                          <span className="concordance-original-word">{concordance.rootForm.originalWord}</span>
                          <span className="concordance-separator">|</span>
                          <span className="concordance-pronunciation">{concordance.rootForm.pronunciation}</span>
                        </div>
                      </div>
                    )}

                    {/* ── Hebrew Origin (Greek→Hebrew, Feature 8B) ── */}
                    {hebrewOrigin && (
                      <div className="concordance-section">
                        <div className="concordance-section-title">Hebrew Origin</div>
                        <div className="hebrew-origin-row">
                          <span className="hebrew-origin-word">{hebrewOrigin.word}</span>
                          {hebrewOrigin.pronunciation && (
                            <span className="hebrew-origin-pron">({hebrewOrigin.pronunciation})</span>
                          )}
                          <span className="hebrew-origin-strongs">— {hebrewOrigin.strongsNumber}</span>
                        </div>
                        <p className="hebrew-origin-meaning">{hebrewOrigin.meaning}</p>
                        {hebrewOrigin.gematria && (
                          <div className="hebrew-origin-gematria">
                            <span className="hebrew-origin-gematria-label">Gematria: </span>
                            {hebrewOrigin.gematria.letters.map((l, i) => (
                              <span key={i} className="hebrew-origin-letter" title={l.meaning}>
                                {l.character}({l.value})
                              </span>
                            ))}
                            <span className="hebrew-origin-total"> = {hebrewOrigin.gematria.totalValue}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Word DNA / Shoresh (Feature 8A) ── */}
                    {concordance.language === 'Hebrew' && (
                      <div className="concordance-section">
                        <button
                          className="concordance-action-btn"
                          onClick={handleFindRoots}
                          disabled={rootLoading}
                        >
                          {rootLoading ? 'Loading…' : rootData ? 'Word DNA ▲' : '🔬 Word DNA / Root'}
                        </button>
                        {rootData && (
                          <div className="word-dna-results">
                            {rootData.root && (
                              <div className="word-dna-root">
                                <span className="word-dna-root-label">Shoresh (Root): </span>
                                <span className="word-dna-root-word">{rootData.root.word}</span>
                                <span className="word-dna-root-num"> {rootData.root.number}</span>
                                <p className="word-dna-root-meaning">{rootData.root.meaning}</p>
                              </div>
                            )}
                            {rootData.wordDNA && rootData.wordDNA.letters && (
                              <div className="word-dna-letters">
                                <div className="word-dna-letters-label">Letter Breakdown (Suarès):</div>
                                {rootData.wordDNA.letters.map((l, i) => (
                                  <div key={i} className="word-dna-letter">
                                    <span className="word-dna-char">{l.character}</span>
                                    <span className="word-dna-sym">{l.symbol} ({l.value})</span>
                                    <span className="word-dna-lmean">{l.meaning}</span>
                                  </div>
                                ))}
                                <div className="word-dna-total">Total = {rootData.wordDNA.totalValue}</div>
                              </div>
                            )}
                            {rootData.derivedWords && rootData.derivedWords.length > 0 && (
                              <div className="word-dna-derived">
                                <div className="word-dna-derived-label">Related Words from Same Root:</div>
                                <ul className="word-dna-derived-list">
                                  {rootData.derivedWords.slice(0, 15).map((dw, i) => (
                                    <li key={i}>
                                      <span className="word-dna-dw-word">{dw.word}</span>
                                      <span className="word-dna-dw-num"> {dw.strongsNumber}</span>
                                      <span className="word-dna-dw-def"> — {dw.shortDefinition}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Find all verses button (Feature 6) ── */}
                    <div className="concordance-section">
                      <button
                        className="concordance-action-btn"
                        onClick={handleFindConcordanceVerses}
                        disabled={concordanceLoading}
                      >
                        {concordanceLoading ? 'Searching…' : concordanceVerses ? 'Verses ▲' : '📖 Find all verses with this word'}
                      </button>
                      {concordanceVerses && (
                        <VerseResultsList verses={concordanceVerses} onNavigate={onNavigate} />
                      )}
                    </div>
                  </div>
                ) : definition ? (
                  <p className="word-definition-text">{definition}</p>
                ) : (
                  <p className="word-definition-none">No concordance data available.</p>
                )
              )}

              {/* ── Metaphysical ── */}
              {toggles.concordance && toggles.metaphysical && (concordance || definition) && mib && (
                <div className="popup-section-divider" />
              )}
              {toggles.metaphysical && (
                mib ? (
                  <div className="mib-content">
                    <div className="mib-section-label">Metaphysical Interpretation</div>
                    <div className="mib-header">
                      <span className="mib-word">{mib.word}</span>
                      {mib.pronunciation && <span className="mib-pronunciation">{mib.pronunciation}</span>}
                      {mib.etymology    && <span className="mib-etymology">{mib.etymology}</span>}
                    </div>
                    {mib.definition && <p className="mib-definition">{mib.definition}</p>}
                    {(mib.metaphysical || mib.context) && (
                      <p className="mib-metaphysical">{mib.metaphysical || mib.context}</p>
                    )}
                    {mib.scriptureRefs && mib.scriptureRefs.length > 0 && (
                      <div className="mib-refs">
                        {mib.scriptureRefs.slice(0, 4).map(r => r.ref).join('  ·  ')}
                      </div>
                    )}
                    {/* ── Find verses with same meaning (Feature 6) ── */}
                    <div className="concordance-section">
                      <button
                        className="concordance-action-btn"
                        onClick={handleFindMetaVerses}
                        disabled={metaLoading}
                      >
                        {metaLoading ? 'Searching…' : metaVerses ? 'Verses ▲' : '📖 Find verses with same meaning'}
                      </button>
                      {metaVerses && (
                        <VerseResultsList verses={metaVerses} onNavigate={onNavigate} />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="word-definition-none mib-none">No metaphysical entry found.</p>
                )
              )}

              {/* ── Gematria / Qabala ── */}
              {(toggles.metaphysical || toggles.concordance) && toggles.gematria && gematria && (
                <div className="popup-section-divider" />
              )}
              {toggles.gematria && (
                gematria ? (
                  <div className="gematria-content">
                    <div className="gematria-section-label">Qabala · Gematria</div>
                    <div className="gematria-word-row">
                      <span className="gematria-full-word">{gematria.consonants}</span>
                      <span className="gematria-total-value">= {gematria.totalValue}</span>
                    </div>
                    <div className="gematria-letters">
                      {gematria.letters.map((letter, i) => (
                        <LetterCard key={i} letter={letter} />
                      ))}
                    </div>
                  </div>
                ) : concordance?.language === 'Hebrew' ? (
                  <p className="word-definition-none mib-none">No gematria data for this word.</p>
                ) : null
              )}

              {/* All hidden */}
              {!anyVisible && (
                <p className="word-definition-none">All sections hidden — use the toggles above.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default WordDefinition
