import { locales, type Locale } from '@/lib/i18n/config'

/**
 * «Поділитися» — pure helpers for the share dialog (link, ready-made client
 * message, messenger links). The message is written in the LINK's language,
 * i.e. the client's, not the photographer's dashboard language.
 */

export interface ShareMessageStrings {
  shareReady: string
  shareInProgress: string
  sharePassword: string
  shareSubject: string
}

export function galleryShareUrl(appUrl: string, locale: Locale, slug: string): string {
  return `${appUrl.replace(/\/+$/, '')}/${locale}/g/${slug}`
}

export function shareLocaleOrDefault(value: string | null | undefined, fallback: Locale): Locale {
  return (locales as readonly string[]).includes(value ?? '') ? (value as Locale) : fallback
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/**
 * The text the client receives. `inProgress` — the client will see the shoot
 * status screen, not photos yet, so the message says the gallery fills in at
 * the same link. A password is never put in the message: only a note that it
 * comes separately.
 */
export function shareMessage(
  strings: ShareMessageStrings,
  options: { title: string; url: string; hasPassword: boolean; inProgress: boolean }
): string {
  const body = fill(options.inProgress ? strings.shareInProgress : strings.shareReady, {
    title: options.title,
    url: options.url,
  })
  return options.hasPassword ? `${body}\n${strings.sharePassword}` : body
}

export function shareSubject(strings: ShareMessageStrings, title: string): string {
  return fill(strings.shareSubject, { title })
}

export interface ShareTargets {
  telegram: string
  viber: string
  whatsapp: string
  email: string
}

/**
 * Messenger deep links. Telegram takes the URL separately (it builds a link
 * preview from it), so the URL is cut out of its text to avoid a duplicate.
 */
export function shareTargets(message: string, url: string, subject: string): ShareTargets {
  const enc = encodeURIComponent
  const telegramText = message.replace(url, '').replace(/[ \t]*\n[ \t]*\n+/g, '\n').replace(/[:\s]+$/, '').trim()
  return {
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(telegramText)}`,
    viber: `viber://forward?text=${enc(message)}`,
    whatsapp: `https://wa.me/?text=${enc(message)}`,
    email: `mailto:?subject=${enc(subject)}&body=${enc(message)}`,
  }
}
