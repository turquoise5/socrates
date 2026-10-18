import { useEffect, useReducer, useRef, useState } from 'react'
import { initialState, reducer } from './state/session'
import { fetchConceptMap, fetchNextBeat, fetchProfileUpdate } from './api/client'
import { fetchSession, loadUserState, logout, saveActiveSession, saveKnowledge, saveLesson } from './api/persist'
import { extractText, chunkText } from './utils/extractText'
import { downloadMarkdown } from './utils/exportSession'
import { recordSession } from './utils/knowledgeGraph'
import { dueConcepts } from './utils/learnerModel'
import LoginScreen from './components/LoginScreen'
import StartScreen from './components/StartScreen'
import ProgressRail from './components/ProgressRail'
import ConceptMapView from './components/ConceptMapView'
import LessonPanel from './components/LessonPanel'
import WorkspacePanel from './components/workspace/WorkspacePanel'
import ErrorBoundary from './components/ErrorBoundary'

// Snapshot of the in-flight lesson for the server (null outside a lesson).
// Whiteboard images are dropped to keep it small.
function buildActiveSession(state) {
  return state.phase === 'lesson'
        ? {
            sessionId: state.sessionId,
            mode: state.mode,
            project: state.project,
            title: state.title,
            conceptMap: state.conceptMap,
            currentConceptId: state.currentConceptId,
            beats: state.beats.map((b) =>
              b.studentResponse?.image
                ? { ...b, studentResponse: { ...b.studentResponse, image: null } }
                : b
            ),
            sourceChunks: state.sourceChunks,
            sourcePages: state.sourcePages,
            summaries: state.summaries,
            notes: state.notes,
            beatCountOnCurrentConcept: state.beatCountOnCurrentConcept,
            tangentReturnPoint: state.tangentReturnPoint,
          }
        : null
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const lastCallRef = useRef(null) // {state, event} for retry

  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null) // /api/auth/me result; null while checking
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [freeSkip, setFreeSkipState] = useState(() => localStorage.getItem('socrates_free_skip') === '1')
  const setFreeSkip = (v) => {
    localStorage.setItem('socrates_free_skip', v ? '1' : '0')
    setFreeSkipState(v)
  }

  useEffect(() => {
    fetchSession()
      .then((s) => {
        setSession(s)
        setUser(s.user)
      })
      .catch(() => setSession({ user: null, signupOpen: false }))
  }, [])

  // On login: pull this user's state from the server, seed the local cache,
  // and resume any in-flight session (survives reloads and server restarts).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadUserState()
      .then((saved) => {
        if (cancelled) return
        dispatch({
          type: 'HYDRATE',
          knowledgeGraph: {
            concepts: saved?.knowledgeGraph?.concepts || {},
            sessions: saved?.knowledgeGraph?.sessions || [],
          },
          pendingMemory: saved?.pendingMemory || [],
          profile: saved?.profile || '',
        })
        if (saved?.activeSession?.beats?.length) {
          dispatch({ type: 'RESUME_SESSION', session: saved.activeSession })
        }
        setHydrated(true)
      })
      // Never mark hydrated on failure: saving an empty record would
      // overwrite the real one on the server.
      .catch((err) => !cancelled && setLoadError(err.message))
    return () => {
      cancelled = true
    }
  }, [user])

  // Debounced server-side saves: the in-flight lesson, and the learner model
  // (which changes as answers are graded, not just at lesson end).
  useEffect(() => {
    if (!user || !hydrated) return
    saveActiveSession(buildActiveSession(state))
  }, [user, hydrated, state.beats, state.conceptMap, state.notes, state.summaries, state.phase])
  useEffect(() => {
    if (!user || !hydrated) return
    saveKnowledge({
      concepts: state.knowledgeGraph.concepts,
      pendingMemory: state.pendingMemory,
      profile: state.profile,
    })
  }, [user, hydrated, state.knowledgeGraph.concepts, state.pendingMemory, state.profile])

  async function sendEvent(baseState, event) {
    lastCallRef.current = { state: baseState, event }
    dispatch({ type: 'LOADING', value: true })
    try {
      const beat = await fetchNextBeat(baseState, event)
      dispatch({ type: 'BEAT_RECEIVED', beat })
    } catch (err) {
      dispatch({ type: 'ERROR', error: `Tutor call failed: ${err.message}` })
    }
  }

  // Apply an action and get the resulting state synchronously, so the API
  // payload can include what was just dispatched (reducer is pure).
  function apply(action) {
    const next = reducer(stateRef.current, action)
    stateRef.current = next
    dispatch(action)
    return next
  }

  async function handleStart({ topic, file }) {
    dispatch({ type: 'EXTRACTING' })
    try {
      let source, chunks, pages
      if (file) {
        const extracted = await extractText(file)
        if (!extracted.text.trim()) throw new Error('could not extract any text from that file')
        chunks = chunkText(extracted.text)
        pages = extracted.pages
        source = `SOURCE MATERIAL (${file.name}):\n\n${extracted.text.slice(0, 40000)}`
      } else {
        chunks = []
        pages = []
        source = `TOPIC (no source document — use the standard material for this topic at full depth): ${topic}`
      }
      const map = await fetchConceptMap(source, stateRef.current.knowledgeGraph.concepts)
      const next = apply({
        type: 'SESSION_START',
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: map.title || topic || file.name,
        concepts: map.concepts,
        sourceChunks: chunks,
        sourcePages: pages,
      })
      await sendEvent(next, {
        kind: 'session_start',
        text: topic
          ? `Student wants to learn: ${topic}`
          : 'Student uploaded source material (see sourceChunks). Begin the lesson.',
      })
    } catch (err) {
      dispatch({ type: 'ERROR', error: `Could not start session: ${err.message}` })
    }
  }

  // Spaced review: the due concepts become the lesson's map.
  async function handleStartReview() {
    const due = dueConcepts(stateRef.current.knowledgeGraph.concepts).slice(0, 8)
    if (!due.length) return
    const ids = new Set(due.map((c) => c.id))
    const next = apply({
      type: 'SESSION_START',
      mode: 'review',
      sessionId: `review-${Date.now()}`,
      title: `Review: ${due.map((c) => c.title).slice(0, 3).join(', ')}${due.length > 3 ? '…' : ''}`,
      concepts: due.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary || '',
        requires: (c.requires || []).filter((r) => ids.has(r)),
      })),
      sourceChunks: [],
    })
    await sendEvent(next, {
      kind: 'review_start',
      text: `Spaced review of ${due.length} concept(s) that came due. One check beat per concept.`,
    })
  }

  function handleBeatResponse(beat, response) {
    if (stateRef.current.loading) return
    const next = apply({
      type: 'STUDENT_RESPONSE',
      beatId: beat.id,
      conceptId: beat.concept_id,
      response,
    })
    sendEvent(next, {
      kind: response.kind,
      text: response.text,
      image: response.image,
      elementSummary: response.elementSummary,
      codeOutput: response.codeOutput,
      in_reply_to_beat_type: beat.beat_type,
      ...(response.committed_prediction ? { committed_prediction: true } : {}),
    })
  }

  function handleFreeEvent(event) {
    if (event.kind === 'retry') {
      if (lastCallRef.current) sendEvent(lastCallRef.current.state, lastCallRef.current.event)
      return
    }
    if (stateRef.current.loading) return
    sendEvent(stateRef.current, event)
  }

  // Workspace submissions attach to the latest unanswered beat when the tutor
  // is waiting on one; otherwise they go up as standalone events.
  function handleWorkspaceSubmit(response) {
    if (stateRef.current.loading) return
    const beats = stateRef.current.beats
    const latest = beats[beats.length - 1]
    const expectsWork =
      latest &&
      !latest.studentResponse &&
      ['exercise', 'consolidate', 'ask', 'check'].includes(latest.beat_type)
    if (expectsWork) {
      handleBeatResponse(latest, response)
    } else {
      sendEvent(stateRef.current, {
        kind: response.kind,
        text: response.text,
        image: response.image,
        elementSummary: response.elementSummary,
        codeOutput: response.codeOutput,
      })
    }
  }

  // Concept-map actions: each closes the map and steers the tutor.
  function handleMapAction(kind, concept, text) {
    if (stateRef.current.loading) return
    setShowMap(false)
    const messages = {
      test_concept: `Student asked to be tested on "${concept.title}" right now — give a check beat on it.`,
      explore_concept: `Student wants to explore "${concept.title}" — present or deepen it, then continue adaptively.`,
      question: `About "${concept.title}": ${text}`,
    }
    sendEvent(stateRef.current, { kind, conceptId: concept.id, text: messages[kind] })
  }

  function handleJump(concept) {
    if (stateRef.current.loading) return
    sendEvent(stateRef.current, {
      kind: 'jump',
      conceptId: concept.id,
      text: `Student clicked "${concept.title}" in the concept map — jump there and adapt.`,
    })
  }

  function handleEndSession() {
    const s = stateRef.current
    const { kg, entry } = recordSession(s.knowledgeGraph, {
      id: s.sessionId,
      title: s.title,
      conceptMap: s.conceptMap,
      summaries: s.summaries,
      notes: s.notes,
      beats: s.beats,
      resume: buildActiveSession(s),
    })
    apply({ type: 'END_SESSION', knowledgeGraph: kg })
    saveLesson(entry)
    saveActiveSession(null, { immediate: true })
    // Refresh the learner profile in the background; the lesson is already saved.
    if (s.beats.some((b) => b.studentResponse)) {
      fetchProfileUpdate({ ...s, knowledgeGraph: kg })
        .then((profile) => dispatch({ type: 'SET_PROFILE', profile }))
        .catch((err) => console.warn('profile update failed:', err))
    }
  }

  // "End session" first offers a review when there's anything worth testing.
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  function handleEndRequest() {
    const shaky = state.conceptMap.filter((c) => c.status === 'needs-review')
    if (state.pendingMemory.length > 0 || shaky.length > 0) setShowEndConfirm(true)
    else handleEndSession()
  }
  function handleFinalReview() {
    setShowEndConfirm(false)
    const items = state.pendingMemory.map((m) => m.text).join('; ')
    const shaky = state.conceptMap.filter((c) => c.status === 'needs-review').map((c) => c.title).join('; ')
    sendEvent(stateRef.current, {
      kind: 'final_review',
      text: `Student is wrapping up and chose a final review. Test each of these one at a time with check beats, then summarize the session. "Test me later" items: ${items || 'none'}. Needs-review concepts: ${shaky || 'none'}.`,
    })
  }

  function handleResumePast(entry) {
    if (!entry?.resume?.beats?.length) return
    dispatch({ type: 'RESUME_SESSION', session: entry.resume })
  }

  function handleSkip(beat) {
    handleBeatResponse(beat, {
      kind: freeSkip ? 'skip' : 'skip_test',
      text: freeSkip
        ? 'Skipped — student says they already know this. Move on.'
        : 'Skipped — student claims to know this. Give ONE test-out check on it.',
    })
  }

  function handleSetPace({ pace, focus }) {
    dispatch({ type: 'SET_PACE', pace, focus })
    if (!stateRef.current.loading) {
      sendEvent(
        { ...stateRef.current, pace, focus },
        {
          kind: 'pace',
          text: `Student set pace: ${pace}${focus ? `; focus on: ${focus}` : '; no specific focus'}. Adapt the remaining lesson.`,
        }
      )
    }
  }

  async function handleSwitchUser() {
    await logout()
    window.location.reload()
  }

  if (!session) return null

  if (!user) {
    return <LoginScreen firstRun={session.firstRun} signupOpen={session.signupOpen} onLogin={setUser} />
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-sm text-slate-500">
        Could not load your record ({loadError}).
        <button onClick={() => window.location.reload()} className="underline hover:text-slate-700">
          Try again
        </button>
      </div>
    )
  }

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-400">
        <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-indigo-500" /> Loading your record…
      </div>
    )
  }

  if (state.phase !== 'lesson') {
    const nudge = !state.nudgeDismissed && state.pendingMemory[0]
    return (
      <StartScreen
        onStart={handleStart}
        extracting={state.phase === 'extracting'}
        error={state.error}
        nudge={nudge || null}
        onDismissNudge={() => dispatch({ type: 'DISMISS_NUDGE' })}
        priorConcepts={Object.values(state.knowledgeGraph.concepts).map((c) => c.title)}
        dueCount={dueConcepts(state.knowledgeGraph.concepts).length}
        onStartReview={handleStartReview}
        pastSessions={state.knowledgeGraph.sessions || []}
        onResumeSession={handleResumePast}
        user={user}
        onSwitchUser={handleSwitchUser}
      />
    )
  }

  const latest = state.beats[state.beats.length - 1]
  const consolidatePending =
    !!latest && latest.beat_type === 'consolidate' && !latest.studentResponse
  const activeTabHint =
    latest && !latest.studentResponse
      ? latest.beat_type === 'consolidate'
        ? `notes:${latest.id}`
        : latest.beat_type === 'exercise' && ['whiteboard', 'code', 'project'].includes(latest.exercise_target)
          ? `${latest.exercise_target}:${latest.id}`
          : null
      : null

  return (
    <div className="flex h-full">
      <ProgressRail
        state={state}
        onJump={handleJump}
        onAddMemory={(text) => dispatch({ type: 'ADD_MEMORY', text })}
        onRemoveMemory={(id) => dispatch({ type: 'REMOVE_MEMORY', id })}
        onOpenMap={() => setShowMap(true)}
      />
      {showMap && (
        <ConceptMapView
          concepts={state.conceptMap}
          records={state.knowledgeGraph.concepts}
          onToggleReview={(c) => dispatch({ type: 'TOGGLE_REVIEW', concept: c })}
          busy={state.loading}
          onClose={() => setShowMap(false)}
          onTest={(c) => handleMapAction('test_concept', c)}
          onExplore={(c) => handleMapAction('explore_concept', c)}
          onAsk={(c, text) => handleMapAction('question', c, text)}
        />
      )}
      <div className="min-w-0 flex-[55]">
        <LessonPanel
          state={state}
          onBeatResponse={handleBeatResponse}
          onFreeEvent={handleFreeEvent}
          onEndSession={handleEndRequest}
          onSkip={handleSkip}
          onToggleExport={(beat) => dispatch({ type: 'TOGGLE_BEAT_EXPORT', beatId: beat.id })}
          onExport={() => downloadMarkdown(state)}
          onSetPace={handleSetPace}
          freeSkip={freeSkip}
          setFreeSkip={setFreeSkip}
        />
      </div>
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6" onClick={() => setShowEndConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Review before you go?</h2>
            <p className="mb-4 text-sm text-slate-600">
              {state.pendingMemory.length > 0 && (
                <>You asked to be tested on <b>{state.pendingMemory.length}</b> thing{state.pendingMemory.length > 1 ? 's' : ''}. </>
              )}
              {state.conceptMap.some((c) => c.status === 'needs-review') && (
                <>{state.conceptMap.filter((c) => c.status === 'needs-review').length} concept(s) still look shaky.</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleFinalReview}
                className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Review first
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false)
                  handleEndSession()
                }}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                End anyway
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-w-0 flex-[45]">
        <ErrorBoundary>
          <WorkspacePanel
            onSubmit={handleWorkspaceSubmit}
            disabled={state.loading}
            consolidatePending={consolidatePending}
            activeTabHint={activeTabHint}
            notes={state.notes}
            setNotes={(notes) => dispatch({ type: 'SET_NOTES', notes })}
            project={state.project}
            setProjectCode={(code) => dispatch({ type: 'SET_PROJECT_CODE', code })}
            onDeclineProject={() => dispatch({ type: 'DECLINE_PROJECT' })}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}
