import { useState, useEffect, useRef } from 'react'

function WordDefinition({ word, position, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!word) return
    setLoading(true)
    fetch(`/api/define/${encodeURIComponent(word)}`)
      .then(res => res.json())
      .then(result => {
        setData(result)
        setLoading(false)
      })
      .catch(() => {
        setData(null)
        setLoading(false)
      })
  }, [word])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose()
      }
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
  const definition = data?.definition

  return (
    <div className="word-definition-popup" ref={popupRef} style={style}>
      <div className="word-definition-header">
        <span className="word-definition-word">{word}</span>
        <button className="word-definition-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="word-definition-body">
        {loading ? (
          <span className="word-definition-loading">Looking up…</span>
        ) : concordance ? (
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
                <div className="concordance-section-title">Detailed Definition</div>
                <p className="concordance-detailed-def">
                  {concordance.detailedDefinition.join(', ')}
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
          <p className="word-definition-none">No definition available for this word.</p>
        )}
      </div>
    </div>
  )
}

export default WordDefinition
