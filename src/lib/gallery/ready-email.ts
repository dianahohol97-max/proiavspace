import { renderHtml, renderText } from '@/lib/email-layout'
import type { EmailInput } from '@/lib/email'

/**
 * Лист клієнтові «Ваші фото готові» (galleries.client_email /
 * ready_email_sent_at, migration 0066). The rules, in one place:
 *
 *   - automatic: when the shoot status becomes «Готово» (or a «Готово»
 *     gallery gets published) and the photographer gave the client's address
 *     — exactly once per gallery: ready_email_sent_at is claimed atomically
 *     BEFORE sending, so two saves in a row (two tabs, a double click) send
 *     one letter; a failed send releases the claim;
 *   - manual «Надіслати ще раз»: any time the gallery is published, «Готово»
 *     and has an address, but not twice within a minute (double click);
 *   - never to an unpublished gallery (the link would be a 404).
 *
 * Storage and e-mail are injected (ReadyEmailDeps) so the audit tests drive
 * the real logic without Supabase or Brevo.
 */

export interface ReadyEmailGallery {
  id: string
  title: string
  slug: string
  is_published: boolean
  has_password: boolean
  delivery_status: string | null
  client_email: string | null
  ready_email_sent_at: string | null
}

export interface ReadyEmailDeps {
  /** The owner's gallery (null when it isn't theirs / doesn't exist). */
  load(galleryId: string, ownerId: string): Promise<ReadyEmailGallery | null>
  /**
   * Sets ready_email_sent_at = at only where it still equals `expected`
   * (NULL for the automatic letter); true if this call won. Compare-and-set,
   * so two concurrent saves / clicks send one letter.
   */
  claim(galleryId: string, expected: string | null, at: string): Promise<boolean>
  /** Puts back the previous value, only if the column still holds `at`. */
  release(galleryId: string, at: string, previous: string | null): Promise<void>
  send(input: EmailInput): Promise<boolean>
  appUrl: string
  /** Photographer's public name and address (Reply-To). */
  photographer: { name: string | null; email: string | null }
  now?: () => Date
}

export type ReadyEmailResult =
  | 'sent'
  | 'already_sent'
  | 'no_email'
  | 'not_ready'
  | 'not_published'
  | 'not_found'
  | 'too_soon'
  | 'send_failed'

/** Minimum gap between two letters for the same gallery (manual «send again»). */
export const SEND_AGAIN_GAP_MS = 60 * 1000

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Trimmed address, or null for empty / invalid / too long (matches the 0066 check). */
export function parseClientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null
  return email
}

export function galleryClientUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, '')}/uk/g/${slug}`
}

export function readyEmailMessage(input: {
  galleryTitle: string
  url: string
  photographerName: string | null
  hasPassword: boolean
}): { subject: string; text: string; html: string } {
  const subject = `Ваші фото готові — ${input.galleryTitle}`
  const name = input.photographerName?.trim() || null
  const lead = [`Фото готові: галерея «${input.galleryTitle}» вже відкрита — можна дивитися, обирати улюблені й завантажувати.`]
  if (input.hasPassword) {
    lead.push('Галерея захищена паролем — фотограф надішле його окремо, якщо ще не надіслав.')
  }
  const doc = {
    greeting: 'Вітаємо!',
    lead,
    rows: name ? ([['Фотограф', name]] as [string, string][]) : undefined,
    button: { label: 'Відкрити галерею', url: input.url },
    after: [
      'Лист надіслано, бо фотограф вказав вашу адресу для повідомлення про готовність фото. Якщо відповісте на нього — відповідь отримає фотограф.',
    ],
  }
  return { subject, text: renderText(doc), html: renderHtml(doc, subject) }
}

async function sendLetter(deps: ReadyEmailDeps, gallery: ReadyEmailGallery & { client_email: string }) {
  const message = readyEmailMessage({
    galleryTitle: gallery.title,
    url: galleryClientUrl(deps.appUrl, gallery.slug),
    photographerName: deps.photographer.name,
    hasPassword: gallery.has_password,
  })
  return deps.send({
    to: gallery.client_email,
    ...message,
    ...(deps.photographer.email ? { replyTo: deps.photographer.email } : {}),
  })
}

function precheck(gallery: ReadyEmailGallery | null): ReadyEmailResult | null {
  if (!gallery) return 'not_found'
  if (gallery.delivery_status !== 'ready') return 'not_ready'
  if (!gallery.client_email) return 'no_email'
  if (!gallery.is_published) return 'not_published'
  return null
}

/** Automatic letter: at most once per gallery. */
export async function sendReadyEmailOnce(
  deps: ReadyEmailDeps,
  galleryId: string,
  ownerId: string
): Promise<ReadyEmailResult> {
  const gallery = await deps.load(galleryId, ownerId)
  const blocked = precheck(gallery)
  if (blocked) return blocked
  const g = gallery as ReadyEmailGallery & { client_email: string }
  if (g.ready_email_sent_at) return 'already_sent'

  const at = (deps.now?.() ?? new Date()).toISOString()
  if (!(await deps.claim(g.id, null, at))) return 'already_sent'
  const ok = await sendLetter(deps, g).catch(() => false)
  if (!ok) {
    await deps.release(g.id, at, null)
    return 'send_failed'
  }
  return 'sent'
}

/** «Надіслати ще раз»: by hand, any number of times, not twice a minute. */
export async function sendReadyEmailAgain(
  deps: ReadyEmailDeps,
  galleryId: string,
  ownerId: string
): Promise<ReadyEmailResult> {
  const gallery = await deps.load(galleryId, ownerId)
  const blocked = precheck(gallery)
  if (blocked) return blocked
  const g = gallery as ReadyEmailGallery & { client_email: string }
  const now = deps.now?.() ?? new Date()
  if (g.ready_email_sent_at && now.getTime() - new Date(g.ready_email_sent_at).getTime() < SEND_AGAIN_GAP_MS) {
    return 'too_soon'
  }
  const at = now.toISOString()
  if (!(await deps.claim(g.id, g.ready_email_sent_at, at))) return 'too_soon'
  const ok = await sendLetter(deps, g).catch(() => false)
  if (!ok) {
    await deps.release(g.id, at, g.ready_email_sent_at)
    return 'send_failed'
  }
  return 'sent'
}
