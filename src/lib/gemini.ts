/**
 * The one place the Gemini model name lives. Set GEMINI_MODEL in the
 * environment (Vercel, GitHub Actions vars); the fallback is only a safety net
 * and must track the current model — a retired name makes every call 404.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
