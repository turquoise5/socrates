import { useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { CheckCircle2, Circle, Play, Send } from 'lucide-react'
import Markdown from '../Markdown'
import { runPython } from '../../utils/pyodideRunner'

// The session's running project: one artifact that grows step by step as
// the tutor assigns milestones. Code persists with the session.
export default function ProjectTab({ project, setProjectCode, onDeclineProject, onSubmit, disabled }) {
  const [output, setOutput] = useState(null)
  const [running, setRunning] = useState(false)
  const debounceRef = useRef(null)
  const codeRef = useRef(project?.code ?? '')

  if (!project || (!project.brief && !project.milestones?.length)) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center text-sm text-slate-400">
        No project yet — the tutor proposes one as the lesson starts.
        <br />
        Project steps build on each other into one artifact you keep.
      </div>
    )
  }

  const done = project.milestones.filter((m) => m.status === 'done').length

  const run = async () => {
    setRunning(true)
    try {
      setOutput(await runPython(codeRef.current))
    } catch (err) {
      setOutput({ stdout: '', stderr: String(err) })
    } finally {
      setRunning(false)
    }
  }

  const submit = () => {
    const out = output
      ? [`--- stdout ---\n${output.stdout || '(empty)'}`, output.stderr ? `--- stderr ---\n${output.stderr}` : '']
          .filter(Boolean)
          .join('\n')
      : '(not run yet)'
    onSubmit({ kind: 'project', text: codeRef.current, codeOutput: out })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="max-h-44 shrink-0 overflow-y-auto border-b border-slate-200 bg-white px-3 py-2">
        <div className="text-sm text-slate-700">
          <Markdown>{project.brief}</Markdown>
        </div>
        {project.milestones.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-1.5 text-xs">
                {m.status === 'done' ? (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                ) : (
                  <Circle size={13} className="shrink-0 text-slate-300" />
                )}
                <span className={m.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {m.title}
                </span>
              </li>
            ))}
            <li className="mt-0.5 text-[10px] text-slate-400">
              {done}/{project.milestones.length} milestones
            </li>
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          defaultLanguage="python"
          value={project.code}
          onChange={(v) => {
            codeRef.current = v ?? ''
            clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => setProjectCode(codeRef.current), 600)
          }}
          options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play size={13} /> {running ? 'Running…' : 'Run'}
        </button>
        <button
          onClick={submit}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Send size={13} /> Submit to tutor
        </button>
        {!project.declined && (
          <button onClick={onDeclineProject} className="ml-auto text-xs text-slate-400 underline hover:text-slate-600">
            skip project this session
          </button>
        )}
      </div>

      <div className="h-28 shrink-0 overflow-y-auto border-t border-slate-200 bg-slate-950 p-3 font-mono text-xs">
        {output ? (
          <>
            {output.stdout && <pre className="whitespace-pre-wrap text-slate-100">{output.stdout}</pre>}
            {output.stderr && <pre className="whitespace-pre-wrap text-red-400">{output.stderr}</pre>}
            {!output.stdout && !output.stderr && <span className="text-slate-500">(no output)</span>}
          </>
        ) : (
          <span className="text-slate-500">output appears here</span>
        )}
      </div>
    </div>
  )
}
