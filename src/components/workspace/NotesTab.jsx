import { useState } from 'react'
import { Eye, Pencil, Send } from 'lucide-react'
import Markdown from '../Markdown'

// The student's own space. The tutor sees it only on submit and never edits it.
export default function NotesTab({ notes, setNotes, onSubmit, disabled, consolidatePending }) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <button
          onClick={() => setPreview((p) => !p)}
          className="flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {preview ? <Pencil size={12} /> : <Eye size={12} />}
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button
          onClick={() => notes.trim() && onSubmit({ kind: consolidatePending ? 'consolidate_summary' : 'notes', text: notes.trim() })}
          disabled={disabled || !notes.trim()}
          className="ml-auto flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Send size={13} />
          {consolidatePending ? 'Submit summary to tutor' : 'Submit to tutor'}
        </button>
      </div>
      {consolidatePending && (
        <div className="border-b border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700">
          The tutor asked for a summary in your own words — write it here, then submit.
        </div>
      )}
      {preview ? (
        <div className="flex-1 overflow-y-auto bg-white p-4">
          <Markdown>{notes || '_nothing yet_'}</Markdown>
        </div>
      ) : (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={'Your notes (markdown). This space is yours — the tutor reads it only when you submit.'}
          className="flex-1 resize-none bg-white p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none"
        />
      )}
    </div>
  )
}
