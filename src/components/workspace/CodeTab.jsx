import { useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Send } from 'lucide-react'
import { runPython } from '../../utils/pyodideRunner'

const STARTER = '# Python runs in your browser (Pyodide).\n# Write your solution, Run, then Submit to tutor.\n'

export default function CodeTab({ onSubmit, disabled }) {
  const codeRef = useRef(STARTER)
  const [output, setOutput] = useState(null) // {stdout, stderr}
  const [running, setRunning] = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle')

  const run = async () => {
    setRunning(true)
    if (pyodideStatus === 'idle') setPyodideStatus('loading')
    try {
      const res = await runPython(codeRef.current)
      setPyodideStatus('ready')
      setOutput(res)
    } catch (err) {
      setOutput({ stdout: '', stderr: String(err) })
      setPyodideStatus('idle')
    } finally {
      setRunning(false)
    }
  }

  const submit = () => {
    const out = output
      ? [
          `--- stdout ---\n${output.stdout || '(empty)'}`,
          output.stderr ? `--- stderr ---\n${output.stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '(not run yet)'
    onSubmit({
      kind: 'code',
      text: codeRef.current,
      codeOutput: out,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Editor
          defaultLanguage="python"
          defaultValue={STARTER}
          onChange={(v) => { codeRef.current = v ?? '' }}
          options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
        />
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play size={13} /> {running ? (pyodideStatus === 'loading' ? 'Loading Python…' : 'Running…') : 'Run'}
        </button>
        <button
          onClick={submit}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Send size={13} /> Submit to tutor
        </button>
        {pyodideStatus === 'loading' && (
          <span className="text-xs text-slate-400">first run downloads the Python runtime (~10s)</span>
        )}
      </div>
      <div className="h-36 shrink-0 overflow-y-auto border-t border-slate-200 bg-slate-950 p-3 font-mono text-xs">
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
