// pdfjs-dist must be imported lazily: at module scope GlobalWorkerOptions is
// undefined until the async import resolves.
const MAX_PAGE_IMAGES = 40

async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.js?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pageTexts = []
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // [page N] markers let the tutor cite pages for source-page visuals.
    pageTexts.push(`[page ${i}] ` + content.items.map((it) => it.str).join(' '))
    if (i <= MAX_PAGE_IMAGES) {
      // Snapshot the rendered page so original figures/diagrams can be shown
      // in the lesson (compressed: ~60-80KB per page).
      const base = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(1.5, 700 / base.width) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(vp.width)
      canvas.height = Math.ceil(vp.height)
      // intent 'print' renders without requestAnimationFrame scheduling --
      // the default 'display' intent hangs forever in hidden/background tabs.
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, intent: 'print' }).promise
      pages.push(canvas.toDataURL('image/jpeg', 0.6))
    }
  }
  return { text: pageTexts.join('\n\n'), pages }
}

export async function extractText(file) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdf(file)
  }
  return { text: await file.text(), pages: [] }
}

// Split source material into ~1800-char chunks on paragraph boundaries so
// per-concept context can be selected without blowing up the prompt.
export function chunkText(text, size = 1800) {
  const paras = text.split(/\n\s*\n/)
  const chunks = []
  let cur = ''
  for (const p of paras) {
    if (cur && cur.length + p.length > size) {
      chunks.push(cur.trim())
      cur = ''
    }
    cur += p + '\n\n'
    while (cur.length > size * 1.5) {
      chunks.push(cur.slice(0, size).trim())
      cur = cur.slice(size)
    }
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks
}
