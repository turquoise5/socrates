import express from 'express'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createAuth } from './auth.js'
import { createLLM } from './llm.js'
import { openDb, loadLearner, saveActiveSession, saveKnowledge, saveLesson } from './db.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '25mb' }))

let llm
try {
  llm = createLLM()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

// ── Accounts ── /api/chat and /api/state require a signed-in user, so
// nobody can spend the API key or read saved state without an account.
const db = openDb(path.join(__dirname, 'data'))
const auth = createAuth(db)
app.post('/api/auth/signup', auth.signup)
app.post('/api/auth/login', auth.login)
app.post('/api/auth/logout', auth.logout)
app.get('/api/auth/me', auth.me)
app.use('/api/chat', auth.requireUser)
app.use('/api/state', auth.requireUser)
app.use('/api/knowledge', auth.requireUser)
app.use('/api/lessons', auth.requireUser)

app.post('/api/chat', async (req, res) => {
  const { system, messages, use_tools = true } = req.body
  try {
    const result = await llm.chat({ system, messages, useTools: use_tools })
    if (!result.ok) console.error('Model API error:', JSON.stringify(result.data))
    res.status(result.status).json(result.data)
  } catch (err) {
    console.error('Proxy error:', err)
    res.status(500).json({ error: { message: String(err) } })
  }
})

// ── Per-learner state (SQLite, see db.js) ──
const handle = (fn) => (req, res) => {
  try {
    res.json(fn(req) ?? { saved: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: { message: String(err) } })
  }
}
app.get('/api/state', handle((req) => loadLearner(db, req.user)))
app.put('/api/state/active', handle((req) => saveActiveSession(db, req.user, req.body?.activeSession ?? null)))
app.put('/api/knowledge', handle((req) => saveKnowledge(db, req.user, req.body || {})))
app.put('/api/lessons/:id', handle((req) => saveLesson(db, req.user, { ...req.body, id: req.params.id })))

// ── Production: serve the built client so one process hosts everything ──
const DIST = path.join(__dirname, 'dist')
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(DIST, 'index.html'))
    }
    next()
  })
}

// Dev: Vite owns 5173 and proxies /api here; never bind the injected PORT in
// dev (the preview harness sets PORT=5173 and the proxy would steal Vite's
// port). In production (no Vite), the host's PORT is the right one to bind.
const PORT =
  process.env.PROXY_PORT ||
  (existsSync(DIST) && process.env.NODE_ENV === 'production' ? process.env.PORT : null) ||
  3001
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT} (model: ${llm.label})`))
