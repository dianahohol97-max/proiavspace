'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useLeadSubmit, type LeadFormLabels, type LeadStatus } from '../LeadForm'
import { EASE_OUT, useStill } from '../motion/useStill'
import tysha from './Tysha.module.css'

/** A theme's CSS-module class map with the same class names (default: «Тиша»). */
export type Skin = Record<string, string>

/** Event a pricing card fires so its «Обрати» pre-selects the shoot type. */
export const PACK_EVENT = 'tysha:pack'

/**
 * Form controls carry suppressHydrationWarning: password managers and
 * autofill extensions decorate inputs (style, data-*) before React hydrates,
 * which React reports as «Extra attributes from the server». It only silences
 * attribute differences on that one element, never its children or values.
 *
 * «Тиша» enquiry form: hairline fields with floating labels (real <label>s),
 * separate email / phone (at least one), shoot date and type. It posts the
 * same three fields as every other theme — date and type are folded into the
 * message — so the lead API and the dashboard stay untouched.
 *
 * In the editor preview and the theme demo (handle null) nothing is sent: the
 * form plays its sending → sent states so the animation can be seen.
 */
export function TyshaLeadForm({
  handle,
  labels,
  shootTypes,
  certificateTopic,
  skin,
}: {
  handle: string | null
  labels: LeadFormLabels
  /** Options for «Тип зйомки» (the pricing package names). */
  shootTypes: string[]
  /** The gift-certificate topic (from «Подарунки та друк»): choosing it shows
   *  «номінал або пакет», «кому», «від кого». */
  certificateTopic?: string
  /** Class names of another theme (e.g. «Опівніч»); defaults to «Тиша». */
  skin?: Skin
}) {
  const t = skin ?? tysha
  const still = useStill()
  const uid = useId()
  const { status: realStatus, send } = useLeadSubmit(handle)
  const [demoStatus, setDemoStatus] = useState<LeadStatus>('idle')
  const status = handle ? realStatus : demoStatus
  const [hasEmail, setHasEmail] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [shootType, setShootType] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const other = labels.shootOther ?? 'Інше'
  const options = shootTypes.length > 0 ? [...shootTypes, other] : []

  const isCertificate = !!certificateTopic && shootType === certificateTopic

  // «Обрати» on a pricing card / «Замовити» on a gift card → that topic here.
  useEffect(() => {
    const onPack = (event: Event) => {
      const name = (event as CustomEvent<string>).detail
      if (typeof name === 'string' && shootTypes.includes(name)) setShootType(name)
    }
    window.addEventListener(PACK_EVENT, onPack)
    return () => window.removeEventListener(PACK_EVENT, onPack)
  }, [shootTypes])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const get = (key: string) => String(data.get(key) ?? '').trim()
    const contact = [get('phone'), get('email')].filter(Boolean).join(' · ')
    const date = get('date')
    const type = get('type')
    const details = [
      date ? `${labels.date ?? 'Дата'}: ${formatDate(date)}` : '',
      type ? `${labels.shootType ?? 'Тип'}: ${type}` : '',
      ...(isCertificate
        ? [
            get('cert_nominal') ? `${labels.certNominal ?? 'Номінал'}: ${get('cert_nominal')}` : '',
            get('cert_to') ? `${labels.certTo ?? 'Кому'}: ${get('cert_to')}` : '',
            get('cert_from') ? `${labels.certFrom ?? 'Від кого'}: ${get('cert_from')}` : '',
          ]
        : []),
    ].filter(Boolean)
    const message = [details.join('\n'), get('message')].filter(Boolean).join('\n\n')

    if (!handle) {
      setDemoStatus('busy')
      window.setTimeout(() => setDemoStatus('sent'), 900)
      return
    }
    await send({ name: get('name'), contact, message: message.slice(0, 2000) }, form)
  }

  const id = (name: string) => `${uid}-${name}`
  // `min` only after mount: the server's «today» may be another day than the
  // visitor's (time zones), which would be a hydration mismatch.
  const [today, setToday] = useState<string | undefined>(undefined)
  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === 'sent' ? (
        <m.div
          key="sent"
          className={t.sent}
          role="status"
          initial={still ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          <svg className={t.sentMark} viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <m.circle
              cx="32"
              cy="32"
              r="30"
              stroke="currentColor"
              strokeWidth="1"
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: EASE_OUT }}
            />
            <m.path
              d="M21 33.5l7.5 7.5L44 25"
              stroke="currentColor"
              strokeWidth="1.2"
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: still ? 0 : 0.6 }}
            />
          </svg>
          <p className={t.sentText}>{labels.sent}</p>
        </m.div>
      ) : (
        <m.form
          key="form"
          ref={formRef}
          className={t.form}
          onSubmit={submit}
          exit={still ? undefined : { opacity: 0, y: -12, transition: { duration: 0.4 } }}
          aria-busy={status === 'busy'}
        >
          <div className={`${t.field} ${t.formFull}`}>
            <input
              suppressHydrationWarning
              id={id('name')}
              name="name"
              className={t.input}
              required
              maxLength={120}
              autoComplete="name"
              placeholder=" "
            />
            <label htmlFor={id('name')} className={t.floatLabel}>
              {labels.name}
            </label>
          </div>
          <div className={t.field}>
            <input
              suppressHydrationWarning
              id={id('email')}
              name="email"
              type="email"
              inputMode="email"
              className={t.input}
              required={!hasPhone}
              maxLength={120}
              autoComplete="email"
              placeholder=" "
              onInput={(e) => setHasEmail(e.currentTarget.value.trim() !== '')}
            />
            <label htmlFor={id('email')} className={t.floatLabel}>
              {labels.email ?? 'Email'}
            </label>
          </div>
          <div className={t.field}>
            <input
              suppressHydrationWarning
              id={id('phone')}
              name="phone"
              type="tel"
              inputMode="tel"
              className={t.input}
              required={!hasEmail}
              maxLength={40}
              autoComplete="tel"
              placeholder=" "
              onInput={(e) => setHasPhone(e.currentTarget.value.trim() !== '')}
            />
            <label htmlFor={id('phone')} className={t.floatLabel}>
              {labels.phone ?? labels.contact}
            </label>
          </div>
          <div className={t.field}>
            <input
              suppressHydrationWarning
              id={id('date')}
              name="date"
              type="date"
              min={today}
              className={t.input}
              autoComplete="off"
            />
            <label htmlFor={id('date')} className={`${t.floatLabel} ${t.floatLabelUp}`}>
              {labels.date ?? 'Дата'}
            </label>
          </div>
          <div className={t.field}>
            {options.length > 0 ? (
              <select
                suppressHydrationWarning
                id={id('type')}
                name="type"
                className={t.input}
                value={shootType}
                onChange={(e) => setShootType(e.target.value)}
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                suppressHydrationWarning
                id={id('type')}
                name="type"
                className={t.input}
                maxLength={80}
                placeholder=" "
              />
            )}
            <label
              htmlFor={id('type')}
              className={`${t.floatLabel} ${options.length > 0 ? t.floatLabelUp : ''}`}
            >
              {labels.shootType ?? 'Тип зйомки'}
            </label>
          </div>
          {isCertificate &&
            (['cert_nominal', 'cert_to', 'cert_from'] as const).map((name) => (
              <div key={name} className={`${t.field} ${name === 'cert_nominal' ? t.formFull : ''}`}>
                <input
                  suppressHydrationWarning
                  id={id(name)}
                  name={name}
                  className={t.input}
                  maxLength={120}
                  placeholder=" "
                  list={name === 'cert_nominal' ? id('packs') : undefined}
                />
                <label htmlFor={id(name)} className={t.floatLabel}>
                  {name === 'cert_nominal'
                    ? (labels.certNominal ?? 'Номінал або пакет')
                    : name === 'cert_to'
                      ? (labels.certTo ?? 'Кому')
                      : (labels.certFrom ?? 'Від кого')}
                </label>
              </div>
            ))}
          {isCertificate && (
            <datalist id={id('packs')}>
              {shootTypes
                .filter((o) => o !== certificateTopic)
                .map((o) => (
                  <option key={o} value={o} />
                ))}
            </datalist>
          )}
          <div className={`${t.field} ${t.formFull}`}>
            <textarea
              suppressHydrationWarning
              id={id('message')}
              name="message"
              rows={3}
              maxLength={1800}
              className={t.input}
              placeholder=" "
            />
            <label htmlFor={id('message')} className={t.floatLabel}>
              {labels.message}
            </label>
          </div>
          {labels.contactHint && <p className={`${t.formHint} ${t.formFull}`}>{labels.contactHint}</p>}
          <div className={`${t.formActions} ${t.formFull}`}>
            <button type="submit" className={t.submit} disabled={status === 'busy'}>
              {status === 'busy' ? (labels.sending ?? labels.send) : labels.send}
              <span className={t.arrow} aria-hidden="true">
                →
              </span>
              {status === 'busy' && !still && (
                <m.span
                  className={t.submitProgress}
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 0.9 }}
                  transition={{ duration: 2.4, ease: EASE_OUT }}
                />
              )}
            </button>
            {status === 'error' && (
              <p className={t.formError} role="alert">
                {labels.error}
              </p>
            )}
          </div>
        </m.form>
      )}
    </AnimatePresence>
  )
}

/** 2026-06-14 → 14.06.2026 (how photographers read dates in a message). */
function formatDate(iso: string): string {
  const [y, mo, d] = iso.split('-')
  return y && mo && d ? `${d}.${mo}.${y}` : iso
}
