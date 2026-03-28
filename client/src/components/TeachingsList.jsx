import { useState, useEffect, useCallback } from 'react'

function TeachingsList({ user, books, onClose, onNavigate, getAuthHeaders }) {
  const [teachings, setTeachings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // teaching id or 'new'
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formContent, setFormContent] = useState('')
  const [teachingDetail, setTeachingDetail] = useState(null)
  const [saving, setSaving] = useState(false)

  const headers = useCallback(() => {
    const h = { 'Content-Type': 'application/json', ...getAuthHeaders() }
    return h
  }, [getAuthHeaders])

  const fetchTeachings = useCallback(() => {
    setLoading(true)
    fetch('/api/teachings', { headers: getAuthHeaders(), credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => { setTeachings(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [getAuthHeaders])

  useEffect(() => { fetchTeachings() }, [fetchTeachings])

  function handleNew() {
    setEditing('new')
    setFormTitle('')
    setFormDesc('')
    setFormContent('')
    setTeachingDetail(null)
  }

  function handleEdit(t) {
    setEditing(t.id)
    setFormTitle(t.title)
    setFormDesc(t.description || '')
    setFormContent('')
    // Fetch detail
    fetch(`/api/teachings/${t.id}`, { headers: getAuthHeaders(), credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setTeachingDetail(data)
          setFormContent(data.contentJson || '')
        }
      })
      .catch(() => {})
  }

  function handleSave() {
    setSaving(true)
    const body = { title: formTitle, description: formDesc, contentJson: formContent }
    const url = editing === 'new' ? '/api/teachings' : `/api/teachings/${editing}`
    const method = editing === 'new' ? 'POST' : 'PUT'
    fetch(url, {
      method,
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then(res => res.ok ? res.json() : null)
      .then(() => {
        setSaving(false)
        setEditing(null)
        setTeachingDetail(null)
        fetchTeachings()
      })
      .catch(() => setSaving(false))
  }

  function handleDelete(id) {
    fetch(`/api/teachings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(res => {
        if (res.ok) fetchTeachings()
      })
  }

  function handleRemoveVerse(teachingId, verseId) {
    fetch(`/api/teachings/${teachingId}/verses/${verseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    })
      .then(res => {
        if (res.ok && teachingDetail) {
          setTeachingDetail(prev => ({
            ...prev,
            verses: prev.verses.filter(v => v.id !== verseId),
          }))
        }
      })
  }

  function getBookName(bookId) {
    const b = books.find(bk => bk.id === bookId)
    return b ? b.shortName : `Book ${bookId}`
  }

  // Editor view
  if (editing) {
    return (
      <div className="teachings-panel">
        <div className="teachings-header">
          <h2 className="teachings-title">{editing === 'new' ? 'New Teaching' : 'Edit Teaching'}</h2>
          <button className="teachings-close" onClick={() => { setEditing(null); setTeachingDetail(null) }}>×</button>
        </div>
        <div className="teachings-editor">
          <div className="teachings-field">
            <span>Title</span>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Teaching title"
              className="teachings-input"
            />
          </div>
          <div className="teachings-field">
            <span>Description</span>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Brief description…"
              className="teachings-textarea"
              rows={2}
            />
          </div>
          <div className="teachings-field">
            <span>Content</span>
            <textarea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder="Teaching content…"
              className="teachings-textarea teachings-content-area"
              rows={6}
            />
          </div>

          {teachingDetail && teachingDetail.verses && teachingDetail.verses.length > 0 && (
            <div className="teachings-verses-section">
              <span className="teachings-verses-label">Associated Verses</span>
              {teachingDetail.verses.map(v => (
                <div key={v.id} className="teachings-verse-item">
                  <span
                    className="teachings-verse-ref"
                    onClick={() => { if (onNavigate) onNavigate(v.book, v.chapter) }}
                  >
                    {getBookName(v.book)} {v.chapter}:{v.verse}
                  </span>
                  <button
                    className="teachings-verse-remove"
                    onClick={() => handleRemoveVerse(editing, v.id)}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="teachings-editor-actions">
            <button
              className="teachings-save-btn"
              onClick={handleSave}
              disabled={!formTitle.trim() || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="teachings-cancel-btn"
              onClick={() => { setEditing(null); setTeachingDetail(null) }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="teachings-panel">
      <div className="teachings-header">
        <h2 className="teachings-title">📚 Teachings</h2>
        <button className="teachings-close" onClick={onClose}>×</button>
      </div>
      <div className="teachings-actions-bar">
        <button className="teachings-new-btn" onClick={handleNew}>+ New Teaching</button>
      </div>
      <div className="teachings-list">
        {loading && <div className="teachings-loading">Loading…</div>}
        {!loading && teachings.length === 0 && (
          <div className="teachings-empty">No teachings yet. Create your first one!</div>
        )}
        {teachings.map(t => (
          <div key={t.id} className="teachings-item" onClick={() => handleEdit(t)}>
            <div className="teachings-item-title">{t.title}</div>
            {t.description && <div className="teachings-item-desc">{t.description}</div>}
            <div className="teachings-item-meta">
              {t.verseCount} verse{t.verseCount !== 1 ? 's' : ''}
              {' · '}
              {new Date(t.updatedAt || t.createdAt).toLocaleDateString()}
            </div>
            <button
              className="teachings-item-delete"
              onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
              aria-label="Delete teaching"
            >🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TeachingsList
