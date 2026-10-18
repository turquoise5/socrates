import { useCallback, useState } from 'react'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import { Send } from 'lucide-react'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Compact element description the model can reason about alongside the image.
function summarizeElements(elements) {
  return elements
    .filter((el) => !el.isDeleted)
    .map((el) => {
      const base = { type: el.type, x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.width), h: Math.round(el.height) }
      if (el.text) base.text = el.text
      return base
    })
    .slice(0, 120)
}

export default function WhiteboardTab({ onSubmit, disabled }) {
  const [api, setApi] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!api) return
    const elements = api.getSceneElements()
    if (!elements.length) return
    setBusy(true)
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: '#ffffff' },
        files: api.getFiles(),
        mimeType: 'image/png',
        maxWidthOrHeight: 1200,
      })
      const image = await blobToBase64(blob)
      onSubmit({
        kind: 'whiteboard',
        text: 'Whiteboard submission (image attached).',
        image,
        elementSummary: summarizeElements(elements),
      })
    } finally {
      setBusy(false)
    }
  }, [api, onSubmit])

  return (
    <div className="relative h-full">
      <div className="h-full">
        <Excalidraw excalidrawAPI={setApi} />
      </div>
      <button
        onClick={submit}
        disabled={disabled || busy || !api}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-700 disabled:opacity-40"
      >
        <Send size={14} /> {busy ? 'Capturing…' : 'Submit to tutor'}
      </button>
    </div>
  )
}
