import { useState, useEffect, useRef } from 'react'

function WordDefinition({ word, position, onClose }) {
  const [definition, setDefinition] = useState(null)
  const [loading, setLoading] = useState(true)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!word) return
    setLoading(true)
    fetch(`/api/define/${encodeURIComponent(word)}`)
      .then(res => res.json())
      .then(data => {
        setDefinition(data.definition)
        setLoading(false)
      })
      .catch(() => {
        setDefinition(null)
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
    style.left = Math.min(position.x, window.innerWidth - 320)
    style.top = position.y + 24
    // If near bottom, show above
    if (position.y + 200 > window.innerHeight) {
      style.top = position.y - 120
    }
  }

  if (!word) return null

  return (
    <div className="word-definition-popup" ref={popupRef} style={style}>
      <div className="word-definition-header">
        <span className="word-definition-word">{word}</span>
        <button className="word-definition-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="word-definition-body">
        {loading ? (
          <span className="word-definition-loading">Looking up…</span>
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
