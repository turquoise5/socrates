import FunctionPlot from './FunctionPlot'
import GradientSurface from './GradientSurface'
import GraphNetwork from './GraphNetwork'
import Distribution from './Distribution'
import GeneratedVisual from './GeneratedVisual'

export default function VisualRenderer({ spec, onNodeSelect, sourcePages }) {
  if (!spec || typeof spec !== 'object') return null
  const body = (() => {
    switch (spec.template) {
      case 'source-page': {
        const img = sourcePages?.[Number(spec.page) - 1]
        return img ? (
          <img
            src={img}
            alt={`source material, page ${spec.page}`}
            className="max-h-[480px] w-full rounded border border-slate-200 object-contain"
          />
        ) : (
          <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
            Source page {spec.page} isn't available in this session.
          </div>
        )
      }
      case 'function-plot':
        return <FunctionPlot spec={spec} />
      case 'gradient-descent-surface':
      case 'vector-field':
        return <GradientSurface spec={spec} />
      case 'graph-network':
        return <GraphNetwork spec={spec} onNodeSelect={onNodeSelect} />
      case 'distribution':
      case 'bar-race':
        return <Distribution spec={spec} />
      case 'generated':
        return spec.html ? <GeneratedVisual html={spec.html} /> : null
      default:
        return spec.html ? <GeneratedVisual html={spec.html} /> : (
          <div className="text-sm text-slate-500">Unknown visual template: {String(spec.template)}</div>
        )
    }
  })()
  return (
    <div>
      {body}
      {spec.question && (
        <p className="mt-2 text-sm font-medium text-slate-800">{spec.question}</p>
      )}
    </div>
  )
}
