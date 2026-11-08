'use client'

import { useState } from 'react'

export interface LeadFormLabels {
  title: string
  name: string
  contact: string
  message: string
  send: string
  sent: string
  error: string
  /* Optional — the «Тиша» form variant (split contact, date, type). */
  email?: string
  phone?: string
  date?: string
  shootType?: string
  shootOther?: string
  contactHint?: string
  sending?: string
  /* Gift certificate fields (opened from «Подарунки та друк»). */
  certNominal?: string
  certTo?: string
  certFrom?: string
}

export type LeadStatus = 'idle' | 'busy' | 'sent' | 'error'

/**
 * Posting a lead to /api/sites/lead, shared by the default form and theme
 * variants. `handle` null (editor preview) → nothing is sent.
 */
export function useLeadSubmit(handle: string | null) {
  const [status, setStatus] = useState<LeadStatus>('idle')

  async function send(
    fields: { name: string; contact: string; message: string },
    form: HTMLFormElement
  ) {
    if (!handle) return
    setStatus('busy')
    try {
      const response = await fetch('/api/sites/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, ...fields }),
      })
      if (!response.ok) throw new Error(`lead ${response.status}`)
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  return { status, send }
}

/**
 * Lead form inside the contact block of a photographer site. Styled with the
 * site's CSS custom properties so it inherits whatever theme is active.
 * `handle` is null in the editor preview — the form renders but won't post.
 */
export function LeadForm({
  handle,
  labels,
}: {
  handle: string | null
  labels: LeadFormLabels
}) {
  const { status, send } = useLeadSubmit(handle)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    await send(
      {
        name: String(data.get('name') ?? ''),
        contact: String(data.get('contact') ?? ''),
        message: String(data.get('message') ?? ''),
      },
      form
    )
  }

  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--site-line)',
    borderRadius: 'var(--site-radius)',
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'var(--site-font-body)',
    fontSize: 14,
    padding: '11px 14px',
    outline: 'none',
  }

  if (status === 'sent') {
    return (
      <p style={{ marginTop: 28, fontSize: 15, color: 'var(--site-muted)' }}>{labels.sent}</p>
    )
  }

  return (
    <form
      onSubmit={submit}
      style={{
        margin: '28px auto 0',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        textAlign: 'left',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--site-font-label)',
          fontSize: 11,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--site-muted)',
          margin: '0 0 4px',
          textAlign: 'center',
        }}
      >
        {labels.title}
      </p>
      <input name="name" required maxLength={120} placeholder={labels.name} style={field} />
      <input name="contact" required maxLength={200} placeholder={labels.contact} style={field} />
      <textarea name="message" rows={3} maxLength={2000} placeholder={labels.message} style={field} />
      <button
        type="submit"
        disabled={status === 'busy'}
        style={{
          marginTop: 6,
          border: '1px solid var(--site-fg)',
          background: 'transparent',
          color: 'inherit',
          padding: '13px 32px',
          fontFamily: 'var(--site-font-label)',
          fontSize: 11,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          borderRadius: 'var(--site-radius)',
          cursor: 'pointer',
          opacity: status === 'busy' ? 0.5 : 1,
        }}
      >
        {labels.send}
      </button>
      {status === 'error' && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--site-muted)' }}>{labels.error}</p>
      )}
    </form>
  )
}
