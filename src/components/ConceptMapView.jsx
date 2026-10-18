import { useMemo, useState } from 'react'
import { X, Target, Compass, MessageCircleQuestion, RotateCcw } from 'lucide-react'
import { recallProbability } from '../utils/learnerModel'

const STATUS = {
  upcoming: { dot: '#cbd5e1', label: 'new' },
  current: { dot: '#4f46e5', label: 'current' },
  'needs-review': { dot: '#f59e0b', label: 'needs review' },
  consolidated: { dot: '#059669', label: 'complete' },
}

// Minimalist prerequisite map — the "everything you need for calculus"
// style: layered top-down DAG, one dot per concept, thin edges, notes
// under shaky concepts.
export default function ConceptMapView({ concepts, records = {}, onToggleReview, onClose, onTest, onExplore, onAsk, busy }) {
  const [selected, setSelected] = useState(null)
  const [askText, setAskText] = useState('')

  const layout = useMemo(() => {
    const byId = Object.fromEntries(concepts.map((c) => [c.id, c]))
    // layer = longest prerequisite chain above the node
    const depth = {}
    const walk = (id, seen = new Set()) => {
      if (depth[id] !== undefined) return depth[id]
      if (seen.has(id)) return 0 // cycle guard
      seen.add(id)
      const reqs = (byId[id]?.requires || []).filter((r) => byId[r])
      depth[id] = reqs.length ? 1 + Math.max(...reqs.map((r) => walk(r, seen))) : 0
      return depth[id]
    }
    concepts.forEach((c) => walk(c.id))
    // fall back to list order as a chain when no edges exist at all
    const noEdges = concepts.every((c) => !(c.requires || []).some((r) => byId[r]))
    if (noEdges) concepts.forEach((c, i) => (depth[c.id] = i))

    const layers = []
    concepts.forEach((c) => {
      const d = depth[c.id]
      ;(layers[d] = layers[d] || []).push(c)
    })
    const W = 860
    const rowH = noEdges ? 84 : 118
    const pos = {}
    layers.forEach((row, li) => {
      row.forEach((c, i) => {
        pos[c.id] = { x: (W / (row.length + 1)) * (i + 1), y: 70 + li * rowH }
      })
    })
    const edges = []
    concepts.forEach((c) =>
      (c.requires || []).forEach((r) => {
        if (pos[r]) edges.push({ from: pos[r], to: pos[c.id] })
      })
    )
    return { pos, edges, H: 70 + layers.length * rowH, W }
  }, [concepts])

  const sel = concepts.find((c) => c.id === selected)
  // The persistent learner-model record for the selected concept, if any.
  const rec = sel ? records[sel.id] : null
  const recall = rec?.mastery != null ? rec.mastery * (recallProbability(rec) ?? 1) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Concept map</h2>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            {Object.entries(STATUS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} /> {v.label}
              </span>
            ))}
            <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
          <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="w-full" style={{ minHeight: layout.H * 0.7 }}>
            {layout.edges.map((e, i) => (
              <path
                key={i}
                d={`M ${e.from.x} ${e.from.y + 8} C ${e.from.x} ${(e.from.y + e.to.y) / 2}, ${e.to.x} ${(e.from.y + e.to.y) / 2}, ${e.to.x} ${e.to.y - 8}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1.5"
                className="pointer-events-none"
              />
            ))}
            {concepts.map((c) => {
              const p = layout.pos[c.id]
              if (!p) return null
              const s = STATUS[c.status] || STATUS.upcoming
              const isSel = selected === c.id
              return (
                <g key={c.id} onClick={() => setSelected(isSel ? null : c.id)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={isSel ? 10 : 7} fill={s.dot} stroke={isSel ? '#0f172a' : '#fff'} strokeWidth="2" />
                  <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e293b">
                    {c.title.length > 34 ? c.title.slice(0, 32) + '…' : c.title}
                  </text>
                  {c.status === 'needs-review' && c.notes?.[0] && (
                    <text x={p.x} y={p.y + 40} textAnchor="middle" fontSize="10" fill="#b45309" fontStyle="italic">
                      {c.notes[0].length > 48 ? c.notes[0].slice(0, 46) + '…' : c.notes[0]}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {sel && (
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">{sel.title}</span>
              <span className="text-[11px] text-slate-400">{(STATUS[sel.status] || STATUS.upcoming).label}</span>
            </div>
            {sel.summary && <p className="mb-1 text-xs text-slate-500">{sel.summary}</p>}
            {rec?.attempts > 0 && (
              <p className="mb-1 text-[11px] text-slate-500">
                {rec.correct || 0}/{rec.attempts} answers correct · estimated recall now{' '}
                <b>{Math.round(recall * 100)}%</b>
                {rec.review && rec.dueAt && <> · next review {new Date(rec.dueAt).toLocaleDateString()}</>}
              </p>
            )}
            {rec?.misconceptions?.length > 0 && (
              <ul className="mb-1 text-xs text-rose-700">
                {rec.misconceptions.map((m) => (
                  <li key={m.text}>
                    · {m.text}
                    {m.count > 1 && <span className="text-rose-400"> (×{m.count})</span>}
                  </li>
                ))}
              </ul>
            )}
            {sel.notes?.length > 0 && (
              <ul className="mb-2 text-xs italic text-amber-700">
                {sel.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTest(sel)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
              >
                <Target size={12} /> Test me
              </button>
              <button
                onClick={() => onExplore(sel)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Compass size={12} /> Explore
              </button>
              {onToggleReview && (
                <button
                  onClick={() => onToggleReview(sel)}
                  title="Spaced review: get a quick check on this when it's due"
                  className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium ${
                    rec?.review
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw size={12} /> {rec?.review ? 'Reviewing' : 'Keep reviewing'}
                </button>
              )}
              <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
                <MessageCircleQuestion size={14} className="shrink-0 text-slate-400" />
                <input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && askText.trim()) {
                      onAsk(sel, askText.trim())
                      setAskText('')
                    }
                  }}
                  placeholder={`ask about ${sel.title}…`}
                  disabled={busy}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
