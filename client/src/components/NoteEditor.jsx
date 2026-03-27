import { useState, useEffect, useRef } from 'react'

function NoteEditor({ verse, existingContent, onSave, onCancel }) {
  const [content, setContent] = useState(existingContent || '')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  function handleSave() {
    const trimmed = content.trim()
    if (!trimmed) return
    onSave(verse, trimmed)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave()
    }
  }

  return (
    <div className="note-editor">
      <textarea
        ref={textareaRef}
        className="note-editor-textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a note for this verse..."
        rows={3}
      />
      <div className="note-editor-actions">
        <button className="note-editor-save" onClick={handleSave} disabled={!content.trim()}>
          Save
        </button>
        <button className="note-editor-cancel" onClick={onCancel}>
          Cancel
        </button>
        <span className="note-editor-hint">Ctrl+Enter to save · Esc to cancel</span>
      </div>
    </div>
  )
}

export default NoteEditor
