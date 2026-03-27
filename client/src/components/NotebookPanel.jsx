import { useState, useEffect, useCallback } from 'react'

function NotebookPanel({ books, currentBook, currentChapter, user, onClose, onNavigate }) {
  const [notes, setNotes] = useState([])
  const [filter, setFilter] = useState('chapter') // 'chapter' | 'all' | 'search'
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editContent, setEditContent] = useState('')

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('bf-token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchNotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      let url
      if (filter === 'chapter') {
        url = `/api/notes?book=${currentBook}&chapter=${currentChapter}`
      } else if (filter === 'search' && searchQuery.trim()) {
        url = `/api/notes/search?q=${encodeURIComponent(searchQuery.trim())}`
      } else {
        url = '/api/notes/all'
      }
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setNotes(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [user, filter, currentBook, currentChapter, searchQuery, getAuthHeaders])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  function getBookName(bookId) {
    const book = books.find(b => b.id === bookId)
    return book ? book.shortName || book.name : `Book ${bookId}`
  }

  async function handleDelete(noteId) {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      })
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId))
      }
    } catch {
      // silently fail
    }
  }

  function handleStartEdit(note) {
    setEditingNoteId(note.id)
    setEditContent(note.content)
  }

  async function handleSaveEdit(noteId) {
    const trimmed = editContent.trim()
    if (!trimmed) return
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes(prev => prev.map(n => n.id === noteId ? updated : n))
        setEditingNoteId(null)
      }
    } catch {
      // silently fail
    }
  }

  function handleNoteClick(note) {
    if (onNavigate) {
      onNavigate(note.book, note.chapter)
    }
  }

  return (
    <div className="notebook-panel">
      <div className="notebook-header">
        <h3 className="notebook-title">📓 Notebook</h3>
        <button className="notebook-close" onClick={onClose} aria-label="Close notebook">✕</button>
      </div>

      <div className="notebook-filters">
        <button
          className={`notebook-filter-btn ${filter === 'chapter' ? 'active' : ''}`}
          onClick={() => setFilter('chapter')}
        >
          This Chapter
        </button>
        <button
          className={`notebook-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Notes
        </button>
        <button
          className={`notebook-filter-btn ${filter === 'search' ? 'active' : ''}`}
          onClick={() => setFilter('search')}
        >
          Search
        </button>
      </div>

      {filter === 'search' && (
        <div className="notebook-search">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="notebook-search-input"
          />
        </div>
      )}

      <div className="notebook-notes-list">
        {loading ? (
          <div className="notebook-loading">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="notebook-empty">No notes found</div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="notebook-note-item">
              <div className="notebook-note-ref" onClick={() => handleNoteClick(note)} role="button" tabIndex={0}>
                {getBookName(note.book)} {note.chapter}:{note.verse}
              </div>
              {editingNoteId === note.id ? (
                <div className="notebook-note-edit">
                  <textarea
                    className="notebook-edit-textarea"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                  />
                  <div className="notebook-edit-actions">
                    <button className="notebook-edit-save" onClick={() => handleSaveEdit(note.id)}>Save</button>
                    <button className="notebook-edit-cancel" onClick={() => setEditingNoteId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="notebook-note-content">{note.content}</div>
                  <div className="notebook-note-actions">
                    <button className="notebook-note-edit-btn" onClick={() => handleStartEdit(note)} aria-label="Edit note">✏️</button>
                    <button className="notebook-note-delete-btn" onClick={() => handleDelete(note.id)} aria-label="Delete note">🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default NotebookPanel
