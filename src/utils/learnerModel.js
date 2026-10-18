// The learner model: per-concept mastery, forgetting, review schedule and
// misconceptions. The tutor grades each answer (correct / partial /
// incorrect); everything below turns those grades into numbers in code, so
// "how well do they know X" is computed rather than asserted by the model.

const DAY = 864e5

// Bayesian Knowledge Tracing: P(knows the concept), updated per graded answer.
// SLIP = knows it but answers wrong; GUESS = doesn't but answers right;
// LEARN = picks it up from the attempt itself.
const BKT = { init: 0.3, slip: 0.1, guess: 0.2, learn: 0.15 }

function bktUpdate(p, outcome) {
  const ifCorrect = (p * (1 - BKT.slip)) / (p * (1 - BKT.slip) + (1 - p) * BKT.guess)
  const ifWrong = (p * BKT.slip) / (p * BKT.slip + (1 - p) * (1 - BKT.guess))
  const posterior = outcome === 'correct' ? ifCorrect : outcome === 'incorrect' ? ifWrong : (ifCorrect + ifWrong) / 2
  return posterior + (1 - posterior) * BKT.learn
}

// Forgetting curve. Stability S (days) is how long until recall drops to
// 90%; recall after t days is (1 + t / 9S)^-1 — the FSRS power curve.
export function recallProbability(record, now = Date.now()) {
  if (!record?.lastPracticed || !record.stability) return null
  const days = Math.max(0, (now - Date.parse(record.lastPracticed)) / DAY)
  return 1 / (1 + days / (9 * record.stability))
}

// Stability grows when a correct answer comes after real time has passed,
// so five right answers in one sitting don't schedule the next review months
// away. Wrong answers shrink it.
function nextStability(record, outcome, now) {
  const S = record.stability
  if (!S) return outcome === 'correct' ? 1 : outcome === 'partial' ? 0.5 : 0.25
  const elapsed = Math.max(0, (now - Date.parse(record.lastPracticed)) / DAY)
  const spacing = Math.min(1, elapsed / S)
  // Recalling it after a gap shows it lasts at least that long.
  if (outcome === 'correct') return Math.max(S * (1 + 1.5 * spacing), elapsed)
  if (outcome === 'partial') return S * (1 + 0.3 * spacing)
  return Math.max(0.25, S * 0.5)
}

const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// A fresh record for a concept the learner model hasn't seen yet.
export function newConceptRecord(concept = {}) {
  return {
    title: concept.title ?? concept.id,
    summary: concept.summary ?? null,
    status: concept.status && concept.status !== 'current' ? concept.status : 'needs-review',
    notes: [],
    requires: concept.requires ?? [],
    updatedAt: new Date().toISOString(),
  }
}

// assessment: { concept_id, outcome: 'correct'|'partial'|'incorrect',
//               misconception?: string, resolves_misconception?: string }
export function applyAssessment(record, assessment, now = Date.now()) {
  const outcome = ['correct', 'partial', 'incorrect'].includes(assessment.outcome) ? assessment.outcome : null
  if (!outcome) return record
  const iso = new Date(now).toISOString()
  // A concept consolidated before mastery tracking existed starts higher.
  const prior = record.mastery ?? (record.status === 'consolidated' ? 0.6 : BKT.init)
  const stability = nextStability(record, outcome, now)

  let misconceptions = [...(record.misconceptions || [])]
  if (typeof assessment.misconception === 'string' && assessment.misconception.trim()) {
    const text = assessment.misconception.trim().slice(0, 160)
    const hit = misconceptions.find((m) => sameText(m.text, text))
    misconceptions = hit
      ? misconceptions.map((m) => (m === hit ? { ...m, count: m.count + 1, lastSeen: iso } : m))
      : [{ text, count: 1, firstSeen: iso, lastSeen: iso }, ...misconceptions].slice(0, 5)
  }
  if (outcome === 'correct' && typeof assessment.resolves_misconception === 'string') {
    const gone = assessment.resolves_misconception.trim().toLowerCase()
    misconceptions = misconceptions.filter((m) => !m.text.toLowerCase().includes(gone) && !gone.includes(m.text.toLowerCase()))
  }

  return {
    ...record,
    mastery: bktUpdate(prior, outcome),
    stability,
    lastPracticed: iso,
    dueAt: new Date(now + stability * DAY).toISOString(),
    attempts: (record.attempts || 0) + 1,
    correct: (record.correct || 0) + (outcome === 'correct' ? 1 : 0),
    misconceptions,
    updatedAt: iso,
  }
}

// Concepts the learner opted to keep reviewing whose review date has passed.
export function dueConcepts(concepts, now = Date.now()) {
  return Object.entries(concepts)
    .filter(([, c]) => c.review && c.dueAt && Date.parse(c.dueAt) <= now)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
}
