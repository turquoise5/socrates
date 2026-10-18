import { useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { compileExpr } from '../../utils/expr'

const W = 460
const H = 340
const N = 80 // grid resolution

export default function GradientSurface({ spec }) {
  const [x0, x1] = spec.xDomain || [-3, 3]
  const [y0, y1] = spec.yDomain || [-3, 3]
  const lr = spec.learningRate ?? 0.1
  const svgRef = useRef(null)

  const fn = useMemo(() => {
    try {
      return compileExpr(spec.surface, ['x', 'y'])
    } catch {
      return null
    }
  }, [spec.surface])

  const [trail, setTrail] = useState(() => [spec.start || [(x0 + x1) / 2, (y0 + y1) / 2]])
  const point = trail[trail.length - 1]

  const { paths, color } = useMemo(() => {
    if (!fn) return { paths: [], color: null }
    const grid = new Float64Array(N * N)
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = x0 + ((x1 - x0) * i) / (N - 1)
        const y = y1 - ((y1 - y0) * j) / (N - 1)
        grid[j * N + i] = fn({ x, y })
      }
    }
    const finite = Array.from(grid).filter(Number.isFinite)
    const [lo, hi] = d3.extent(finite)
    const thresholds = d3.range(lo, hi, (hi - lo) / 14 || 1)
    const cs = d3.contours().size([N, N]).thresholds(thresholds)(grid)
    const proj = d3.geoPath(d3.geoIdentity().scale(W / N))
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([hi, lo])
    return { paths: cs.map((c) => ({ d: proj(c), v: c.value })), color: colorScale }
  }, [fn, x0, x1, y0, y1])

  if (!fn) return <div className="text-sm text-red-600">Could not parse surface expression.</div>

  const sx = d3.scaleLinear([x0, x1], [0, W])
  const sy = d3.scaleLinear([y0, y1], [H, 0])

  const grad = ([px, py]) => {
    const h = 1e-4
    return [
      (fn({ x: px + h, y: py }) - fn({ x: px - h, y: py })) / (2 * h),
      (fn({ x: px, y: py + h }) - fn({ x: px, y: py - h })) / (2 * h),
    ]
  }

  const step = () => {
    const [gx, gy] = grad(point)
    const nx = Math.max(x0, Math.min(x1, point[0] - lr * gx))
    const ny = Math.max(y0, Math.min(y1, point[1] - lr * gy))
    setTrail((t) => [...t, [nx, ny]])
  }

  const place = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const px = sx.invert(((e.clientX - rect.left) / rect.width) * W)
    const py = sy.invert(((e.clientY - rect.top) / rect.height) * H)
    setTrail([[px, py]])
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair rounded border border-slate-200"
        onPointerDown={place}
      >
        <g transform={`scale(1, ${H / W})`}>
          {paths.map((p, i) => (
            <path key={i} d={p.d || ''} fill={color(p.v)} stroke="#fff" strokeOpacity="0.15" />
          ))}
        </g>
        <polyline
          points={trail.map(([px, py]) => `${sx(px)},${sy(py)}`).join(' ')}
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {trail.map(([px, py], i) => (
          <circle key={i} cx={sx(px)} cy={sy(py)} r={i === trail.length - 1 ? 6 : 2.5}
            fill={i === trail.length - 1 ? '#f97316' : '#fdba74'} stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
        <button
          onClick={step}
          className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
        >
          Step (η = {lr})
        </button>
        <span className="font-mono">
          ({point[0].toFixed(2)}, {point[1].toFixed(2)}) → f = {fn({ x: point[0], y: point[1] }).toFixed(3)}
        </span>
        <button
          onClick={() => setTrail([spec.start || [(x0 + x1) / 2, (y0 + y1) / 2]])}
          className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
        <span className="text-slate-400">click surface to move the point</span>
      </div>
    </div>
  )
}
