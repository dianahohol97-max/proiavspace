/**
 * LLM providers for the blog generator. Pick with BLOG_LLM_PROVIDER
 * (gemini | anthropic, default gemini).
 *
 *  research(): a call WITH web search — returns raw text (a JSON array of facts)
 *  write():    a call WITHOUT tools, JSON output
 */

import { geminiModel } from '@/lib/gemini'

export interface LlmProvider {
  name: string
  research(prompt: string): Promise<{ text: string; searchUrls: string[] }>
  write(prompt: string): Promise<string>
}

export class ProviderError extends Error {}

/* ---------------- Gemini (default) ---------------- */

function gemini(): LlmProvider {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('Ключ GEMINI_API_KEY не додано. Додай його в змінні середовища й повтори.')
  const model = geminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

  async function call(body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new ProviderError(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    const cand = data?.candidates?.[0]
    const text: string = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    if (!text) throw new ProviderError('Порожня відповідь від Gemini.')
    return { text, cand }
  }

  return {
    name: `gemini:${model}`,
    async research(prompt) {
      // Search grounding cannot be combined with JSON mode — parse the text.
      const { text, cand } = await call({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      })
      const chunks: { web?: { uri?: string } }[] = cand?.groundingMetadata?.groundingChunks ?? []
      return { text, searchUrls: chunks.map((c) => c.web?.uri ?? '').filter(Boolean) }
    },
    async write(prompt) {
      const { text } = await call({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      })
      return text
    },
  }
}

/* ---------------- Anthropic (stub) ---------------- */

function anthropic(): LlmProvider {
  // TODO: Messages API with the web_search tool for research(), plain JSON for
  // write(). Needs ANTHROPIC_API_KEY. Not implemented yet.
  const fail = async (): Promise<never> => {
    throw new ProviderError('BLOG_LLM_PROVIDER=anthropic ще не реалізовано — постав gemini.')
  }
  return { name: 'anthropic', research: fail, write: fail }
}

export function getProvider(): LlmProvider {
  const name = (process.env.BLOG_LLM_PROVIDER || 'gemini').toLowerCase()
  if (name === 'gemini') return gemini()
  if (name === 'anthropic') return anthropic()
  throw new ProviderError(`Невідомий BLOG_LLM_PROVIDER="${name}" (gemini | anthropic).`)
}

/** Parse model JSON, tolerating ```json fences and text around it. */
export function parseJson<T>(text: string, kind: 'array' | 'object'): T {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const open = kind === 'array' ? '[' : '{'
  const close = kind === 'array' ? ']' : '}'
  const start = cleaned.indexOf(open)
  const end = cleaned.lastIndexOf(close)
  if (start < 0 || end < start) throw new ProviderError('Модель не повернула JSON.')
  return JSON.parse(cleaned.slice(start, end + 1)) as T
}
