/**
 * The one place the Gemini model name comes from: the GEMINI_MODEL env var
 * (Vercel; GitHub Actions repository variable for the blog workflow). There is
 * deliberately no hardcoded fallback — a retired model name would make every
 * call 404, and a silent default hid which model production was really using.
 * Read it at call time, not at import: a missing variable then fails the one
 * feature that needs it, with a clear message, instead of the whole route.
 */
export function geminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim()
  if (!model) {
    throw new Error('GEMINI_MODEL is not set (Vercel → Environment Variables, GitHub → Variables)')
  }
  return model
}
