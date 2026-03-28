import { useState, useEffect } from 'react'

function TeachingEditor({ book, chapter, verse, bookName, user, getAuthHeaders, onClose }) {
  const [teachings, setTeachings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/teachings', { headers: getAuthHeaders(), credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => { setTeachings(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [getAuthHeaders])

  function handleAddToExisting(teachingId) {
    setAdding(true)
    fetch(`/api/teachings/${teachingId}/verses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ book, chapter, verse }),
    })
      .then(res => {
        if (res.ok) onClose('added')
        else setAdding(false)
      })
      .catch(() => setAdding(false))
  }

  function handleCreateAndAdd() {
    if (!newTitle.trim()) return
    setAdding(true)
    fetch('/api/teachings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ title: newTitle.trim() }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          return fetch(`/api/teachings/${data.id}/verses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({ book, chapter, verse }),
          })
        }
      })
      .then(res => {
        if (res && res.ok) onClose('added')
        else setAdding(false)
      })
      .catch(() => setAdding(false))
  }

  return (
    <div className="teaching-add-popup" onClick={e => e.stopPropagation()}>
      <div className="teaching-add-header">
        <span>Add {bookName} {chapter}:{verse} to Teaching</span>
        <button className="teaching-add-close" onClick={() => onClose()}>×</button>
      </div>
      <div className="teaching-add-body">
        {loading && <div className="teaching-add-loading">Loading…</div>}
        {!loading && teachings.length > 0 && (
          <div className="teaching-add-list">
            {teachings.map(t => (
              <button
                key={t.id}
                className="teaching-add-item"
                onClick={() => handleAddToExisting(t.id)}
                disabled={adding}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
        {!showNew ? (
          <button className="teaching-add-new-btn" onClick={() => setShowNew(true)}>
            + New Teaching
          </button>
        ) : (
          <div className="teaching-add-new-form">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Teaching title"
              className="teaching-add-new-input"
            />
            <button
              className="teaching-add-create-btn"
              onClick={handleCreateAndAdd}
              disabled={!newTitle.trim() || adding}
            >
              Create & Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeachingEditor
