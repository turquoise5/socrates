// Username + password accounts with server-side sessions. The cookie holds a
// random token; the server stores only its hash, so logging out (or deleting
// the row) ends the session everywhere immediately.
import crypto from 'crypto'

const COOKIE = 'socrates_session'
const DAY = 864e5
// "Remember me" keeps a session for 30 days. Otherwise the cookie dies with
// the browser, and the server forgets the session after a day of inactivity.
const REMEMBER_MS = 30 * DAY
const IDLE_MS = DAY

// Leading underscore stays reserved for server files in data/.
export const validUser = (user) => /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(user || '')

export function createAuth(db) {
  const hashPassword = (password, salt) =>
    new Promise((resolve, reject) =>
      crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))))
    )
  const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
  const safeEqual = (a, b) =>
    a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  const signupOpen = () => userCount() === 0 || process.env.ALLOW_SIGNUP === 'true'

  function startSession(res, user, remember) {
    const token = crypto.randomBytes(32).toString('base64url')
    db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now())
    db.prepare('INSERT INTO auth_sessions (token_hash, username, remember, expires_at) VALUES (?, ?, ?, ?)').run(
      sha256(token),
      user,
      remember ? 1 : 0,
      Date.now() + (remember ? REMEMBER_MS : IDLE_MS)
    )
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      ...(remember ? { maxAge: REMEMBER_MS } : {}), // no maxAge → ends with the browser
    })
  }

  function sessionUser(req) {
    const token = parseCookies(req.get('cookie'))[COOKIE]
    if (!token) return null
    const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(sha256(token))
    if (!row || row.expires_at < Date.now()) return null
    if (!row.remember) {
      // Sliding idle timeout for browser-session logins.
      db.prepare('UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() + IDLE_MS, row.token_hash)
    }
    return row.username
  }

  const fail = (res, status, message) => res.status(status).json({ error: { message } })

  function credentials(req) {
    return {
      user: String(req.body?.username || '').trim().toLowerCase(),
      password: String(req.body?.password || ''),
      remember: req.body?.remember === true,
    }
  }

  async function signup(req, res) {
    const { user, password, remember } = credentials(req)
    if (!validUser(user)) return fail(res, 400, 'Username: 1–32 letters, numbers, dashes or underscores.')
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.')
    // The first account can always be created; after that only if allowed.
    if (!signupOpen()) return fail(res, 403, 'Sign-ups are closed on this server.')
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(user)) return fail(res, 409, 'That username is taken.')
    const salt = crypto.randomBytes(16).toString('hex')
    db.prepare('INSERT INTO users (username, salt, hash, created_at) VALUES (?, ?, ?, ?)').run(
      user,
      salt,
      await hashPassword(password, salt),
      new Date().toISOString()
    )
    startSession(res, user, remember)
    res.json({ user })
  }

  async function login(req, res) {
    const { user, password, remember } = credentials(req)
    const account = db.prepare('SELECT * FROM users WHERE username = ?').get(user)
    // Hash even for unknown users so response time doesn't reveal which exist.
    const hash = await hashPassword(password, account?.salt || 'x')
    if (!account || !safeEqual(hash, account.hash)) return fail(res, 401, 'Wrong username or password.')
    startSession(res, user, remember)
    res.json({ user })
  }

  function logout(req, res) {
    const token = parseCookies(req.get('cookie'))[COOKIE]
    if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha256(token))
    res.clearCookie(COOKIE)
    res.json({ ok: true })
  }

  function me(req, res) {
    res.json({ user: sessionUser(req), firstRun: userCount() === 0, signupOpen: signupOpen() })
  }

  // Middleware: rejects the request unless it carries a live session.
  function requireUser(req, res, next) {
    const user = sessionUser(req)
    if (!user) return fail(res, 401, 'Not signed in.')
    req.user = user
    next()
  }

  return { signup, login, logout, me, requireUser }
}

function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}
