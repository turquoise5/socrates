// Chooses what the learner's history contributes to each tutor request.
// Concept ids are canonical and reused across lessons, so relevance is a walk
// over the prerequisite graph rather than a similarity search:
//   1. a one-line index of every known concept (so ids get reused),
//   2. full detail for the current lesson's neighbourhood (prerequisites and
//      dependents up to two steps away),
//   3. past lessons that touched that neighbourhood, as title + date only.
// Transcripts never go to the model; they stay in the notebook archive.
import { recallProbability } from './learnerModel'

const INDEX_LIMIT = 300
const HOPS = 2
const round = (x) => (x == null ? null : Math.round(x * 100) / 100)
const day = (iso) => (iso ? iso.slice(0, 10) : null)

// Compact list of known concepts, most recently touched first.
export function conceptIndex(concepts, exclude = new Set()) {
  return Object.entries(concepts)
    .filter(([id]) => !exclude.has(id))
    .sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''))
    .slice(0, INDEX_LIMIT)
    .map(([id, c]) => `${id} | ${c.title} | ${c.status}${c.mastery != null ? ` | mastery ${round(c.mastery)}` : ''}`)
}

function neighbourhood(concepts, conceptMap) {
  const edges = new Map() // undirected adjacency over requires-edges
  const link = (a, b) => {
    if (!edges.has(a)) edges.set(a, new Set())
    if (!edges.has(b)) edges.set(b, new Set())
    edges.get(a).add(b)
    edges.get(b).add(a)
  }
  for (const [id, c] of Object.entries(concepts)) for (const r of c.requires || []) link(id, r)
  for (const c of conceptMap) for (const r of c.requires || []) link(c.id, r)

  const seen = new Set(conceptMap.map((c) => c.id))
  let frontier = [...seen]
  for (let hop = 0; hop < HOPS; hop++) {
    const next = []
    for (const id of frontier) for (const n of edges.get(id) || []) if (!seen.has(n)) seen.add(n), next.push(n)
    frontier = next
  }
  return seen
}

export function buildLearnerContext({ knowledgeGraph, conceptMap, pendingMemory, profile }, now = Date.now()) {
  const { concepts, sessions } = knowledgeGraph
  const near = neighbourhood(concepts, conceptMap)
  const detailIds = [...near].filter((id) => concepts[id])

  const related = detailIds.map((id) => {
    const c = concepts[id]
    return {
      id,
      title: c.title,
      status: c.status,
      ...(c.summary ? { student_summary: c.summary } : {}),
      ...(c.notes?.length ? { notes: c.notes.slice(0, 3) } : {}),
      ...(c.mastery != null
        ? {
            mastery: round(c.mastery),
            recall_now: round(c.mastery * (recallProbability(c, now) ?? 1)),
            last_practiced: day(c.lastPracticed),
          }
        : {}),
      ...(c.misconceptions?.length ? { misconceptions: c.misconceptions.map((m) => m.text) } : {}),
      ...(c.review ? { in_review: true } : {}),
    }
  })

  return {
    profile: profile || null,
    relatedConcepts: related,
    dueForReview: detailIds.filter((id) => concepts[id].review && concepts[id].dueAt && Date.parse(concepts[id].dueAt) <= now),
    pastLessons: sessions
      .filter((s) => (s.conceptIds || []).some((id) => near.has(id)))
      .slice(-5)
      .map((s) => ({ title: s.title, date: day(s.endedAt) })),
    otherKnownConcepts: conceptIndex(concepts, near),
    pendingMemory,
  }
}
