// All server state in one SQLite file (data/socrates.db) via Node's built-in
// node:sqlite — no extra dependency, no database server to run.
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'socrates.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      username   TEXT PRIMARY KEY,
      salt       TEXT NOT NULL,
      hash       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      username   TEXT NOT NULL,
      remember   INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    -- One row per learner: profile paragraph, "test me later" items, and the
    -- in-flight lesson snapshot (so a reload resumes mid-lesson).
    CREATE TABLE IF NOT EXISTS learners (
      username       TEXT PRIMARY KEY,
      profile        TEXT NOT NULL DEFAULT '',
      pending_memory TEXT NOT NULL DEFAULT '[]',
      active_session TEXT,
      updated_at     TEXT
    );
    -- The learner model, one row per concept. review/due_at are lifted out of
    -- the JSON so "what's due" is a plain query.
    CREATE TABLE IF NOT EXISTS concepts (
      username TEXT NOT NULL,
      id       TEXT NOT NULL,
      data     TEXT NOT NULL,
      review   INTEGER NOT NULL DEFAULT 0,
      due_at   TEXT,
      PRIMARY KEY (username, id)
    );
    -- Archived lessons (notebooks): transcript, notes, resume snapshot.
    CREATE TABLE IF NOT EXISTS lessons (
      username TEXT NOT NULL,
      id       TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      data     TEXT NOT NULL,
      PRIMARY KEY (username, id)
    );
  `)
  migrateJsonFiles(db, dataDir)
  return db
}

const json = (s, fallback) => {
  try {
    return s == null ? fallback : JSON.parse(s)
  } catch {
    return fallback
  }
}

export function loadLearner(db, user) {
  const row = db.prepare('SELECT * FROM learners WHERE username = ?').get(user)
  const concepts = {}
  for (const r of db.prepare('SELECT id, data FROM concepts WHERE username = ?').all(user)) {
    concepts[r.id] = json(r.data, {})
  }
  const sessions = db
    .prepare('SELECT data FROM lessons WHERE username = ? ORDER BY ended_at')
    .all(user)
    .map((r) => json(r.data, null))
    .filter(Boolean)
  return {
    knowledgeGraph: { concepts, sessions },
    pendingMemory: json(row?.pending_memory, []),
    profile: row?.profile ?? '',
    activeSession: json(row?.active_session, null),
  }
}

function upsertLearner(db, user, fields) {
  db.prepare('INSERT OR IGNORE INTO learners (username) VALUES (?)').run(user)
  const cols = Object.keys(fields)
  db.prepare(
    `UPDATE learners SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE username = ?`
  ).run(...cols.map((c) => fields[c]), new Date().toISOString(), user)
}

export function saveActiveSession(db, user, activeSession) {
  upsertLearner(db, user, { active_session: activeSession ? JSON.stringify(activeSession) : null })
}

// Replaces the learner's whole concept record. It holds no transcripts, so
// it stays small even after many lessons.
export function saveKnowledge(db, user, { concepts = {}, pendingMemory = [], profile = '' }) {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM concepts WHERE username = ?').run(user)
    const insert = db.prepare('INSERT INTO concepts (username, id, data, review, due_at) VALUES (?, ?, ?, ?, ?)')
    for (const [id, c] of Object.entries(concepts)) {
      insert.run(user, id, JSON.stringify(c), c.review ? 1 : 0, c.dueAt ?? null)
    }
    upsertLearner(db, user, { pending_memory: JSON.stringify(pendingMemory), profile: String(profile) })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function saveLesson(db, user, lesson) {
  db.prepare(
    `INSERT INTO lessons (username, id, ended_at, data) VALUES (?, ?, ?, ?)
     ON CONFLICT (username, id) DO UPDATE SET ended_at = excluded.ended_at, data = excluded.data`
  ).run(user, String(lesson.id), lesson.endedAt || new Date().toISOString(), JSON.stringify(lesson))
}

// One-time import of the earlier JSON-file storage (data/_users.json and
// data/<username>.json). Imported files move to data/_legacy/.
function migrateJsonFiles(db, dataDir) {
  const legacy = path.join(dataDir, '_legacy')
  const moveAside = (file) => {
    fs.mkdirSync(legacy, { recursive: true })
    fs.renameSync(path.join(dataDir, file), path.join(legacy, file))
  }

  const usersFile = path.join(dataDir, '_users.json')
  if (fs.existsSync(usersFile)) {
    const users = json(fs.readFileSync(usersFile, 'utf8'), {})
    const insert = db.prepare('INSERT OR IGNORE INTO users (username, salt, hash, created_at) VALUES (?, ?, ?, ?)')
    for (const [name, u] of Object.entries(users)) insert.run(name, u.salt, u.hash, u.createdAt)
    moveAside('_users.json')
  }
  for (const f of ['_session_secret', '_access_requests.json']) {
    if (fs.existsSync(path.join(dataDir, f))) moveAside(f)
  }

  for (const file of fs.readdirSync(dataDir)) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue
    const user = file.slice(0, -5).toLowerCase()
    const saved = json(fs.readFileSync(path.join(dataDir, file), 'utf8'), null)
    if (saved) {
      const kg = saved.knowledgeGraph || {}
      saveKnowledge(db, user, { concepts: kg.concepts, pendingMemory: kg.pendingMemory, profile: '' })
      for (const lesson of kg.sessions || []) saveLesson(db, user, lesson)
      saveActiveSession(db, user, saved.activeSession ?? null)
    }
    moveAside(file)
    console.log(`Imported saved state for "${user}" into SQLite`)
  }
}
