import { useState } from 'react'
import { PenTool, Code2, StickyNote, Hammer } from 'lucide-react'
import WhiteboardTab from './WhiteboardTab'
import CodeTab from './CodeTab'
import NotesTab from './NotesTab'
import ProjectTab from './ProjectTab'

const TABS = [
  { id: 'whiteboard', label: 'Whiteboard', icon: PenTool },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'project', label: 'Project', icon: Hammer },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

export default function WorkspacePanel({ onSubmit, disabled, consolidatePending, activeTabHint, notes, setNotes, project, setProjectCode, onDeclineProject }) {
  const [tab, setTab] = useState('whiteboard')
  // Follow the tutor's pointer (exercise_target / consolidate) once per hint.
  const [lastHint, setLastHint] = useState(null)
  if (activeTabHint && activeTabHint !== lastHint) {
    setLastHint(activeTabHint)
    const wanted = activeTabHint.split(':')[0]
    if (TABS.some((t) => t.id === wanted)) setTab(wanted)
  }

  return (
    <div className="flex h-full min-w-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium ${
              tab === id
                ? 'border-b-2 border-indigo-600 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} /> {label}
            {id === 'notes' && consolidatePending && (
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            )}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {/* All tabs stay mounted so state survives switching. Hidden tabs use
            `invisible` (not display:none): Monaco's canvases collapse to zero
            size under display:none, which hangs Chrome's screen capture. */}
        {/* Whiteboard stays display:none when hidden — Excalidraw hangs
            Chrome's screen capture if it renders at all (even invisible). */}
        <div className={tab === 'whiteboard' ? 'h-full' : 'hidden'}>
          <WhiteboardTab onSubmit={onSubmit} disabled={disabled} />
        </div>
        <div className={tab === 'code' ? 'h-full' : 'invisible absolute inset-0 h-full'} aria-hidden={tab !== 'code'}>
          <CodeTab onSubmit={onSubmit} disabled={disabled} />
        </div>
        <div className={tab === 'project' ? 'h-full' : 'invisible absolute inset-0 h-full'} aria-hidden={tab !== 'project'}>
          <ProjectTab
            project={project}
            setProjectCode={setProjectCode}
            onDeclineProject={onDeclineProject}
            onSubmit={onSubmit}
            disabled={disabled}
          />
        </div>
        <div className={tab === 'notes' ? 'h-full' : 'invisible absolute inset-0 h-full'} aria-hidden={tab !== 'notes'}>
          <NotesTab
            notes={notes}
            setNotes={setNotes}
            onSubmit={onSubmit}
            disabled={disabled}
            consolidatePending={consolidatePending}
          />
        </div>
      </div>
    </div>
  )
}
