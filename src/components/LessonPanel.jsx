import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CornerDownLeft, Download, LogOut, SlidersHorizontal } from 'lucide-react'
import BeatCard from './beats/BeatCard'

export default function LessonPanel({
  state,
  onBeatResponse,
  onFreeEvent,
  onEndSession,
  onSkip,
  onToggleExport,
  onExport,
  onSetPace,
  freeSkip,
  setFreeSkip,
}) {
  const { beats, loading, error, title } = state
  const scrollRef = useRef(null)
  const [question, setQuestion] = useState('')
  const [pageView, setPageView] = useState(null) // 1-indexed source page or null
  const [showSettings, setShowSettings] = useState(false)
  const [focusDraft, setFocusDraft] = useState(state.focus || '')

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [beats.length, loading])

  const latest = beats[beats.length - 1]
  // present / visual / tangent beats advance via Continue — unless they carry a question
  const canContinue =
    latest &&
    !loading &&
    !latest.studentResponse &&
    !latest.question &&
    (latest.beat_type === 'present' ||
      latest.beat_type === 'tangent' ||
      (latest.beat_type === 'visual' && (!latest.visual_spec?.question || latest.visual_spec?.clickable === false)))

  const sendQuestion = () => {
    if (!question.trim() || loading) return
    onFreeEvent({ kind: 'question', text: question.trim() })
    setQuestion('')
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-slate-50">
      <div className="relative flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-2.5">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{title || 'Lesson'}</h1>
        <button
          onClick={onExport}
          className="flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Download this session as Markdown (toggle beats via the file icon on each card)"
        >
          <Download size={12} /> Export
        </button>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={`flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${showSettings ? 'border-indigo-400 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          title="Pace, focus, and skipping"
        >
          <SlidersHorizontal size={12} /> Pace
        </button>
        <button
          onClick={onEndSession}
          className="flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Save progress to your knowledge record and end the session"
        >
          <LogOut size={12} /> End session
        </button>
        {showSettings && (
          <div className="absolute right-5 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pace</div>
            <div className="mb-3 flex gap-1">
              {['thorough', 'balanced', 'fast'].map((p) => (
                <button
                  key={p}
                  onClick={() => onSetPace({ pace: p, focus: state.focus })}
                  className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${state.pace === p ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Focus on</div>
            <div className="mb-3 flex gap-1">
              <input
                value={focusDraft}
                onChange={(e) => setFocusDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSetPace({ pace: state.pace, focus: focusDraft.trim() })}
                placeholder="e.g. the backward pass"
                className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
              />
              <button
                onClick={() => onSetPace({ pace: state.pace, focus: focusDraft.trim() })}
                className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
              >
                Set
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={freeSkip} onChange={(e) => setFreeSkip(e.target.checked)} className="accent-indigo-600" />
              Free skipping (no test-out question when I skip)
            </label>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {beats.map((b, i) => (
            <BeatCard
              key={b.id}
              beat={b}
              isLatest={i === beats.length - 1}
              loading={loading}
              onRespond={onBeatResponse}
              onSkip={onSkip}
              onToggleExport={onToggleExport}
              sourcePages={state.sourcePages}
              onOpenPage={setPageView}
            />
          ))}
          {loading && (
            <div className="flex items-center gap-2 px-1 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
              working…
            </div>
          )}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}{' '}
              <button className="font-medium underline" onClick={() => onFreeEvent({ kind: 'retry' })}>
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {pageView && state.sourcePages?.[pageView - 1] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
          onClick={() => setPageView(null)}
        >
          <div className="max-h-full overflow-y-auto rounded-lg bg-white p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between px-2 text-xs text-slate-500">
              <span>Source material — page {pageView}</span>
              <button onClick={() => setPageView(null)} className="rounded px-1.5 py-0.5 hover:bg-slate-100">✕</button>
            </div>
            <img src={state.sourcePages[pageView - 1]} alt={`source page ${pageView}`} className="max-h-[80vh] rounded" />
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendQuestion()}
            placeholder="Ask about something — prerequisites welcome…"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={sendQuestion}
            disabled={loading || !question.trim()}
            className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title="Send question"
          >
            <CornerDownLeft size={16} />
          </button>
          {canContinue && (
            <button
              onClick={() => onFreeEvent({ kind: 'answer', text: '(continue)' })}
              className="flex items-center gap-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Continue <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
