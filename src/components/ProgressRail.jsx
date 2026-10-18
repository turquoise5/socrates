import { useState } from 'react'
import { ChevronLeft, ChevronRight, Network, Plus, X } from 'lucide-react'

const STATUS_STYLES = {
  upcoming: { dot: 'bg-slate-300', text: 'text-slate-400' },
  current: { dot: 'bg-indigo-600 ring-4 ring-indigo-100', text: 'text-slate-900 font-semibold' },
  'needs-review': { dot: 'bg-amber-500', text: 'text-amber-700' },
  consolidated: { dot: 'bg-emerald-600', text: 'text-emerald-700' },
}

export default function ProgressRail({ state, onJump, onAddMemory, onRemoveMemory, onOpenMap }) {
  const [open, setOpen] = useState(true)
  const [memText, setMemText] = useState('')

  const addMem = () => {
    if (!memText.trim()) return
    onAddMemory(memText.trim())
    setMemText('')
  }

  if (!open) {
    return (
      <div className="flex h-full w-9 flex-col items-center border-r border-slate-200 bg-white py-2">
        <button onClick={() => setOpen(true)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Expand">
          <ChevronRight size={16} />
        </button>
        <button onClick={onOpenMap} className="mt-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Open concept map">
          <Network size={14} />
        </button>
        <div className="mt-3 flex flex-col items-center gap-2">
          {state.conceptMap.map((c) => (
            <span
              key={c.id}
              title={c.title}
              className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[c.status]?.dot || 'bg-slate-300'}`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Concepts</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onOpenMap} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Open concept map">
            <Network size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Collapse">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ol className="relative flex flex-col gap-0.5">
          {state.conceptMap.map((c, i) => {
            const s = STATUS_STYLES[c.status] || STATUS_STYLES.upcoming
            return (
              <li key={c.id} className="relative flex gap-2.5">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => onJump(c)}
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot} transition hover:scale-125`}
                    title={`Jump to: ${c.title}`}
                  />
                  {i < state.conceptMap.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
                </div>
                <button
                  onClick={() => onJump(c)}
                  className={`pb-3 text-left text-xs leading-snug ${s.text} hover:underline`}
                  title={c.summary}
                >
                  {c.title}
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="border-t border-slate-200 px-3 py-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Test me later
        </div>
        <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
          {state.pendingMemory.map((m) => (
            <div key={m.id} className="group flex items-start gap-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
              <span className="flex-1">{m.text}</span>
              <button onClick={() => onRemoveMemory(m.id)} className="invisible text-slate-400 hover:text-red-500 group-hover:visible">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <input
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMem()}
            placeholder="test me on…"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
          />
          <button onClick={addMem} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
