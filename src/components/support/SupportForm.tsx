'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import {
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_TOPICS,
  isSupportFileType,
  type SupportClientContext,
  type SupportTopic,
} from '@/lib/support/config'

export const SUPPORT_MAILTO = 'hello@proiav.space'

export type SupportAccount = { email: string; userId: string; plan: string }

type T = Dictionary['support']

const ERRORS: Record<string, keyof T> = {
  empty_message: 'errorEmpty',
  message_too_long: 'errorTooLong',
  invalid_email: 'errorEmail',
  file_type: 'errorFileType',
  file_size: 'errorFileSize',
  invalid_files: 'errorTooManyFiles',
  rate_limited: 'errorRateLimit',
}

function readContext(locale: string): SupportClientContext {
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    language: locale,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    time: new Date().toString(),
  }
}

/**
 * The one support form: the dashboard panel (signed in — account email, id
 * and plan go along) and the public /contact page (email field + honeypot).
 * Screenshots go straight to the private bucket via presigned PUTs.
 */
export function SupportForm({
  locale,
  t,
  account,
  onClose,
}: {
  locale: string
  t: T
  /** Signed in: no email field, and these go along with the message. */
  account?: SupportAccount
  /** In the panel: a «Закрити» button after sending. */
  onClose?: () => void
}) {
  const [topic, setTopic] = useState<SupportTopic>('question')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'sending'>('idle')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [context, setContext] = useState<SupportClientContext | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => setContext(readContext(locale)), [locale])

  const topicLabel: Record<SupportTopic, string> = {
    bug: t.topicBug,
    question: t.topicQuestion,
    billing: t.topicBilling,
    idea: t.topicIdea,
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    setError(null)
    const next = [...files]
    for (const file of Array.from(list)) {
      if (!isSupportFileType(file.type)) return setError(t.errorFileType)
      if (file.size > SUPPORT_MAX_FILE_BYTES) return setError(t.errorFileSize)
      if (next.length >= SUPPORT_MAX_FILES) return setError(t.errorTooManyFiles)
      next.push(file)
    }
    setFiles(next)
  }

  async function uploadFiles(): Promise<string[]> {
    if (!files.length) return []
    setPhase('uploading')
    const res = await fetch('/api/support/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ type: f.type, size: f.size })) }),
    })
    const data = (await res.json().catch(() => ({}))) as { uploads?: { key: string; url: string }[]; error?: string }
    if (!res.ok || !data.uploads) throw new Error(data.error ?? 'upload')
    await Promise.all(
      data.uploads.map(async (u, i) => {
        const put = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] })
        if (!put.ok) throw new Error('upload')
      })
    )
    return data.uploads.map((u) => u.key)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const text = message.trim()
    if (!text) return setError(t.errorEmpty)
    if (text.length > SUPPORT_MESSAGE_MAX) return setError(t.errorTooLong)
    if (!account && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.errorEmail)

    try {
      const attachments = await uploadFiles()
      setPhase('sending')
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          message: text,
          email: account ? undefined : email.trim(),
          website,
          attachments,
          locale,
          context: readContext(locale),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; email?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'send')
      setSentTo(data.email ?? account?.email ?? email.trim())
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(t[ERRORS[code] ?? 'errorGeneric'])
    } finally {
      setPhase('idle')
    }
  }

  function reset() {
    setSentTo(null)
    setMessage('')
    setFiles([])
    setTopic('question')
  }

  if (sentTo) {
    return (
      <div data-testid="support-thanks" className="flex flex-col gap-3" role="status">
        <p className="text-lg font-bold text-fg">{t.thanks.replace('{email}', sentTo)}</p>
        <p className="text-sm text-muted">{t.thanksNote}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-full border border-line px-5 py-2 text-sm font-bold text-fg">
            {t.another}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-full bg-fg px-5 py-2 text-sm font-bold text-bg">
              {t.close}
            </button>
          )}
        </div>
      </div>
    )
  }

  const busy = phase !== 'idle'
  const contextRows: [string, string][] = context
    ? [
        ...(account
          ? ([
              [t.ctxEmail, account.email],
              [t.ctxUser, account.userId],
              [t.ctxPlan, account.plan],
            ] as [string, string][])
          : []),
        [t.ctxUrl, context.url],
        [t.ctxBrowser, context.userAgent],
        [t.ctxLanguage, context.language],
        [t.ctxViewport, context.viewport],
        [t.ctxTime, context.time],
      ]
    : []

  return (
    <form data-testid="support-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-fg">{t.topicLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_TOPICS.map((id) => (
            <label
              key={id}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                topic === id ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name="topic"
                value={id}
                checked={topic === id}
                onChange={() => setTopic(id)}
                className="sr-only"
              />
              {topicLabel[id]}
            </label>
          ))}
        </div>
      </fieldset>

      {!account && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-fg">{t.emailLabel}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-fg"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-fg">{t.messageLabel}</span>
        <textarea
          data-testid="support-message"
          name="message"
          required
          rows={6}
          maxLength={SUPPORT_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.messagePlaceholder}
          className="resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-fg"
        />
        <span className="self-end text-xs text-muted">
          {message.length} / {SUPPORT_MESSAGE_MAX}
        </span>
      </label>

      {/* Honeypot: hidden from people and screen readers, bots fill it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-fg">{t.filesLabel}</span>
        <span className="text-xs text-muted">{t.filesHint}</span>
        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="flex-none text-xs font-bold text-muted underline hover:text-fg"
                >
                  {t.fileRemove}
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < SUPPORT_MAX_FILES && (
          <>
            <input
              ref={fileInput}
              data-testid="support-files"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="self-start rounded-full border border-dashed border-line px-4 py-2 text-sm font-semibold text-muted hover:text-fg"
            >
              + {t.filesAdd}
            </button>
          </>
        )}
      </div>

      <div className="text-xs leading-5 text-muted">
        <p>{account ? t.contextNote : t.contextNotePublic}</p>
        {contextRows.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer font-semibold underline">{t.contextShow}</summary>
            <dl data-testid="support-context" className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              {contextRows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="whitespace-nowrap">{k}</dt>
                  <dd className="min-w-0 break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>

      {error && (
        <p role="alert" data-testid="support-error" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        data-testid="support-submit"
        disabled={busy}
        className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
      >
        {phase === 'uploading' ? t.uploading : phase === 'sending' ? t.sending : t.send}
      </button>

      <p className="text-sm text-muted">
        {t.mailLead}{' '}
        <a href={`mailto:${SUPPORT_MAILTO}`} className="font-semibold text-fg underline">
          {SUPPORT_MAILTO}
        </a>
      </p>
    </form>
  )
}
