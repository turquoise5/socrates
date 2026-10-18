import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { compileExpr } from '../../utils/expr'
import Slider from './Slider'

const COLORS = ['#4f46e5', '#dc2626', '#059669']
const W = 460
const H = 300
const M = { top: 12, right: 12, bottom: 26, left: 40 }

export default function FunctionPlot({ spec }) {
  const params = spec.params || []
  const [values, setValues] = useState(() =>
    Object.fromEntries(params.map((p) => [p.name, p.value ?? (p.min + p.max) / 2]))
  )
  const varNames = ['x', ...params.map((p) => p.name)]

  const compiled = useMemo(() => {
    try {
      return { fns: (spec.functions || []).slice(0, 3).map((f) => compileExpr(f, varNames)), error: null }
    } catch (e) {
      return { fns: [], error: e.message }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec.functions)])

  const [x0, x1] = spec.xDomain || [-10, 10]
  const samples = useMemo(() => {
    const xs = d3.range(x0, x1 + (x1 - x0) / 400, (x1 - x0) / 200)
    return compiled.fns.map((fn) => xs.map((x) => ({ x, y: fn({ x, ...values }) })))
  }, [compiled, values, x0, x1])

  let [y0, y1] = spec.yDomain || []
  if (y0 == null || y1 == null) {
    const ys = samples.flat().map((d) => d.y).filter(Number.isFinite)
    const ext = ys.length ? d3.extent(ys) : [-1, 1]
    const pad = (ext[1] - ext[0] || 2) * 0.1
    y0 = ext[0] - pad
    y1 = ext[1] + pad
  }

  const sx = d3.scaleLinear([x0, x1], [M.left, W - M.right])
  const sy = d3.scaleLinear([y0, y1], [H - M.bottom, M.top])
  const line = d3
    .line()
    .defined((d) => Number.isFinite(d.y) && d.y >= y0 - (y1 - y0) && d.y <= y1 + (y1 - y0))
    .x((d) => sx(d.x))
    .y((d) => sy(Math.max(y0 - (y1 - y0), Math.min(y1 + (y1 - y0), d.y))))

  if (compiled.error) {
    return <div className="text-sm text-red-600">Could not render plot: {compiled.error}</div>
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-slate-200 bg-white">
        {sx.ticks(8).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={H - M.bottom} stroke="#f1f5f9" />
            <text x={sx(t)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{t}</text>
          </g>
        ))}
        {sy.ticks(6).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
            <text x={M.left - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(t * 100) / 100}</text>
          </g>
        ))}
        {y0 < 0 && y1 > 0 && <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)} stroke="#cbd5e1" />}
        {x0 < 0 && x1 > 0 && <line x1={sx(0)} x2={sx(0)} y1={M.top} y2={H - M.bottom} stroke="#cbd5e1" />}
        {samples.map((pts, i) => (
          <path key={i} d={line(pts) || ''} fill="none" stroke={COLORS[i]} strokeWidth="2" />
        ))}
      </svg>
      {(spec.functions || []).length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 text-xs">
          {spec.functions.map((f, i) => (
            <span key={i} className="font-mono" style={{ color: COLORS[i] }}>{f}</span>
          ))}
        </div>
      )}
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
