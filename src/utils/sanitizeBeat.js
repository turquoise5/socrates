// Beat content arrives as markdown but occasionally carries model artifacts:
// <cite index="..."> tags (an internal citation format the model imitates)
// and bare page markers. Normalize before rendering.
export function sanitizeBeatContent(md, { pageCount = 0 } = {}) {
  if (!md) return md
  let out = md
    // <cite ...>text</cite> → “text” (dropping any quotes the model already added)
    .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, (_, inner) => {
      const t = inner.trim().replace(/^["“”'‘’\s]+/, '').replace(/["“”'‘’\s]+$/, '')
      return `“${t}”`
    })
    // stray unmatched tags
    .replace(/<\/?cite[^>]*>/gi, '')
  // Page references become clickable when we actually hold page images.
  if (pageCount > 0) {
    out = out
      .replace(/\[page\s+(\d+)\]/gi, (_, n) => (Number(n) <= pageCount ? `[p. ${n}](#page-${n})` : `p. ${n}`))
      .replace(/\((?:p|pg|page)\.?\s*(\d+)\)/gi, (_, n) =>
        Number(n) <= pageCount ? `([p. ${n}](#page-${n}))` : `(p. ${n})`
      )
  } else {
    out = out.replace(/\[page\s+(\d+)\]/gi, 'p. $1')
  }
  return out
}
