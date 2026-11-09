'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import qrcode from 'qrcode-generator'
import { copyText } from '@/lib/clipboard'
import { localeNames, locales, type Locale } from '@/lib/i18n/config'
import {
  galleryShareUrl,
  shareMessage,
  shareSubject,
  shareTargets,
  type ShareMessageStrings,
} from '@/lib/gallery/share'

export interface ShareLabels {
  share: string
  shareTitle: string
  shareDraft: string
  sharePublish: string
  sharePublishing: string
  sharePublished: string
  sharePublishError: string
  shareLinkLabel: string
  shareLangLabel: string
  shareLangHint: string
  shareCopy: string
  shareCopied: string
  shareQr: string
  shareQrHint: string
  shareQrDownload: string
  shareMessageLabel: string
  shareMessageHint: string
  shareVia: string
  shareEmail: string
  shareMore: string
  shareCopyMessage: string
  sharePasswordReminder: string
  shareClose: string
}

/** Any button on the page can open the dialog: window.dispatchEvent(new Event(SHARE_EVENT)). */
export const SHARE_EVENT = 'proiav:share-gallery'

/** A crisp SVG QR (one path), dark modules on white with a quiet zone. */
function qrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text, 'Byte')
  qr.make()
  const count = qr.getModuleCount()
  const margin = 4
  const size = count + margin * 2
  let path = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`
}

/**
 * «Поділитися»: one window with everything needed to send the gallery —
 * the link (copy), the client's language, a QR code, ready-made messages for
 * Telegram / Viber / WhatsApp / email in that language, and a reminder about
 * the password. A draft gallery offers «Опублікувати» first: the link would
 * not open otherwise. On phones the window is a bottom sheet.
 */
export function ShareDialog({
  slug,
  appUrl,
  title,
  isPublished,
  hasPassword,
  inProgress,
  defaultLocale,
  messages,
  labels,
  publish,
  rememberLocale,
  variant = 'primary',
  initialOpen = false,
}: {
  slug: string
  appUrl: string
  title: string
  isPublished: boolean
  hasPassword: boolean
  /** The client will see the shoot-status screen (photos still in editing). */
  inProgress: boolean
  defaultLocale: Locale
  messages: Record<Locale, ShareMessageStrings>
  labels: ShareLabels
  publish: () => Promise<void>
  /** Saves the picked link language — «Ваші фото готові» goes in it (0072). */
  rememberLocale?: (locale: Locale) => Promise<unknown>
  variant?: 'primary' | 'compact'
  /** ?share=1 — opened straight from the gallery list. */
  initialOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [published, setPublished] = useState(isPublished)
  const [publishState, setPublishState] = useState<'idle' | 'done' | 'error'>('idle')
  const [pending, startTransition] = useTransition()
  const [lang, setLang] = useState<Locale>(defaultLocale)
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => setPublished(isPublished), [isPublished])
  useEffect(() => setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(SHARE_EVENT, onOpen)
    return () => window.removeEventListener(SHARE_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  const url = galleryShareUrl(appUrl, lang, slug)
  const template = useMemo(
    () => shareMessage(messages[lang], { title, url, hasPassword, inProgress }),
    [messages, lang, title, url, hasPassword, inProgress]
  )
  const [message, setMessage] = useState(template)
  // A new language (or link) rewrites the message in that language.
  useEffect(() => setMessage(template), [template])
  const targets = shareTargets(message, url, shareSubject(messages[lang], title))
  const svg = useMemo(() => (open ? qrSvg(url) : ''), [open, url])

  async function copy(kind: 'link' | 'text') {
    await copyText(kind === 'link' ? url : message)
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
  }

  function doPublish() {
    setPublishState('idle')
    startTransition(async () => {
      try {
        await publish()
        setPublished(true)
        setPublishState('done')
        router.refresh()
      } catch {
        setPublishState('error')
      }
    })
  }

  function downloadQr() {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `qr-${slug}.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const channel =
    'flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-bold text-fg no-underline transition-colors hover:border-fg'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="share-open"
        className={
          variant === 'primary'
            ? 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent-deep'
            : 'rounded-full border border-line px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-fg'
        }
      >
        <span aria-hidden>↗</span> {labels.share}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label={labels.shareClose}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-neutral-950/40"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            tabIndex={-1}
            data-testid="share-dialog"
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-bg shadow-2xl outline-none sm:max-w-2xl sm:rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-4 sm:px-6">
              <h2 id="share-title" className="min-w-0 flex-1 truncate font-brand text-xl">
                {labels.shareTitle}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.shareClose}
                className="grid h-10 w-10 flex-none place-items-center rounded-full border border-line text-fg hover:border-fg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
              {!published && (
                <div data-testid="share-draft" className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                  <p>{labels.shareDraft}</p>
                  <button
                    type="button"
                    onClick={doPublish}
                    disabled={pending}
                    className="mt-3 min-h-[44px] rounded-full bg-fg px-5 py-2 text-sm font-bold text-bg disabled:opacity-60"
                  >
                    {pending ? labels.sharePublishing : labels.sharePublish}
                  </button>
                  {publishState === 'error' && (
                    <p role="alert" className="mt-2 font-semibold text-red-700">
                      {labels.sharePublishError}
                    </p>
                  )}
                </div>
              )}
              {published && publishState === 'done' && (
                <p role="status" className="rounded-2xl bg-emerald-600/10 px-4 py-3 text-sm font-bold text-emerald-800">
                  {labels.sharePublished}
                </p>
              )}

              <section className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label htmlFor="share-lang" className="text-sm font-bold text-fg">
                    {labels.shareLangLabel}
                  </label>
                  <select
                    id="share-lang"
                    value={lang}
                    onChange={(event) => {
                      const next = event.target.value as Locale
                      setLang(next)
                      rememberLocale?.(next).catch(() => null)
                    }}
                    className="min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm font-semibold"
                  >
                    {locales.map((code) => (
                      <option key={code} value={code}>
                        {localeNames[code]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted">{labels.shareLangHint}</p>
              </section>

              <section className="flex flex-col gap-2">
                <label htmlFor="share-url" className="text-sm font-bold text-fg">
                  {labels.shareLinkLabel}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="share-url"
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => copy('link')}
                    data-testid="share-copy"
                    className="min-h-[44px] rounded-xl bg-fg px-5 text-sm font-bold text-bg"
                  >
                    {copied === 'link' ? labels.shareCopied : labels.shareCopy}
                  </button>
                </div>
                {hasPassword && (
                  <p data-testid="share-password" className="rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-fg">
                    🔒 {labels.sharePasswordReminder}
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <span className="text-sm font-bold text-fg">{labels.shareVia}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <a className={channel} href={targets.telegram} target="_blank" rel="noopener noreferrer" data-channel="telegram">
                    Telegram
                  </a>
                  <a className={channel} href={targets.viber} data-channel="viber">
                    Viber
                  </a>
                  <a className={channel} href={targets.whatsapp} target="_blank" rel="noopener noreferrer" data-channel="whatsapp">
                    WhatsApp
                  </a>
                  <a className={channel} href={targets.email} data-channel="email">
                    {labels.shareEmail}
                  </a>
                </div>
                {canNativeShare && (
                  <button
                    type="button"
                    className={channel}
                    onClick={() => navigator.share({ title, text: message }).catch(() => {})}
                  >
                    {labels.shareMore}
                  </button>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <label htmlFor="share-message" className="text-sm font-bold text-fg">
                  {labels.shareMessageLabel}
                </label>
                <textarea
                  id="share-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copy('text')}
                    className="min-h-[40px] rounded-full border border-line bg-white px-4 text-sm font-bold text-fg hover:border-fg"
                  >
                    {copied === 'text' ? labels.shareCopied : labels.shareCopyMessage}
                  </button>
                  <span className="text-xs text-muted">{labels.shareMessageHint}</span>
                </div>
              </section>

              <section className="flex items-center gap-4 rounded-2xl bg-white p-4">
                <div
                  data-testid="share-qr"
                  role="img"
                  aria-label={`${labels.shareQr}: ${url}`}
                  className="h-28 w-28 flex-none sm:h-32 sm:w-32"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-fg">{labels.shareQr}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{labels.shareQrHint}</p>
                  <button
                    type="button"
                    onClick={downloadQr}
                    className="mt-2 min-h-[40px] rounded-full border border-line px-4 text-sm font-bold text-fg hover:border-fg"
                  >
                    {labels.shareQrDownload}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Opens the page's ShareDialog from anywhere (hints, empty states). */
export function OpenShareButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(SHARE_EVENT))} className={className}>
      {label}
    </button>
  )
}
