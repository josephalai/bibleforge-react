import { useState, useEffect, useRef } from 'react'

const TOGGLE_KEY = 'bf_popup_toggles'

function loadToggles() {
  try {
    const saved = localStorage.getItem(TOGGLE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { concordance: true, metaphysical: true }
}

function saveToggles(t) {
  try { localStorage.setItem(TOGGLE_KEY, JSON.stringify(t)) } catch {}
}

function WordDefinition({ word, position, onClose, testament }) {
  const [data, setData]       = useState(null)
  const [mib, setMib]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggles, setToggles] = useState(loadToggles)
  const popupRef              = useRef(null)

  useEffect(() => {
    if (!word) return
    setLoading(true)
    setData(null)
    setMib(null)

    const params = testament ? `?testament=${testament}` : ''

    fetch(`/api/define/${encodeURIComponent(word)}${params}`)
      .then(res => res.json())
      .then(defResult => {
        setData(defResult)
        return fetch(`/api/metaphysical/${encodeURIComponent(word)}`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      })
      .then(mibResult => {
        if (mibResult?.word) setMib(mibResult)
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

  // Position the popup near the clicked word
  const style = {}
  if (position) {
    style.position = 'fixed'
    style.left = Math.min(position.x, window.innerWidth - 340)
    style.top = position.y + 24
    if (position.y + 300 > window.innerHeight) {
      style.top = Math.max(10, position.y - 320)
    }
  }

  if (!word) return null

  const concordance = data?.concordance
  const definition  = data?.definition

  return (
    <div className="word-definition-popup" ref={popupRef} style={style}>

      {/* ── Header ── */}
      <div className="word-definition-header">
        <span className="word-definition-word">{word}</span>
        <button className="word-definition-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* ── Toggle bar ── */}
      <div className="popup-toggles">
        <label className="popup-toggle">
          <input
            type="checkbox"
            checked={toggles.concordance}
            onChange={() => toggle('concordance')}
          />
          <span>Concordance</span>
        </label>
        <label className="popup-toggle">
          <input
            type="checkbox"
            checked={toggles.metaphysical}
            onChange={() => toggle('metaphysical')}
          />
          <span>Metaphysical</span>
        </label>
      </div>

      {/* ── Body ── */}
      <div className="word-definition-body">
        {loading ? (
          <span className="word-definition-loading">Looking up…</span>
        ) : (
          <>
            {/* Concordance section */}
            {toggles.concordance && (
              concordance ? (
                <div className="concordance-content">
                  <div className="concordance-original">
                    <span className="concordance-original-word">{concordance.originalWord}</span>
                    <span className="concordance-separator">|</span>
                    <span className="concordance-pronunciation">{concordance.pronunciation}</span>
                    <span className="concordance-separator">|</span>
                  </div>
                  <p className="concordance-short-def">{concordance.shortDefinition}</p>
                  {concordance.detailedDefinition && concordance.detailedDefinition.length > 0 && (
                    <div className="concordance-section">
                      <div className="concordance-section-title">Also translated as</div>
                      <p className="concordance-detailed-def">
                        {concordance.detailedDefinition.slice(0, 5).join(', ')}
                      </p>
                    </div>
                  )}
                  {concordance.rootForm && (
                    <div className="concordance-section">
                      <div className="concordance-section-title">Root Form</div>
                      <div className="concordance-original">
                        <span className="concordance-original-word">{concordance.rootForm.originalWord}</span>
                        <span className="concordance-separator">|</span>
                        <span className="concordance-pronunciation">{concordance.rootForm.pronunciation}</span>
                        <span className="concordance-separator">|</span>
                      </div>
                    </div>
                  )}
                  <div className="concordance-strongs">
                    Strong&apos;s #: {concordance.strongsNumber}
                  </div>
                </div>
              ) : definition ? (
                <p className="word-definition-text">{definition}</p>
              ) : (
                <p className="word-definition-none">No concordance data available.</p>
              )
            )}

            {/* Divider between sections when both visible */}
            {toggles.concordance && toggles.metaphysical && (concordance || definition) && mib && (
              <div className="popup-section-divider" />
            )}

            {/* Metaphysical section */}
            {toggles.metaphysical && (
              mib ? (
                <div className="mib-content">
                  <div className="mib-section-label">Metaphysical Interpretation</div>
                  <div className="mib-header">
                    <span className="mib-word">{mib.word}</span>
                    {mib.pronunciation && (
                      <span className="mib-pronunciation">{mib.pronunciation}</span>
                    )}
                    {mib.etymology && (
                      <span className="mib-etymology">{mib.etymology}</span>
                    )}
                  </div>
                  {mib.definition && (
                    <p className="mib-definition">{mib.definition}</p>
                  )}
                  {mib.metaphysical && (
                    <p className="mib-metaphysical">
                      {mib.metaphysical.length > 500
                        ? mib.metaphysical.slice(0, 500).trimEnd() + '…'
                        : mib.metaphysical}
                    </p>
                  )}
                  {mib.scriptureRefs && mib.scriptureRefs.length > 0 && (
                    <div className="mib-refs">
                      {mib.scriptureRefs.slice(0, 4).map(r => r.ref).join('  ·  ')}
                    </div>
                  )}
                </div>
              ) : (
                <p className="word-definition-none mib-none">No metaphysical entry found.</p>
              )
            )}

            {/* Both sections hidden */}
            {!toggles.concordance && !toggles.metaphysical && (
              <p className="word-definition-none">All sections hidden — use the toggles above.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default WordDefinition
