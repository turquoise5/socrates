import { sanitizeBeatContent } from './sanitizeBeat'

const TYPE_LABEL = {
  present: 'Material',
  visual: 'Visual',
  ask: 'Question',
  exercise: 'Exercise',
  check: 'Check',
  consolidate: 'Consolidate',
  tangent: 'Tangent',
}

// Markdown preserves the most across tools: LaTeX stays as $...$ source,
// code stays fenced, whiteboard sketches embed as data-URI images. Imports
// cleanly into Notion, Obsidian, and renders on GitHub.
export function buildMarkdown(state) {
  const lines = []
  lines.push(`# ${state.title || 'Socrates session'}`)
  lines.push(`_${new Date().toLocaleString()}_`, '')

  lines.push('## Lesson', '')
  for (const beat of state.beats) {
    if (beat.excluded) continue
    lines.push(`### ${TYPE_LABEL[beat.beat_type] || beat.beat_type} · ${beat.concept_id || ''}`.trim(), '')
    lines.push(sanitizeBeatContent(beat.content || '', { pageCount: 0 }), '')
    if (beat.question) {
      lines.push(`> **Q:** ${sanitizeBeatContent(beat.question, { pageCount: 0 })}`, '')
    }
    const r = beat.studentResponse
    if (r) {
      if (r.image) lines.push(`![whiteboard](data:image/png;base64,${r.image})`, '')
      if (r.text) {
        if (r.kind === 'code' || r.kind === 'project') {
          lines.push('**Your code:**', '', '```python', r.text, '```', '')
          if (r.codeOutput) lines.push('```\n' + r.codeOutput + '\n```', '')
        } else {
          lines.push(`**You:** ${r.text}`, '')
        }
      }
    }
  }

  if (state.notes?.trim()) {
    lines.push('## Notes', '', state.notes.trim(), '')
  }

  const summaries = Object.entries(state.summaries || {})
  if (summaries.length) {
    lines.push('## Consolidation summaries', '')
    for (const [cid, text] of summaries) {
      const title = state.conceptMap.find((c) => c.id === cid)?.title || cid
      lines.push(`### ${title}`, '', text, '')
    }
  }

  if (state.project?.brief && !state.project.declined) {
    lines.push('## Project', '', state.project.brief, '')
    if (state.project.milestones?.length) {
      for (const m of state.project.milestones) {
        lines.push(`- [${m.status === 'done' ? 'x' : ' '}] ${m.title}`)
      }
      lines.push('')
    }
    if (state.project.code?.trim()) {
      lines.push('```python', state.project.code, '```', '')
    }
  }

  return lines.join('\n')
}

export function downloadMarkdown(state) {
  const md = buildMarkdown(state)
  const blob = new Blob([md], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(state.title || 'socrates-session').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}
