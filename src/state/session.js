import { emptyKnowledgeGraph } from '../utils/knowledgeGraph'
import { applyAssessment, newConceptRecord } from '../utils/learnerModel'

let beatSeq = 0
export const nextBeatId = () => `beat-${++beatSeq}`
// After restoring a saved session, continue ids past the restored ones.
export const bumpBeatSeq = (n) => {
  beatSeq = Math.max(beatSeq, n)
}

// The persistent record (knowledge graph, memory items, profile) arrives
// from the server via HYDRATE after login.
export function initialState() {
  return {
    phase: 'start', // 'start' | 'extracting' | 'lesson'
    sessionId: null,
    title: null,
    project: null, // { brief, milestones: [{id,title,status}], code, declined }
    pace: 'balanced', // 'thorough' | 'balanced' | 'fast'
    focus: '', // "I want to focus on X"
    conceptMap: [], // [{id, title, summary, status}]
    currentConceptId: null,
    beats: [], // full render list; last 15 go to the API
    sourceChunks: [],
    sourcePages: [], // rendered PDF page images for source-page visuals
    mode: 'lesson', // 'lesson' | 'review' (spaced-review session)
    knowledgeGraph: emptyKnowledgeGraph(),
    pendingMemory: [],
    profile: '', // short paragraph about the learner, rewritten after each lesson
    tangentReturnPoint: null,
    beatCountOnCurrentConcept: 0,
    summaries: {}, // conceptId -> student's consolidation text
    notes: '', // the student's Notes tab (persisted with the session)
    loading: false,
    error: null,
    nudgeDismissed: false,
  }
}

const VALID_STATUS = ['upcoming', 'current', 'needs-review', 'consolidated']

export function reducer(state, action) {
  switch (action.type) {
    case 'EXTRACTING':
      return { ...state, phase: 'extracting', error: null }

    // Server-side state fetched after login (knowledge graph + memory).
    case 'HYDRATE':
      return {
        ...state,
        knowledgeGraph: action.knowledgeGraph ?? state.knowledgeGraph,
        pendingMemory: action.pendingMemory ?? state.pendingMemory,
        profile: action.profile ?? state.profile,
      }

    case 'SET_PROFILE':
      return { ...state, profile: action.profile }

    // Opt a concept in or out of spaced review. Opting in an unpractised
    // concept schedules its first review for tomorrow.
    case 'TOGGLE_REVIEW': {
      const prev = state.knowledgeGraph.concepts[action.concept.id] ?? newConceptRecord(action.concept)
      const review = !prev.review
      const dueAt = review && !prev.dueAt ? new Date(Date.now() + 864e5).toISOString() : prev.dueAt
      return {
        ...state,
        knowledgeGraph: {
          ...state.knowledgeGraph,
          concepts: { ...state.knowledgeGraph.concepts, [action.concept.id]: { ...prev, review, dueAt } },
        },
      }
    }

    // Restore an in-flight session snapshot (after reload / server restart).
    case 'RESUME_SESSION': {
      const s = action.session
      const maxId = Math.max(0, ...s.beats.map((b) => Number(String(b.id).replace('beat-', '')) || 0))
      bumpBeatSeq(maxId)
      return {
        ...state,
        phase: 'lesson',
        sessionId: s.sessionId || `sess-${Date.now()}`,
        mode: s.mode ?? 'lesson',
        project: s.project ?? null,
        pace: s.pace ?? 'balanced',
        focus: s.focus ?? '',
        title: s.title,
        conceptMap: s.conceptMap,
        currentConceptId: s.currentConceptId,
        beats: s.beats,
        sourceChunks: s.sourceChunks ?? [],
        sourcePages: s.sourcePages ?? [],
        summaries: s.summaries ?? {},
        notes: s.notes ?? '',
        beatCountOnCurrentConcept: s.beatCountOnCurrentConcept ?? 0,
        tangentReturnPoint: s.tangentReturnPoint ?? null,
        loading: false,
        error: null,
      }
    }

    case 'SET_NOTES':
      return { ...state, notes: action.notes }

    case 'TOGGLE_BEAT_EXPORT':
      return {
        ...state,
        beats: state.beats.map((b) => (b.id === action.beatId ? { ...b, excluded: !b.excluded } : b)),
      }

    case 'SET_PACE':
      return { ...state, pace: action.pace ?? state.pace, focus: action.focus ?? state.focus }

    case 'SET_PROJECT_CODE':
      return state.project ? { ...state, project: { ...state.project, code: action.code } } : state

    case 'DECLINE_PROJECT':
      return {
        ...state,
        project: { ...(state.project || { brief: '', milestones: [], code: '' }), declined: true },
      }

    case 'SESSION_START': {
      const { title, concepts, sourceChunks, sourcePages = [], sessionId, mode = 'lesson' } = action
      return {
        ...state,
        phase: 'lesson',
        sessionId: sessionId || `sess-${Date.now()}`,
        mode,
        project: null,
        title,
        conceptMap: concepts.map((c, i) => ({
          ...c,
          requires: Array.isArray(c.requires) ? c.requires : [],
          notes: [],
          status: i === 0 ? 'current' : 'upcoming',
        })),
        currentConceptId: concepts[0]?.id ?? null,
        sourceChunks,
        sourcePages,
        beats: [],
        summaries: {},
        beatCountOnCurrentConcept: 0,
        tangentReturnPoint: null,
        error: null,
      }
    }

    case 'LOADING':
      return { ...state, loading: action.value, error: action.value ? null : state.error }

    case 'ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
        // A failure during extraction sends the student back to the start screen.
        phase: state.phase === 'extracting' ? 'start' : state.phase,
      }

    case 'BEAT_RECEIVED': {
      const beat = { ...action.beat, id: nextBeatId(), studentResponse: null }
      let conceptMap = state.conceptMap
      // The map is richer than the lesson plan: tangents and discovered
      // prerequisites join it as nodes, wired to the concepts they unlock.
      if (Array.isArray(beat.concept_additions)) {
        for (const add of beat.concept_additions) {
          if (!add?.id || !add?.title) continue
          const dependents = Array.isArray(add.prerequisite_of) ? add.prerequisite_of : []
          const wireEdges = (map) =>
            map.map((c) =>
              dependents.includes(c.id) && !(c.requires || []).includes(add.id)
                ? { ...c, requires: [...(c.requires || []), add.id] }
                : c
            )
          const exists = conceptMap.some(
            (c) => c.id === add.id || c.title.toLowerCase() === String(add.title).toLowerCase()
          )
          if (exists) {
            conceptMap = wireEdges(conceptMap)
            continue
          }
          const node = {
            id: add.id,
            title: add.title,
            summary: add.summary || '',
            requires: (Array.isArray(add.requires) ? add.requires : []).filter((r) =>
              conceptMap.some((c) => c.id === r)
            ),
            notes: [],
            // 'current' is managed by the concept_id switch below, never here
            status:
              VALID_STATUS.includes(add.status) && add.status !== 'current' ? add.status : 'needs-review',
          }
          // Insert before the first concept that depends on it, keeping the
          // rail roughly topological.
          const depIdx = conceptMap.findIndex((c) => dependents.includes(c.id))
          const at = depIdx === -1 ? conceptMap.length : depIdx
          conceptMap = wireEdges([...conceptMap.slice(0, at), node, ...conceptMap.slice(at)])
        }
      }
      const updates = Array.isArray(beat.concept_status_updates) ? beat.concept_status_updates : []
      if (updates.length) {
        conceptMap = conceptMap.map((c) => {
          const u = updates.find((x) => x.id === c.id && VALID_STATUS.includes(x.status))
          return u ? { ...c, status: u.status } : c
        })
      }
      // Evidence notes ("confuses X with Y") shown under concepts in the map.
      if (Array.isArray(beat.concept_notes)) {
        conceptMap = conceptMap.map((c) => {
          const fresh = beat.concept_notes
            .filter((n) => n && n.id === c.id && typeof n.note === 'string')
            .map((n) => n.note.slice(0, 140))
          return fresh.length
            ? { ...c, notes: [...fresh, ...(c.notes || [])].slice(0, 3) }
            : c
        })
      }
      const known = conceptMap.some((c) => c.id === beat.concept_id)
      const conceptId = known ? beat.concept_id : state.currentConceptId
      // Keep exactly one concept current.
      if (known && conceptId !== state.currentConceptId) {
        conceptMap = conceptMap.map((c) => {
          if (c.id === conceptId) return { ...c, status: 'current' }
          if (c.status === 'current') return { ...c, status: 'needs-review' }
          return c
        })
      }
      // Graded answers update the persistent learner model as they happen.
      let knowledgeGraph = state.knowledgeGraph
      const assessments = [beat.answer_assessment].flat().filter((a) => a && a.concept_id)
      for (const a of assessments) {
        const concept = conceptMap.find((c) => c.id === a.concept_id)
        const prev = knowledgeGraph.concepts[a.concept_id] ?? (concept ? newConceptRecord(concept) : null)
        if (!prev) continue
        knowledgeGraph = {
          ...knowledgeGraph,
          concepts: { ...knowledgeGraph.concepts, [a.concept_id]: applyAssessment(prev, a) },
        }
      }
      // The tutor can mark a "test me later" item as tested via an optional
      // memory_item_addressed field on the beat.
      const pendingMemory = beat.memory_item_addressed
        ? state.pendingMemory.filter((m) => m.id !== beat.memory_item_addressed)
        : state.pendingMemory
      // Project proposals and milestone updates ride on beats.
      let project = state.project
      if (beat.project_update && typeof beat.project_update === 'object') {
        const pu = beat.project_update
        project = {
          brief: typeof pu.brief === 'string' ? pu.brief : project?.brief ?? '',
          milestones: Array.isArray(pu.milestones)
            ? pu.milestones
                .filter((m) => m && m.id && m.title)
                .map((m) => ({ id: m.id, title: m.title, status: m.status === 'done' ? 'done' : 'todo' }))
            : project?.milestones ?? [],
          // starter code only seeds an empty buffer — never clobbers student work
          code: project?.code || (typeof pu.starter_code === 'string' ? pu.starter_code : ''),
          declined: project?.declined ?? false,
        }
      }
      return {
        ...state,
        beats: [...state.beats, beat],
        project,
        conceptMap,
        knowledgeGraph,
        pendingMemory,
        currentConceptId: conceptId,
        beatCountOnCurrentConcept:
          conceptId === state.currentConceptId ? state.beatCountOnCurrentConcept + 1 : 1,
        tangentReturnPoint:
          beat.beat_type === 'tangent'
            ? beat.tangent_return_point ?? state.tangentReturnPoint
            : beat.tangent_return_point ?? null,
        loading: false,
        error: null,
      }
    }

    case 'STUDENT_RESPONSE': {
      const beats = state.beats.map((b) =>
        b.id === action.beatId ? { ...b, studentResponse: action.response } : b
      )
      const summaries =
        action.response.kind === 'consolidate_summary' && action.conceptId
          ? { ...state.summaries, [action.conceptId]: action.response.text }
          : state.summaries
      return { ...state, beats, summaries }
    }

    case 'ADD_MEMORY':
      return {
        ...state,
        pendingMemory: [
          ...state.pendingMemory,
          { id: `mem-${Date.now()}`, text: action.text, createdAt: new Date().toISOString() },
        ],
      }

    case 'REMOVE_MEMORY':
      return { ...state, pendingMemory: state.pendingMemory.filter((m) => m.id !== action.id) }

    case 'DISMISS_NUDGE':
      return { ...state, nudgeDismissed: true }

    case 'END_SESSION':
      return {
        ...initialState(),
        knowledgeGraph: action.knowledgeGraph,
        pendingMemory: state.pendingMemory,
        profile: state.profile,
        nudgeDismissed: state.nudgeDismissed,
      }

    default:
      return state
  }
}
