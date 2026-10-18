import { TUTOR_SYSTEM_PROMPT } from '../prompts/tutor'
import { CONCEPT_MAP_PROMPT } from '../prompts/conceptMap'
import { PROFILE_PROMPT } from '../prompts/profile'
import { buildLearnerContext, conceptIndex } from '../utils/learnerContext'

async function callAnthropic({ system, messages, use_tools = true }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages, use_tools }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `API error (${res.status})`)
  }
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

// Model output should be bare JSON but may arrive fenced or with prose (or
// tool-use narration) around it — collect every top-level balanced object,
// return the LAST one that parses. The beat is always the final JSON emitted.
export function extractJson(text) {
  let last = null
  let i = 0
  while (i < text.length) {
    if (text[i] !== '{') {
      i++
      continue
    }
    const start = i
    let depth = 0
    let inStr = false
    let end = -1
    for (let j = start; j < text.length; j++) {
      const ch = text[j]
      if (inStr) {
        if (ch === '\\') j++
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end === -1) break
    try {
      last = JSON.parse(text.slice(start, end + 1))
      i = end + 1
    } catch {
      i = start + 1
    }
  }
  if (last === null) throw new Error('no JSON in model response')
  return last
}

// knownConcepts: the learner's existing concepts, so the map reuses their ids.
export async function fetchConceptMap(source, knownConcepts = {}) {
  const index = conceptIndex(knownConcepts)
  const content = index.length
    ? `${source}\n\nCONCEPTS ALREADY IN THE LEARNER'S RECORD (id | title | status) — reuse these ids for the same ideas:\n${index.join('\n')}`
    : source
  const text = await callAnthropic({
    system: CONCEPT_MAP_PROMPT,
    messages: [{ role: 'user', content }],
    use_tools: false,
  })
  const parsed = extractJson(text)
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
    throw new Error('concept extraction returned no concepts')
  }
  return parsed
}

const clip = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + ' …[truncated]' : s)

function serializeBeat(beat, isRecent) {
  return {
    beat_type: beat.beat_type,
    concept_id: beat.concept_id,
    // Older beats go up truncated — they establish where the lesson has been,
    // not its full text. Keeps input tokens (and latency) down.
    content: clip(beat.content, isRecent ? 4000 : 700),
    ...(beat.question ? { question: clip(beat.question, 300) } : {}),
    ...(beat.check_format ? { check_format: beat.check_format } : {}),
    ...(beat.exercise_target ? { exercise_target: beat.exercise_target } : {}),
    student_response: beat.studentResponse
      ? {
          kind: beat.studentResponse.kind,
          text: clip(beat.studentResponse.text ?? null, isRecent ? 4000 : 500),
          ...(beat.studentResponse.codeOutput ? { output: beat.studentResponse.codeOutput } : {}),
          ...(beat.studentResponse.elementSummary ? { whiteboard_elements: beat.studentResponse.elementSummary } : {}),
        }
      : null,
  }
}

function buildSessionStatePayload(state) {
  return {
    conceptMap: state.conceptMap.map(({ id, title, summary, status, requires, notes }) => ({
      id,
      title,
      summary,
      status,
      ...(requires?.length ? { requires } : {}),
      ...(notes?.length ? { notes } : {}),
    })),
    currentConceptId: state.currentConceptId,
    beatHistory: state.beats.slice(-15).map((b, i, arr) => serializeBeat(b, i >= arr.length - 4)),
    sourceChunks: state.sourceChunks.slice(0, 8),
    sourcePageCount: state.sourcePages?.length ?? 0,
    pace: state.pace ?? 'balanced',
    focus: state.focus || null,
    project: state.project
      ? {
          brief: state.project.brief,
          milestones: state.project.milestones,
          declined: state.project.declined,
          code: clip(state.project.code, 3000),
        }
      : null,
    mode: state.mode,
    learner: buildLearnerContext(state),
    tangentReturnPoint: state.tangentReturnPoint,
    beatCountOnCurrentConcept: state.beatCountOnCurrentConcept,
  }
}

// event: { kind: 'session_start' | 'answer' | 'check_answer' | 'whiteboard' |
//          'code' | 'notes' | 'consolidate_summary' | 'jump' | 'question',
//          text?, image? (base64 png), elementSummary?, codeOutput?, conceptId? }
export async function fetchNextBeat(state, event) {
  const payload = buildSessionStatePayload(state)
  const parts = [
    {
      type: 'text',
      text:
        `SESSION STATE:\n${JSON.stringify(payload, null, 1)}\n\n` +
        `STUDENT'S LATEST ACTION:\n${JSON.stringify({ ...event, image: event.image ? '(attached below)' : undefined }, null, 1)}\n\n` +
        `Emit the next beat.`,
    },
  ]
  if (event.image) {
    parts.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: event.image },
    })
  }
  const text = await callAnthropic({
    system: TUTOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: parts }],
  })
  const tryParse = (t) => {
    try {
      const b = extractJson(t)
      return b.beat_type && b.content ? b : null
    } catch {
      return null
    }
  }
  let beat = tryParse(text)
  if (!beat) {
    // The model occasionally replies with prose (usually after quoting the
    // source). One corrective retry before surfacing an error.
    const retryText = await callAnthropic({
      system: TUTOR_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: parts },
        { role: 'assistant', content: text?.trim() || '(empty)' },
        {
          role: 'user',
          content:
            'That reply was not a valid beat. Respond again with ONLY the JSON beat object — beat_type and content are required, no prose outside the JSON, no cite tags.',
        },
      ],
      use_tools: false,
    })
    beat = tryParse(retryText)
  }
  if (!beat) throw new Error('model returned an invalid beat')
  return beat
}

// Rewrites the short learner profile from what happened in a finished lesson.
export async function fetchProfileUpdate({ profile, title, conceptMap, knowledgeGraph, pace, focus }) {
  const lesson = {
    title,
    pace,
    focus: focus || null,
    concepts: conceptMap.map((c) => {
      const r = knowledgeGraph.concepts[c.id] || {}
      return {
        title: c.title,
        status: c.status,
        ...(r.attempts ? { answers: `${r.correct || 0}/${r.attempts} correct` } : {}),
        ...(r.misconceptions?.length ? { misconceptions: r.misconceptions.map((m) => m.text) } : {}),
        ...(c.notes?.length ? { notes: c.notes } : {}),
      }
    }),
  }
  const text = await callAnthropic({
    system: PROFILE_PROMPT,
    messages: [
      {
        role: 'user',
        content: `CURRENT PROFILE:\n${profile || '(none yet)'}\n\nLESSON JUST FINISHED:\n${JSON.stringify(lesson, null, 1)}`,
      },
    ],
    use_tools: false,
  })
  const parsed = extractJson(text)
  return typeof parsed.profile === 'string' ? parsed.profile.trim().slice(0, 1200) : profile
}
