import NoteEditor from './NoteEditor'
import GematriaBadge from './GematriaBadge'
import TeachingEditor from './TeachingEditor'
import { useState, useEffect } from 'react'

function BibleViewer({ verses, bookName, chapter, totalChapters, loading, error, onChapterChange, onWordClick, stars, notes, onToggleStar, onEditNote, onShowAuthModal, user, currentBook, onAddCompare, onShowQabalistic, getAuthHeaders }) {
  const [editingVerse, setEditingVerse] = useState(null)
  const [gematriaValues, setGematriaValues] = useState({})
  const [teachingVerse, setTeachingVerse] = useState(null)

  const isOT = currentBook && currentBook >= 1 && currentBook <= 39

  // Fetch chapter gematria values for OT books
  useEffect(() => {
    if (!isOT || !currentBook || !chapter) {
      setGematriaValues({})
      return
    }
    fetch(`/api/gematria/chapter/${currentBook}/${chapter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.verses) {
          const map = {}
          data.verses.forEach(v => { map[v.verse] = v.value })
          setGematriaValues(map)
        } else {
          setGematriaValues({})
        }
      })
      .catch(() => setGematriaValues({}))
  }, [currentBook, chapter, isOT])

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

  function isStarred(verseNum) {
    return stars && stars.some(s => s.verse === verseNum)
  }

  function hasNote(verseNum) {
    return notes && notes.some(n => n.verse === verseNum)
  }

  function getNoteContent(verseNum) {
    const note = notes && notes.find(n => n.verse === verseNum)
    return note ? note.content : ''
  }

  function handleStarClick(e, verseNum) {
    e.stopPropagation()
    if (!user) {
      if (onShowAuthModal) onShowAuthModal()
      return
    }
    if (onToggleStar) onToggleStar(verseNum, isStarred(verseNum))
  }

  function handleNoteClick(e, verseNum) {
    e.stopPropagation()
    if (!user) {
      if (onShowAuthModal) onShowAuthModal()
      return
    }
    setEditingVerse(editingVerse === verseNum ? null : verseNum)
  }

  function handleNoteSave(verseNum, content) {
    if (onEditNote) onEditNote(verseNum, content)
    setEditingVerse(null)
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
            <span className="verse-actions">
              <sup className="verse-number">{v.verse}</sup>
              {isOT && gematriaValues[v.verse] && (
                <GematriaBadge
                  bookId={currentBook}
                  chapter={chapter}
                  verse={v.verse}
                  value={gematriaValues[v.verse]}
                />
              )}
              <button
                className={`verse-star-btn ${isStarred(v.verse) ? 'starred' : ''}`}
                onClick={e => handleStarClick(e, v.verse)}
                aria-label={isStarred(v.verse) ? 'Unstar verse' : 'Star verse'}
                title={isStarred(v.verse) ? 'Unstar verse' : 'Star verse'}
              >
                {isStarred(v.verse) ? '★' : '☆'}
              </button>
              <button
                className={`verse-note-btn ${hasNote(v.verse) ? 'has-note' : ''}`}
                onClick={e => handleNoteClick(e, v.verse)}
                aria-label={hasNote(v.verse) ? 'Edit note' : 'Add note'}
                title={hasNote(v.verse) ? 'Edit note' : 'Add note'}
              >
                {hasNote(v.verse) ? '📝' : '📄'}
              </button>
              {onAddCompare && (
                <button
                  className="verse-action-btn verse-compare-btn"
                  onClick={e => { e.stopPropagation(); onAddCompare(currentBook, chapter, v.verse) }}
                  aria-label="Add to compare"
                  title="Add to compare"
                >⚖</button>
              )}
              {isOT && onShowQabalistic && (
                <button
                  className="verse-action-btn verse-qabalistic-btn"
                  onClick={e => { e.stopPropagation(); onShowQabalistic(currentBook, chapter, v.verse) }}
                  aria-label="Qabalistic meaning"
                  title="✡ Qabalistic Meaning"
                >✡</button>
              )}
              {user && getAuthHeaders && (
                <button
                  className="verse-action-btn verse-teaching-btn"
                  onClick={e => { e.stopPropagation(); setTeachingVerse(teachingVerse === v.verse ? null : v.verse) }}
                  aria-label="Add to teaching"
                  title="Add to teaching"
                >📚</button>
              )}
            </span>
            <span className="verse-text">{renderVerseText(v.text)} </span>
            {teachingVerse === v.verse && user && getAuthHeaders && (
              <span className="verse-note-editor-wrapper">
                <TeachingEditor
                  book={currentBook}
                  chapter={chapter}
                  verse={v.verse}
                  bookName={bookName}
                  user={user}
                  getAuthHeaders={getAuthHeaders}
                  onClose={() => setTeachingVerse(null)}
                />
              </span>
            )}
            {editingVerse === v.verse && (
              <span className="verse-note-editor-wrapper">
                <NoteEditor
                  verse={v.verse}
                  existingContent={getNoteContent(v.verse)}
                  onSave={handleNoteSave}
                  onCancel={() => setEditingVerse(null)}
                />
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

export default BibleViewer
