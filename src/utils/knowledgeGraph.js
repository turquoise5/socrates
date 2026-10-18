import { newConceptRecord } from './learnerModel'

export const emptyKnowledgeGraph = () => ({ concepts: {}, sessions: [] })

// Fold a finished (or abandoned) session into the persistent graph:
// concept statuses, the student's own consolidation summaries, their
// notebook, a trimmed transcript. Nothing the student wrote is discarded at
// session end. Returns the new graph and the archived lesson entry.
export function recordSession(kg, { id, title, conceptMap, summaries, notes, beats, resume }) {
  const transcript = (beats || []).map((b) => ({
    type: b.beat_type,
    concept: b.concept_id,
    content: (b.content || '').slice(0, 2000),
    ...(b.question ? { question: b.question.slice(0, 500) } : {}),
    response: b.studentResponse
      ? { kind: b.studentResponse.kind, text: (b.studentResponse.text || '').slice(0, 2000) }
      : null,
  }))
  const entry = {
    id: id || `sess-${Date.now()}`,
    title,
    endedAt: new Date().toISOString(),
    conceptIds: conceptMap.map((c) => c.id),
    notes: notes || '',
    summaries: summaries || {},
    transcript,
    // Full snapshot so the notebook can be reopened like a chat. Source page
    // images are dropped to keep the archive small.
    resume: resume ? { ...resume, sourcePages: [] } : null,
  }
  const concepts = { ...kg.concepts }
  for (const c of conceptMap) {
    // Keep learner-model fields (mastery, schedule, misconceptions) the
    // lesson already wrote; refresh the descriptive ones.
    const prev = concepts[c.id] ?? newConceptRecord(c)
    concepts[c.id] = {
      ...prev,
      title: c.title,
      status: c.status === 'current' ? 'needs-review' : c.status,
      summary: summaries[c.id] ?? prev.summary ?? null,
      notes: c.notes?.length ? c.notes : prev.notes ?? [],
      requires: c.requires?.length ? c.requires : prev.requires ?? [],
      updatedAt: new Date().toISOString(),
    }
  }
  return {
    // Upsert by id: re-ending a resumed session updates its notebook
    // instead of duplicating it.
    kg: { concepts, sessions: [...kg.sessions.filter((s) => s.id !== entry.id), entry] },
    entry,
  }
}
