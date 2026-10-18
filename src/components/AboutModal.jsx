import { X } from 'lucide-react'

export default function AboutModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Why Socrates</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700">
          <p>
            Learning should be hard. It should require effort. AI opens an entirely new avenue
            when it comes to learning, and it can enable people to learn in an adaptive,
            interactive, multi-modal way that did not exist before. Bring topics or material from
            textbooks, lectures slides or otherwise, material worth the effort, and the learning
            will be hard and rewarding on purpose.
          </p>
        </div>
      </div>
    </div>
  )
}
