import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { compileExpr } from '../../utils/expr'
import Slider from './Slider'

const W = 460
const H = 280
const M = { top: 12, right: 12, bottom: 26, left: 40 }

export default function Distribution({ spec }) {
  const params = spec.params || []
  const [values, setValues] = useState(() =>
    Object.fromEntries(params.map((p) => [p.name, p.value ?? (p.min + p.max) / 2]))
  )

  const isBar = spec.kind === 'bar' && Array.isArray(spec.data)

  const curve = useMemo(() => {
    if (isBar || !spec.expr) return null
    try {
      const fn = compileExpr(spec.expr, ['x', ...params.map((p) => p.name)])
      const [x0, x1] = spec.xDomain || [-5, 5]
      const xs = d3.range(x0, x1, (x1 - x0) / 200)
      return xs.map((x) => ({ x, y: fn({ x, ...values }) }))
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.expr, values, isBar])

  if (isBar) {
    const data = spec.data
    const sx = d3.scaleBand(data.map((d) => d.label), [M.left, W - M.right]).padding(0.25)
    const maxV = d3.max(data, (d) => d.value) || 1
    const sy = d3.scaleLinear([0, maxV * 1.1], [H - M.bottom, M.top])
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-slate-200 bg-white">
          {sy.ticks(5).map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
              <text x={M.left - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{t}</text>
            </g>
          ))}
          {data.map((d) => (
            <g key={d.label}>
              <rect x={sx(d.label)} y={sy(d.value)} width={sx.bandwidth()} height={H - M.bottom - sy(d.value)} fill="#6366f1" rx="2" />
              <text x={sx(d.label) + sx.bandwidth() / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#475569">{d.label}</text>
            </g>
          ))}
        </svg>
      </div>
    )
  }

  if (!curve) return <div className="text-sm text-red-600">Could not render distribution.</div>

  const [x0, x1] = spec.xDomain || [-5, 5]
  const ys = curve.map((d) => d.y).filter(Number.isFinite)
  const sy = d3.scaleLinear([0, (d3.max(ys) || 1) * 1.1], [H - M.bottom, M.top])
  const sx = d3.scaleLinear([x0, x1], [M.left, W - M.right])
  const area = d3.area().defined((d) => Number.isFinite(d.y)).x((d) => sx(d.x)).y0(H - M.bottom).y1((d) => sy(Math.max(0, d.y)))
  const line = d3.line().defined((d) => Number.isFinite(d.y)).x((d) => sx(d.x)).y((d) => sy(Math.max(0, d.y)))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-slate-200 bg-white">
        {sx.ticks(8).map((t) => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{t}</text>
        ))}
        <path d={area(curve) || ''} fill="#6366f1" fillOpacity="0.15" />
        <path d={line(curve) || ''} fill="none" stroke="#4f46e5" strokeWidth="2" />
      </svg>
      {params.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {params.map((p) => (
            <Slider key={p.name} {...p} value={values[p.name]} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
          ))}
        </div>
      )}
    </div>
  )
}
