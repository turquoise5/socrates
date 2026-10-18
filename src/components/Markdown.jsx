import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'

export default function Markdown({ children, onOpenPage }) {
  return (
    <div className="prose-beat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          a: ({ href, children: kids }) => {
            // #page-N links open the original source page image
            if (href?.startsWith('#page-')) {
              const n = Number(href.slice(6))
              return (
                <button
                  onClick={() => onOpenPage?.(n)}
                  className="font-medium text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-800"
                  title={`View source page ${n}`}
                >
                  {kids}
                </button>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {kids}
              </a>
            )
          },
        }}
      >
        {children ?? ''}
      </ReactMarkdown>
    </div>
  )
}
