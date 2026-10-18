// Compile an AI-supplied math expression ("a*x^2 + sin(b*x)", "x > 0 ? 1 : 0")
// into a JS function of a scope object. Identifiers are whitelisted: known Math
// functions/constants, common activation helpers, plus the variable names
// passed in — anything else throws, so arbitrary code can't ride in through a
// visual_spec. Comparisons and ternaries are allowed so threshold/piecewise
// functions (perceptrons, step functions) render.
const FUNCS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'log2', 'log10', 'sqrt', 'abs', 'pow', 'min', 'max', 'floor', 'ceil', 'round', 'sign', 'tanh', 'cosh', 'sinh', 'atan2']
const HELPERS = ['step', 'heaviside', 'sigmoid', 'relu']
const HELPER_DEFS =
  'const step=(v)=>(v>0?1:0),heaviside=step,sigmoid=(v)=>1/(1+Math.exp(-v)),relu=(v)=>Math.max(0,v);'
const CONSTS = { pi: 'Math.PI', PI: 'Math.PI', e: 'Math.E', E: 'Math.E' }

export function compileExpr(expr, vars) {
  if (typeof expr !== 'string' || expr.length > 500) throw new Error('bad expression')
  if (!/^[\w\s+\-*/().,^<>=?:!&|]*$/.test(expr)) throw new Error(`illegal characters in "${expr}"`)
  // Block assignment: a lone = that isn't part of ==, <=, >=, !=
  if (/(^|[^<>=!])=(?!=)/.test(expr)) throw new Error(`assignment not allowed in "${expr}"`)
  const js = expr
    .replace(/\^/g, '**')
    .replace(/[A-Za-z_]\w*/g, (name) => {
      if (FUNCS.includes(name)) return `Math.${name}`
      if (HELPERS.includes(name)) return name
      if (name in CONSTS) return CONSTS[name]
      if (vars.includes(name)) return `s.${name}`
      throw new Error(`unknown identifier "${name}" in expression`)
    })
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', `"use strict"; ${HELPER_DEFS} return (${js});`)
  return (scope) => {
    const v = fn(scope)
    if (typeof v === 'boolean') return v ? 1 : 0
    return typeof v === 'number' ? v : NaN
  }
}
