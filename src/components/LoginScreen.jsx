import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { authenticate } from '../api/persist'

export default function LoginScreen({ firstRun, signupOpen, onLogin }) {
  const [mode, setMode] = useState(firstRun ? 'signup' : 'login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [status, setStatus] = useState(null) // null | 'working' | error string
  const validName = /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(name)
  const validPassword = mode === 'login' ? password.length > 0 : password.length >= 8
  const canSubmit = validName && validPassword && status !== 'working'

  const submit = async () => {
    if (!canSubmit) return
    setStatus('working')
    try {
      onLogin(await authenticate(mode, name, password, remember))
    } catch (err) {
      setStatus(err.message)
    }
  }

  const onKeyDown = (e) => e.key === 'Enter' && submit()
  const inputClass =
    'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500'

  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-6">
        <div className="mb-1 flex items-center gap-2 text-slate-900">
          <BookOpen size={22} />
          <h1 className="text-xl font-semibold">Socrates</h1>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          {firstRun
            ? 'Create the first account on this server.'
            : 'Your progress, notes, and knowledge record are saved to your account.'}
        </p>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className={labelClass}>Username</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.trim())}
            onKeyDown={onKeyDown}
            placeholder="letters, numbers, - _"
            autoComplete="username"
            autoFocus
            className={inputClass}
          />
          {name && !validName && (
            <p className="mt-1.5 text-xs text-red-600">
              1–32 characters: letters, numbers, dashes, underscores; start with a letter or number.
            </p>
          )}
          <label className={`${labelClass} mt-3`}>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            type="password"
            placeholder={mode === 'signup' ? 'at least 8 characters' : ''}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className={inputClass}
          />
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Keep me signed in for 30 days
          </label>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-4 w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {status === 'working' ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          {status && status !== 'working' && <p className="mt-2 text-xs text-red-600">{status}</p>}
          {signupOpen && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {mode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setStatus(null)
                }}
                className="underline hover:text-slate-700"
              >
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
