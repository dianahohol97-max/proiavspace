import type { CSSProperties } from 'react'
import { LangPicker } from '@/components/LangPicker'
import { deliveryPalette, deliveryStep } from '@/lib/gallery/delivery'
import { fontFamily, type GalleryStyle } from '@/lib/gallery/style'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { resolveTokens, type SiteMode, type ThemeId } from '@/lib/site/themes'
import type { GalleryDeliveryStatus } from '@/lib/types'
import s from './DeliveryStatus.module.css'

export interface DeliveryLabels {
  title: string
  note: string
  /** «Орієнтовно до {date}» */
  eta: string
  steps: string
  stepShot: string
  stepEditing: string
  stepReady: string
  stepDone: string
  stepCurrent: string
  banner: string
  /** «орієнтовно до {date}» */
  bannerEta: string
  contact: string
  madeOn: string
}

/**
 * Accent for the status screen and banner: the photographer's override, else
 * the gallery theme's own accent («Опівніч» — flame gold, «Тиша» — ink), never
 * the platform cobalt/lavender. deliveryPalette() then lifts it to ≥ 4.5:1.
 */
export function deliveryAccent(theme: ThemeId, mode: SiteMode, style?: GalleryStyle): string {
  return style?.accent ?? resolveTokens(theme, mode).accent
}

/** CSS variables for the screen / banner in this gallery's own style. */
export function deliveryVars(theme: ThemeId, mode: SiteMode, style?: GalleryStyle): CSSProperties {
  const tokens = resolveTokens(theme, mode)
  const palette = deliveryPalette({ ...tokens, accent: deliveryAccent(theme, mode, style) })
  return {
    '--d-bg': palette.bg,
    '--d-fg': palette.fg,
    '--d-mut': palette.muted,
    '--d-accent': palette.accent,
    '--d-on-accent': palette.onAccent,
    '--d-surface': palette.surface,
    '--d-line': palette.line,
    '--d-display': fontFamily(style?.font) ?? tokens.fontDisplay,
    '--d-body': fontFamily(style?.bodyFont) ?? tokens.fontBody,
    '--d-label': fontFamily(style?.bodyFont) ?? tokens.fontLabel,
    '--d-display-transform': tokens.displayTransform,
    '--d-display-weight': String(tokens.displayWeight),
    '--d-display-tracking': tokens.displayTracking,
  } as CSSProperties
}

/**
 * What the client sees at the gallery link while the shoot is still in
 * progress and no photos are visible yet: the shoot name, the photographer,
 * «Зйомка → Обробка → Готово» with the current step, the estimated date if
 * the photographer set one. No invented numbers, no promises.
 */
export function DeliveryStatusScreen({
  locale,
  title,
  brandName,
  logoUrl,
  coverUrl = null,
  status,
  etaText,
  contactUrl,
  showBadge,
  theme,
  mode,
  style,
  labels,
}: {
  locale: string
  title: string
  brandName: string | null
  logoUrl: string | null
  /**
   * The gallery cover (a light variant, never the original): shown behind
   * the content, softly blurred and washed in the theme's background. null →
   * the plain screen.
   */
  coverUrl?: string | null
  status: GalleryDeliveryStatus
  /** The ETA already formatted for the locale, or null. */
  etaText: string | null
  contactUrl: string | null
  showBadge: boolean
  theme: ThemeId
  mode: SiteMode
  style?: GalleryStyle
  labels: DeliveryLabels
}) {
  const current = deliveryStep(status)
  const steps = [labels.stepShot, labels.stepEditing, labels.stepReady]

  return (
    <main
      className={`${s.screen}${coverUrl ? ` ${s.withCover}` : ''}`}
      style={deliveryVars(theme, mode, style)}
      data-delivery="screen"
    >
      {coverUrl && (
        <div className={s.backdrop} aria-hidden data-delivery="cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.backdropImg} src={coverUrl} alt="" fetchPriority="high" />
          <div className={s.backdropWash} />
        </div>
      )}
      <div className={`${s.caps} ${s.lang}`}>
        <LangPicker current={isLocale(locale) ? locale : ('uk' as Locale)} />
      </div>
      <div className={s.inner}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName ?? ''} style={{ maxHeight: 40, width: 'auto', margin: '0 auto' }} />
        ) : (
          brandName && <p className={s.caps} style={{ margin: 0 }}>{brandName}</p>
        )}
        <h1 className={s.title}>{title}</h1>

        <div className={s.card}>
          <p className={s.warm}>{labels.title}</p>
          <ol className={s.steps} aria-label={labels.steps}>
            {steps.map((label, i) => {
              const past = i < current
              const now = i === current
              return (
                <li
                  key={label}
                  className={`${s.step}${past || now ? ` ${s.stepPast}` : ''}${now ? ` ${s.stepNow}` : ''}`}
                  aria-current={now ? 'step' : undefined}
                >
                  <span className={s.dot} aria-hidden>
                    {past ? '✓' : i + 1}
                  </span>
                  <span className={s.label}>
                    {label}
                    {(past || now) && (
                      <span className={s.srOnly}> — {past ? labels.stepDone : labels.stepCurrent}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
          {etaText && <p className={s.eta}>{labels.eta.replace('{date}', etaText)}</p>}
          <p className={s.note}>{labels.note}</p>
        </div>

        {contactUrl && (
          <a className={s.contact} href={contactUrl} target="_blank" rel="noopener noreferrer">
            {labels.contact}
          </a>
        )}
        {showBadge && (
          <div>
            <a className={s.badge} href={`/${locale}`}>
              {labels.madeOn}
            </a>
          </div>
        )}
      </div>
    </main>
  )
}

/** The small strip above a gallery that has only some previews so far. */
export function DeliveryBanner({
  text,
  etaText,
  vars,
}: {
  /** deliveryVars() of the gallery — the strip paints its own ground. */
  vars: CSSProperties
  /** «Повна галерея в обробці» */
  text: string
  /** «орієнтовно до 14 грудня 2026», or null. */
  etaText: string | null
}) {
  return (
    <div className={s.bannerWrap} style={vars}>
      <p className={s.banner} data-delivery="banner">
        <span className={s.bannerDot} aria-hidden />
        {text}
        {etaText && (
          <>
            {' · '}
            <span className={s.bannerEta}>{etaText}</span>
          </>
        )}
      </p>
    </div>
  )
}
