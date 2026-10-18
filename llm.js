// Model providers behind one interface. The client always sends an
// Anthropic-shaped request ({system, messages}) and reads back
// {content: [{type: 'text', text}]}; each provider translates to and from its
// own API.
//
//   PROVIDER=anthropic  Anthropic's Messages API (default). Full feature set:
//                       server-side code execution + web search, prompt
//                       caching, effort, refusal fallbacks.
//   PROVIDER=openai     Any OpenAI-compatible Chat Completions API: OpenAI,
//                       OpenRouter (which also serves Claude), Gemini, Groq,
//                       Mistral, Together, Ollama, LM Studio, vLLM… Set
//                       API_BASE_URL to the provider's endpoint.

const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5'

// Anthropic server tools: a calculator (code execution) for checking
// arithmetic before CHECK beats, and web search for facts when no source
// material was uploaded. Both run on Anthropic's side.
const ANTHROPIC_TOOLS = [
  { type: 'code_execution_20260521', name: 'code_execution' },
  { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
]

// If a safety classifier declines a turn (it can misfire on legitimate
// biology or security lessons), let the API retry it on a fallback model
// instead of failing. Only these models accept the parameter.
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']

// The tutor prompt mentions tools; providers without them get told so, so
// the model doesn't pretend to call them.
const NO_TOOLS_NOTE =
  '\n\nNOTE: No tools are available in this deployment. Where the instructions mention code execution or web search, verify by careful step-by-step reasoning instead, and say when something is uncertain.'

const errorBody = (message) => ({ error: { message } })

export function createLLM(env = process.env) {
  const provider = (env.PROVIDER || 'anthropic').toLowerCase()
  const apiKey = env.API_KEY || (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : undefined)
  if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Set API_KEY (or ANTHROPIC_API_KEY) in .env')
    return anthropic({ apiKey, model: env.MODEL || ANTHROPIC_DEFAULT_MODEL, effort: env.EFFORT || 'low' })
  }
  if (provider === 'openai') {
    if (!env.MODEL) throw new Error('Set MODEL in .env (the model ID your provider uses)')
    return openaiCompatible({
      apiKey, // optional: local servers like Ollama don't need one
      model: env.MODEL,
      baseUrl: (env.API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      maxTokens: env.MAX_TOKENS ? Number(env.MAX_TOKENS) : null,
    })
  }
  throw new Error(`Unknown PROVIDER "${provider}" — use "anthropic" or "openai"`)
}

function anthropic({ apiKey, model, effort }) {
  const useFallbacks = FALLBACK_MODELS.includes(model)

  async function call(body) {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(useFallbacks ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
      },
      body: JSON.stringify(body),
    })
    return { ok: upstream.ok, status: upstream.status, data: await upstream.json() }
  }

  return {
    label: `anthropic / ${model}`,
    async chat({ system, messages, useTools }) {
      const base = {
        model,
        // Current models think adaptively and thinking counts toward
        // max_tokens, so leave plenty of headroom for the beat JSON after it.
        max_tokens: 16000,
        // Lessons are interactive: keep turns quick. Raise for deeper reasoning.
        output_config: { effort },
        ...(useFallbacks ? { fallbacks: 'default' } : {}),
        // Cache the (large, stable) system prompt — repeat calls read it at
        // ~0.1x cost and much lower latency.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        ...(useTools ? { tools: ANTHROPIC_TOOLS } : {}),
      }
      let convo = messages
      let result = null
      // Server tools pause the turn every ~10 iterations; continue up to 4 times.
      for (let i = 0; i < 4; i++) {
        result = await call({ ...base, messages: convo })
        if (!result.ok) return result
        if (result.data.stop_reason !== 'pause_turn') break
        convo = [...convo, { role: 'assistant', content: result.data.content }]
      }
      return result
    },
  }
}

// Anthropic content blocks → Chat Completions content parts.
function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  return content.map((block) => {
    if (block.type === 'image' && block.source?.type === 'base64') {
      return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } }
    }
    return { type: 'text', text: block.text ?? '' }
  })
}

// Assistant turns must be plain text for most providers.
const flattenText = (content) =>
  typeof content === 'string' ? content : content.map((b) => b.text ?? '').join('')

function openaiCompatible({ apiKey, model, baseUrl, maxTokens }) {
  return {
    label: `openai-compatible / ${model} @ ${baseUrl}`,
    async chat({ system, messages, useTools }) {
      const body = {
        model,
        messages: [
          { role: 'system', content: system + (useTools ? NO_TOOLS_NOTE : '') },
          ...messages.map((m) => ({
            role: m.role,
            content: m.role === 'assistant' ? flattenText(m.content) : toOpenAIContent(m.content),
          })),
        ],
        // Omitted by default: providers disagree on the parameter name and
        // limits, and each model's own default is usually right.
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
      })
      const data = await upstream.json().catch(() => ({}))
      if (!upstream.ok) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message
        return { ok: false, status: upstream.status, data: errorBody(message || `provider error (${upstream.status})`) }
      }
      const choice = data.choices?.[0]
      const text = flattenText(choice?.message?.content ?? '')
      if (!text) {
        return { ok: false, status: 502, data: errorBody(`model returned no text (finish_reason: ${choice?.finish_reason ?? 'unknown'})`) }
      }
      return {
        ok: true,
        status: 200,
        data: { content: [{ type: 'text', text }], stop_reason: choice.finish_reason, model: data.model },
      }
    },
  }
}
