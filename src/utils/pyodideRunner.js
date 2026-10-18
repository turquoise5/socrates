// Pyodide loads once from CDN and is shared across runs.
const PYODIDE_VERSION = '0.26.4'
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

let pyodidePromise = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.onload = resolve
    el.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(el)
  })
}

export function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (!window.loadPyodide) await loadScript(CDN + 'pyodide.js')
      return window.loadPyodide({ indexURL: CDN })
    })()
  }
  return pyodidePromise
}

export async function runPython(code) {
  const pyodide = await getPyodide()
  let stdout = ''
  let stderr = ''
  pyodide.setStdout({ batched: (s) => { stdout += s + '\n' } })
  pyodide.setStderr({ batched: (s) => { stderr += s + '\n' } })
  try {
    const result = await pyodide.runPythonAsync(code)
    if (result !== undefined && result !== null) {
      stdout += String(result) + '\n'
    }
  } catch (err) {
    stderr += String(err.message || err)
  } finally {
    pyodide.setStdout({})
    pyodide.setStderr({})
  }
  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() }
}
