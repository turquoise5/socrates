import { useState } from 'react'
import { PenTool, Code2, StickyNote, CircleDashed, HelpCircle, Hammer, FileCheck2, FileX2, SkipForward } from 'lucide-react'
import Markdown from '../Markdown'
import VisualRenderer from '../visuals/VisualRenderer'
import { sanitizeBeatContent } from '../../utils/sanitizeBeat'

const TYPE_STYLES = {
  present: { label: 'Material', ring: 'border-slate-200', chip: 'bg-slate-100 text-slate-600' },
  visual: { label: 'Visual', ring: 'border-indigo-200', chip: 'bg-indigo-50 text-indigo-700' },
  ask: { label: 'Question', ring: 'border-amber-300', chip: 'bg-amber-50 text-amber-700' },
  exercise: { label: 'Exercise', ring: 'border-emerald-300', chip: 'bg-emerald-50 text-emerald-700' },
  check: { label: 'Check', ring: 'border-rose-300', chip: 'bg-rose-50 text-rose-700' },
  consolidate: { label: 'Consolidate', ring: 'border-violet-300', chip: 'bg-violet-50 text-violet-700' },
  tangent: { label: 'Tangent', ring: 'border-cyan-300', chip: 'bg-cyan-50 text-cyan-700' },
}

const TARGET_META = {
  whiteboard: { icon: PenTool, label: 'Work on the Whiteboard tab, then submit to tutor' },
  code: { icon: Code2, label: 'Work in the Code tab, then submit to tutor' },
  project: { icon: Hammer, label: 'Build this step in the Project tab, then submit to tutor' },
}

function AnswerInput({ placeholder, buttonLabel = 'Answer', numeric = false, onSubmit }) {
  const [text, setText] = useState('')
  const submit = () => {
    if (text.trim()) onSubmit(text.trim())
  }
  return (
    <div className="mt-3 flex items-end gap-2">
      {numeric ? (
        <input
          type="number"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className="w-48 rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
          placeholder={placeholder}
          rows={Math.min(6, Math.max(2, text.split('\n').length))}
          className="flex-1 resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      )}
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="shrink-0 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function ResponseBlock({ response }) {
  if (!response) return null
  return (
    <div className="mt-3 border-l-2 border-slate-300 pl-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your response</div>
      {response.image && (
        <img
          src={`data:image/png;base64,${response.image}`}
          alt="whiteboard submission"
          className="mt-1 max-h-48 rounded border border-slate-200"
        />
      )}
      {response.text && (
        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{response.text}</div>
      )}
      {response.codeOutput && (
        <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{response.codeOutput}</pre>
      )}
    </div>
  )
}

export default function BeatCard({ beat, isLatest, loading, onRespond, onSkip, onToggleExport, sourcePages, onOpenPage }) {
  const sanitizeOpts = { pageCount: sourcePages?.length ?? 0 }
  const style = TYPE_STYLES[beat.beat_type] || TYPE_STYLES.present
  const answered = !!beat.studentResponse
  const active = isLatest && !answered && !loading

  const respond = (kind, text, extra = {}) => onRespond(beat, { kind, text, ...extra })

  const needsInline =
    beat.beat_type === 'ask' ||
    beat.beat_type === 'check' ||
    (beat.beat_type === 'exercise' && (beat.exercise_target === 'text' || !beat.exercise_target)) ||
    ((beat.beat_type === 'visual' || beat.beat_type === 'present' || beat.beat_type === 'tangent') &&
      (beat.question || beat.visual_spec?.question) &&
      !beat.visual_spec?.clickable)

  const target = beat.beat_type === 'exercise' ? TARGET_META[beat.exercise_target] : null
  const waitingOnWorkspace =
    !answered &&
    ((beat.beat_type === 'exercise' && target) || beat.beat_type === 'consolidate')

  return (
    <div className={`rounded-lg border ${style.ring} bg-white p-4 shadow-sm`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.chip}`}>
          {style.label}
        </span>
        {beat.concept_id && (
          <span className="text-[11px] text-slate-400">{beat.concept_id}</span>
        )}
        <button
          onClick={() => onToggleExport?.(beat)}
          className={`ml-auto rounded p-0.5 ${beat.excluded ? 'text-slate-300 hover:text-slate-500' : 'text-emerald-500 hover:text-emerald-700'}`}
          title={beat.excluded ? 'Excluded from export — click to include' : 'Included in export — click to exclude'}
        >
          {beat.excluded ? <FileX2 size={13} /> : <FileCheck2 size={13} />}
        </button>
      </div>

      <Markdown onOpenPage={onOpenPage}>{sanitizeBeatContent(beat.content, sanitizeOpts)}</Markdown>

      {beat.visual_spec && (
        <div className="mt-3">
          <VisualRenderer
            spec={beat.visual_spec}
            sourcePages={sourcePages}
            onNodeSelect={
              active && beat.visual_spec.clickable
                ? (node) => respond('answer', `Selected node: ${node.label || node.id}`)
                : undefined
            }
          />
        </div>
      )}

      {/* the beat's focused question, visually distinct from the material */}
      {beat.question && (
        <div className="mt-3 flex gap-2 rounded-md border-l-4 border-indigo-500 bg-indigo-50/70 px-3 py-2.5">
          <HelpCircle size={16} className="mt-0.5 shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1 text-[0.925rem] font-medium text-slate-900">
            <Markdown onOpenPage={onOpenPage}>{sanitizeBeatContent(beat.question, sanitizeOpts)}</Markdown>
          </div>
        </div>
      )}

      {/* choice options */}
      {beat.beat_type === 'check' && beat.check_format === 'choice' && Array.isArray(beat.check_options) && (
        <div className="mt-3 flex flex-col gap-1.5">
          {beat.check_options.map((opt, i) => {
            const label = typeof opt === 'string' ? opt : opt.label ?? JSON.stringify(opt)
            const picked = answered && beat.studentResponse.text === label
            return (
              <button
                key={i}
                disabled={!active}
                onClick={() => respond('check_answer', label)}
                className={`rounded border px-3 py-2 text-left text-sm ${
                  picked
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-800 enabled:hover:border-indigo-400 disabled:opacity-60'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* inline free/numeric/predict input */}
      {active && needsInline && beat.check_format !== 'choice' && (
        <AnswerInput
          numeric={beat.check_format === 'numeric'}
          placeholder={
            beat.check_format === 'predict'
              ? 'Commit your prediction before trying it…'
              : beat.beat_type === 'exercise'
                ? 'Write your work here…'
                : 'Your answer… (Ctrl+Enter to send)'
          }
          buttonLabel={beat.check_format === 'predict' ? 'Commit prediction' : 'Answer'}
          onSubmit={(text) =>
            respond(beat.beat_type === 'check' ? 'check_answer' : 'answer', text, {
              ...(beat.check_format === 'predict' ? { committed_prediction: true } : {}),
            })
          }
        />
      )}

      {/* exercise / consolidate waiting state */}
      {active && waitingOnWorkspace && (
        <div className="mt-3 flex items-center gap-2 rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          {beat.beat_type === 'consolidate' ? (
            <>
              <StickyNote size={15} />
              Write your summary in the <b>Notes</b> tab, then submit it to the tutor.
            </>
          ) : (
            <>
              <target.icon size={15} />
              {target.label}
            </>
          )}
          <CircleDashed size={14} className="ml-auto animate-spin text-slate-400" style={{ animationDuration: '3s' }} />
        </div>
      )}

      {/* skip: "I already know this" — test-out or free skip per settings */}
      {active && (needsInline || waitingOnWorkspace || beat.check_format === 'choice') && (
        <button
          onClick={() => onSkip?.(beat)}
          className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
        >
          <SkipForward size={11} /> Skip — I already know this
        </button>
      )}

      <ResponseBlock response={beat.studentResponse} />
    </div>
  )
}
