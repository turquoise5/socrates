import { useRef, useState } from 'react'
import { BookOpen, FileUp, NotebookText, RotateCcw, X } from 'lucide-react'
import AboutModal from './AboutModal'

export default function StartScreen({ onStart, extracting, error, nudge, onDismissNudge, priorConcepts, dueCount = 0, onStartReview, pastSessions = [], onResumeSession, user, onSwitchUser }) {
  const [topic, setTopic] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const fileRef = useRef(null)
  // Newest first; only sessions that can actually be reopened.
  const notebooks = [...pastSessions].filter((s) => s.resume?.beats?.length || s.notes).reverse()

  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="w-full max-w-lg px-6">
        <div className="mb-1 flex items-center gap-2 text-slate-900">
          <BookOpen size={22} />
          <h1 className="text-xl font-semibold">Socrates</h1>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          <button onClick={() => setShowAbout(true)} className="underline hover:text-slate-700">
            About
          </button>
          {user && (
            <span className="mt-1 block text-xs text-slate-400">
              Learning as <b className="text-slate-500">{user}</b> ·{' '}
              <button onClick={onSwitchUser} className="underline hover:text-slate-600">
                switch user
              </button>
            </span>
          )}
        </p>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

        {nudge && (
          <div className="mb-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="flex-1">
              Pending from last time: <b>{nudge.text}</b> — bring it up during the session and the tutor will test you.
            </span>
            <button onClick={() => onDismissNudge(nudge.id)} className="text-amber-500 hover:text-amber-700">
              <X size={14} />
            </button>
          </div>
        )}

        {dueCount > 0 && !extracting && (
          <button
            onClick={onStartReview}
            className="mb-4 flex w-full items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-sm text-indigo-800 hover:bg-indigo-100"
          >
            <RotateCcw size={14} className="shrink-0" />
            <span className="flex-1">
              <b>{dueCount}</b> concept{dueCount > 1 ? 's' : ''} due for review — a few quick checks
            </span>
            <span className="text-xs font-medium">Review now →</span>
          </button>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name a topic
          </label>
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && topic.trim() && onStart({ topic: topic.trim() })}
              placeholder="e.g. Backpropagation, Galois theory, Raft consensus…"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              disabled={extracting}
            />
            <button
              onClick={() => topic.trim() && onStart({ topic: topic.trim() })}
              disabled={extracting || !topic.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Begin
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40"
          >
            <FileUp size={15} /> Upload material (PDF or text)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onStart({ file: f })
              e.target.value = ''
            }}
          />
        </div>

        {extracting && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            Mapping the concepts…
          </div>
        )}
        {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {notebooks.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Notebooks — pick up where you left off
            </div>
            <div className="grid grid-cols-3 gap-2">
              {notebooks.slice(0, 9).map((s) => (
                <button
                  key={s.id || s.endedAt}
                  onClick={() => onResumeSession(s)}
                  disabled={!s.resume?.beats?.length}
                  title={s.resume?.beats?.length ? 'Reopen this lesson' : 'No transcript saved for this session'}
                  className="flex aspect-square flex-col rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <NotebookText size={14} className="mb-1 shrink-0 text-indigo-400" />
                  <span className="line-clamp-3 min-h-0 flex-1 text-xs font-medium leading-snug text-slate-700">
                    {s.title}
                  </span>
                  <span className="mt-1 shrink-0 text-[10px] text-slate-400">
                    {new Date(s.endedAt).toLocaleDateString()}
                    {s.resume?.beats?.length ? ` · ${s.resume.beats.length} beats` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {priorConcepts.length > 0 && (
          <div className="mt-4 text-xs text-slate-400">
            Knowledge on record: {priorConcepts.slice(0, 6).join(' · ')}
            {priorConcepts.length > 6 && ` · +${priorConcepts.length - 6} more`}
          </div>
        )}
      </div>
    </div>
  )
}
