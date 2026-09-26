/**
 * Transactional email (booking notifications, billing reminders).
 * Resend-compatible HTTP API, chosen because it is one POST with no SDK. Without RESEND_API_KEY the
 * function is a no-op (with a console warning), so booking works before email is configured —
 * the photographer still sees the booking in the dashboard. Resolves to
 * whether the email was accepted, for callers that retry.
 */
export async function sendEmail(input: {
  to: string
  subject: string
  text: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    // Still a no-op (booking must work without email), but never a silent one.
    console.warn(`email not sent (RESEND_API_KEY/EMAIL_FROM not set): "${input.subject}"`)
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text }),
    })
    if (!response.ok) {
      console.error(`email send failed: ${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`)
    }
    return response.ok
  } catch (cause) {
    // Notification failure must never break the booking itself.
    console.error('email send failed:', cause)
    return false
  }
}
