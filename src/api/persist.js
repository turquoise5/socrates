// Server-side state for the signed-in user (identified by session cookie):
// { knowledgeGraph: {concepts, sessions}, pendingMemory, profile, activeSession }
export async function loadUserState() {
  const res = await fetch('/api/state')
  if (!res.ok) throw new Error(`could not load state (${res.status})`)
  return res.json()
}

const timers = {}
async function put(url, body) {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.warn(`save to ${url} failed (${res.status})`)
  } catch (err) {
    console.warn(`save to ${url} failed:`, err)
  }
}
// Debounced per URL so rapid changes coalesce into one write.
function debouncedPut(url, body, immediate) {
  clearTimeout(timers[url])
  if (immediate) return put(url, body)
  timers[url] = setTimeout(() => put(url, body), 800)
}

// The in-flight lesson (null when none), so a reload resumes mid-lesson.
export const saveActiveSession = (activeSession, { immediate = false } = {}) =>
  debouncedPut('/api/state/active', { activeSession }, immediate)

// The learner model: concepts, "test me later" items, profile.
export const saveKnowledge = ({ concepts, pendingMemory, profile }) =>
  debouncedPut('/api/knowledge', { concepts, pendingMemory, profile })

// Archive one finished lesson (notebook).
export const saveLesson = (entry) => put(`/api/lessons/${encodeURIComponent(entry.id)}`, entry)

export async function fetchSession() {
  const res = await fetch('/api/auth/me')
  return res.json() // { user: string | null, signupOpen: boolean }
}

export async function authenticate(mode, username, password, remember) {
  const res = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, remember }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `sign-in failed (${res.status})`)
  return data.user
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
}
