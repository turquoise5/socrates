import { useMemo, useState } from 'react'
import * as d3 from 'd3'

const W = 460
const H = 320

export default function GraphNetwork({ spec, onNodeSelect }) {
  const [selected, setSelected] = useState(null)

  const layout = useMemo(() => {
    const nodes = (spec.nodes || []).map((n) => ({ ...n }))
    const links = (spec.edges || [])
      .filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      .map((e) => ({ ...e }))
    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(36))
      .stop()
    sim.tick(300)
    for (const n of nodes) {
      n.x = Math.max(40, Math.min(W - 40, n.x))
      n.y = Math.max(24, Math.min(H - 24, n.y))
    }
    return { nodes, links }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec.nodes), JSON.stringify(spec.edges)])

  const click = (node) => {
    if (!spec.clickable) return
    setSelected(node.id)
    onNodeSelect?.(node)
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-slate-200 bg-white">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>
      {layout.links.map((l, i) => (
        <g key={i}>
          <line
            x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
            stroke="#94a3b8" strokeWidth="1.5"
            markerEnd={l.directed !== false ? 'url(#arrow)' : undefined}
          />
          {l.label && (
            <text x={(l.source.x + l.target.x) / 2} y={(l.source.y + l.target.y) / 2 - 5}
              textAnchor="middle" fontSize="9" fill="#64748b">{l.label}</text>
          )}
        </g>
      ))}
      {layout.nodes.map((n) => (
        <g key={n.id} onClick={() => click(n)} className={spec.clickable ? 'cursor-pointer' : ''}>
          <circle cx={n.x} cy={n.y} r="20"
            fill={selected === n.id ? '#4f46e5' : '#eef2ff'}
            stroke={selected === n.id ? '#312e81' : '#818cf8'} strokeWidth="1.5" />
          <text x={n.x} y={n.y + H * 0} dy="0.35em" textAnchor="middle" fontSize="10"
            fill={selected === n.id ? '#fff' : '#312e81'} fontWeight="600">
            {(n.label || n.id).length > 8 ? (n.label || n.id).slice(0, 7) + '…' : n.label || n.id}
          </text>
          {(n.label || n.id).length > 8 && (
            <text x={n.x} y={n.y + 32} textAnchor="middle" fontSize="9" fill="#475569">{n.label || n.id}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
