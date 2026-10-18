export default function Slider({ name, label, min, max, step, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span className="w-16 shrink-0 truncate font-mono" title={label || name}>
        {label || name}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(name, Number(e.target.value))}
        className="w-40 accent-indigo-600"
      />
      <span className="w-12 font-mono tabular-nums">{Number(value).toFixed(2)}</span>
    </label>
  )
}
