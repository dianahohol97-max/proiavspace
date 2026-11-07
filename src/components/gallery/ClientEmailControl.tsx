'use client'

import { useState } from 'react'
import type { ClientEmailSaveResult } from '@/lib/actions/client-email'
import type { ReadyEmailResult } from '@/lib/gallery/ready-email'

export interface ClientEmailLabels {
  title: string
  hint: string
  label: string
  consent: string
  save: string
  remove: string
  saving: string
  saved: string
  invalid: string
  needConsent: string
  error: string
  unavailable: string
  sentAt: string
  waitReady: string
  waitPublish: string
  sendAgain: string
  sendNow: string
  sending: string
  sent: string
  tooSoon: string
  sendFailed: string
}

/**
 * «Лист клієнтові» (0064) under the shoot status: the client's address
 * (optional; saved only with the «клієнт погодився» tick), what happens next
 * («піде, щойно статус стане Готово» / «надіслано 7.11 о 14:05») and
 * «Надіслати ще раз». Status, publication and «sent at» come from the server
 * props, which refresh after every action (revalidatePath).
 */
export function ClientEmailControl({
  available,
  initialEmail,
  sentAtText,
  isReady,
  isPublished,
  save,
  sendAgain: sendAgainAction,
  labels,
}: {
  available: boolean
  initialEmail: string | null
  /** Already formatted «07.11.2026, 14:05», or null when never sent. */
  sentAtText: string | null
  isReady: boolean
  isPublished: boolean
  save: (email: string, consent: boolean) => Promise<ClientEmailSaveResult>
  sendAgain: () => Promise<ReadyEmailResult>
  labels: ClientEmailLabels
}) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [consent, setConsent] = useState(!!initialEmail)
  const [saved, setSaved] = useState(initialEmail ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | string>('idle')
  const [sendState, setSendState] = useState<'idle' | 'sending' | ReadyEmailResult>('idle')

  if (!available) {
    return (
      <section className="mt-10" data-testid="client-email">
        <h2 className="font-display text-2xl">{labels.title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{labels.unavailable}</p>
      </section>
    )
  }

  async function submit(nextEmail: string, nextConsent: boolean) {
    setSaveState('saving')
    let result: ClientEmailSaveResult
    try {
      result = await save(nextEmail, nextConsent)
    } catch {
      result = { ok: false, error: 'failed' }
    }
    if (result.ok) {
      setSaved(nextEmail.trim())
      setSaveState('saved')
      return
    }
    setSaveState(
      result.error === 'invalid'
        ? labels.invalid
        : result.error === 'consent'
          ? labels.needConsent
          : result.error === 'unavailable'
            ? labels.unavailable
            : labels.error
    )
  }

  async function sendAgain() {
    setSendState('sending')
    try {
      setSendState(await sendAgainAction())
    } catch {
      setSendState('send_failed')
    }
  }

  const dirty = email.trim() !== saved
  const canSend = !!saved && !dirty && isReady && isPublished
  const status = !saved
    ? null
    : sentAtText
      ? labels.sentAt.replace('{date}', sentAtText)
      : !isReady
        ? labels.waitReady
        : !isPublished
          ? labels.waitPublish
          : null
  const sendMessage =
    sendState === 'sending'
      ? labels.sending
      : sendState === 'sent'
        ? labels.sent
        : sendState === 'too_soon'
          ? labels.tooSoon
          : sendState === 'idle'
            ? ''
            : labels.sendFailed

  return (
    <section className="mt-10" data-testid="client-email">
      <h2 className="font-display text-2xl">{labels.title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{labels.hint}</p>

      <form
        className="mt-5 flex max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit(email, consent)
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{labels.label}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setSaveState('idle')
            }}
            placeholder="client@example.com"
            className="min-h-[48px] rounded-xl border border-line bg-transparent px-3 py-2 text-base outline-none focus:border-fg"
            data-testid="client-email-input"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1"
            data-testid="client-email-consent"
          />
          <span>{labels.consent}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!email.trim() || saveState === 'saving'}
            className="min-h-[44px] border border-fg px-5 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-40"
          >
            {labels.save}
          </button>
          {saved && (
            <button
              type="button"
              onClick={() => {
                setEmail('')
                setConsent(false)
                void submit('', false)
              }}
              className="text-sm text-muted underline hover:text-fg"
            >
              {labels.remove}
            </button>
          )}
        </div>
        <p
          className={`min-h-[1.25rem] text-sm ${
            saveState === 'idle' || saveState === 'saving' || saveState === 'saved' ? 'text-muted' : 'text-accent'
          }`}
          role="status"
          aria-live="polite"
        >
          {saveState === 'saving' ? labels.saving : saveState === 'saved' ? labels.saved : saveState === 'idle' ? '' : saveState}
        </p>
      </form>

      {saved && (
        <div className="mt-2 flex max-w-xl flex-col gap-3">
          {status && (
            <p className="text-sm text-muted" data-testid="client-email-status">
              {status}
            </p>
          )}
          {canSend && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void sendAgain()}
                disabled={sendState === 'sending'}
                className="min-h-[44px] border border-line px-5 py-2 text-sm uppercase tracking-widest text-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-40"
                data-testid="client-email-send-again"
              >
                {sentAtText ? labels.sendAgain : labels.sendNow}
              </button>
              <span
                className={`text-sm ${sendState === 'sent' || sendState === 'sending' ? 'text-muted' : 'text-accent'}`}
                role="status"
                aria-live="polite"
              >
                {sendMessage}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
