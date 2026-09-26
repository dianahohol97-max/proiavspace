/**
 * Transactional email (booking notifications, billing reminders) via Brevo's
 * transactional API — one POST, no SDK. Without BREVO_API_KEY / EMAIL_FROM the
 * function is a no-op (with a console warning), so booking works before email
 * is configured — the photographer still sees the booking in the dashboard.
 * sendEmail() resolves to whether Brevo accepted the email, for callers that
 * retry.
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export interface EmailInput {
  to: string
  subject: string
  text: string
}

export interface EmailResult {
  ok: boolean
  /** HTTP status from Brevo; 0 when not configured or the request never left. */
  status: number
  /** Brevo's response body (messageId on success, the error otherwise). */
  body: string
}

/** True when both BREVO_API_KEY and EMAIL_FROM are set. */
export function isEmailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && !!process.env.EMAIL_FROM
}

/** EMAIL_FROM is `Name <email@domain>` or a bare `email@domain`. */
function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/)
  if (!match) return { email: from.trim() }
  const name = match[1].replace(/^"(.*)"$/, '$1').trim()
  return name ? { name, email: match[2] } : { email: match[2] }
}

/** The plain-text body as minimal HTML: escaped, line breaks kept. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.5">${escaped.replace(/\n/g, '<br>')}</div>`
}

/** Same as sendEmail, but returns Brevo's status and response body. */
export async function sendEmailDetailed(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    // Still a no-op (booking must work without email), but never a silent one.
    console.warn(`email not sent (BREVO_API_KEY/EMAIL_FROM not set): "${input.subject}"`)
    return { ok: false, status: 0, body: 'BREVO_API_KEY/EMAIL_FROM not set' }
  }

  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: textToHtml(input.text),
        textContent: input.text,
      }),
    })
    const body = (await response.text().catch(() => '')).slice(0, 500)
    if (!response.ok) {
      console.error(`email send failed: Brevo ${response.status} ${body}`)
    }
    return { ok: response.ok, status: response.status, body }
  } catch (cause) {
    // Notification failure must never break the booking itself.
    console.error('email send failed:', cause)
    return { ok: false, status: 0, body: String(cause).slice(0, 200) }
  }
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  return (await sendEmailDetailed(input)).ok
}
