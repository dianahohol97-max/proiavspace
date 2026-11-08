/**
 * The support desk: validation, rate limits and delivery of one request.
 * Routes (src/app/api/support/…) only gather the request facts and the real
 * dependencies; everything decided here is testable with fakes
 * (tests/audit-storage/support.test.ts).
 *
 * Delivery order of truth: the letter to hello@proiav.space is what someone
 * reads, the support_requests row (migration 0069) is the archive. A request
 * counts as delivered when either one worked — so the form keeps working
 * before the migration is applied, and a failed insert only goes to Sentry.
 */

import { randomUUID } from 'node:crypto'
import { renderHtml, renderText, supportEmail, type EmailDoc } from '@/lib/email-layout'
import type { EmailInput } from '@/lib/email'
import {
  SUPPORT_ACCOUNT_PER_HOUR,
  SUPPORT_FILE_TYPES,
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_PUBLIC_PER_HOUR,
  SUPPORT_TOPIC_UK,
  isSupportFileType,
  isSupportTopic,
  type SupportTopic,
} from './config'
import { hashIp, type MemoryRateLimiter } from './rate-limit'

export type SupportSender =
  | { kind: 'account'; userId: string; email: string; plan: string | null }
  | { kind: 'public' }

/** The sender-facing copy of the confirmation letter (from the dictionary). */
export interface SupportCopy {
  copySubject: string
  copyGreeting: string
  copyLead: string
  copyTopic: string
  copyMessage: string
  copyAfter: string
  topics: Record<SupportTopic, string>
}

export interface SupportAttachment {
  key: string
  type: string
  size: number
}

export interface SupportRow {
  id: string
  user_id: string | null
  email: string
  topic: SupportTopic
  message: string
  context: Record<string, unknown>
  attachments: SupportAttachment[]
}

export interface SupportDeps {
  limiter: MemoryRateLimiter
  now: () => Date
  /**
   * Saved requests since `sinceIso` for this sender (support_requests);
   * null when the table is not there yet (migration 0069 not applied).
   */
  countRecent: (who: { userId: string } | { ipHash: string }, sinceIso: string) => Promise<number | null>
  head: (key: string) => Promise<{ sizeBytes: number; contentType: string | null } | null>
  signReadUrl: (key: string) => Promise<string>
  sendEmail: (input: EmailInput) => Promise<boolean>
  insert: (row: SupportRow) => Promise<{ error: unknown | null }>
  reportError: (error: unknown, context: Record<string, unknown>) => Promise<void>
}

export interface SupportResult {
  status: number
  body: Record<string, unknown>
}

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const EXT = '(?:png|jpg|webp)'

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value)
}

/** Where this sender's screenshots live (private bucket, never under u/). */
export function supportKeyPrefix(sender: SupportSender): string {
  return sender.kind === 'account' ? `support/${sender.userId}/` : 'support/public/'
}

function ownsKey(sender: SupportSender, key: string): boolean {
  const prefix = supportKeyPrefix(sender).replace(/[/]/g, '\\/')
  return new RegExp(`^${prefix}${UUID}\\.${EXT}$`).test(key)
}

function limitFor(sender: SupportSender): number {
  return sender.kind === 'account' ? SUPPORT_ACCOUNT_PER_HOUR : SUPPORT_PUBLIC_PER_HOUR
}

function limiterKey(sender: SupportSender, ip: string, scope: 'send' | 'upload'): string {
  return sender.kind === 'account' ? `${scope}:u:${sender.userId}` : `${scope}:ip:${hashIp(ip)}`
}

const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** Only the fields we promised to send, each a bounded string. */
function clientContext(raw: unknown): Record<string, string> {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    url: str(c.url, 1000),
    userAgent: str(c.userAgent),
    language: str(c.language, 20),
    viewport: str(c.viewport, 40),
    time: str(c.time, 60),
  }
}

// ---------------------------------------------------------------------------
// Uploads: presigned PUTs straight to the bucket (Vercel never proxies bytes,
// and its 4.5 MB body limit would not fit three 5 MB screenshots anyway).
// ---------------------------------------------------------------------------

export interface UploadDeps {
  limiter: MemoryRateLimiter
  getUploadUrl: (key: string, contentType: string, sizeBytes: number) => Promise<string>
}

export async function presignSupportUploads(
  body: unknown,
  sender: SupportSender,
  ip: string,
  deps: UploadDeps
): Promise<SupportResult> {
  const files = (body as { files?: unknown } | null)?.files
  if (!Array.isArray(files) || files.length === 0 || files.length > SUPPORT_MAX_FILES) {
    return { status: 400, body: { error: 'invalid_files' } }
  }
  for (const f of files as { type?: unknown; size?: unknown }[]) {
    if (!isSupportFileType(f?.type)) return { status: 400, body: { error: 'file_type' } }
    if (typeof f.size !== 'number' || !Number.isInteger(f.size) || f.size <= 0 || f.size > SUPPORT_MAX_FILE_BYTES) {
      return { status: 400, body: { error: 'file_size' } }
    }
  }
  // A few retries' worth of uploads per allowed request.
  const key = limiterKey(sender, ip, 'upload')
  if (deps.limiter.count(key) + files.length > limitFor(sender) * SUPPORT_MAX_FILES) {
    return { status: 429, body: { error: 'rate_limited' } }
  }
  const uploads = []
  for (const f of files as { type: string; size: number }[]) {
    deps.limiter.hit(key)
    const objectKey = `${supportKeyPrefix(sender)}${randomUUID()}.${SUPPORT_FILE_TYPES[f.type]}`
    uploads.push({ key: objectKey, url: await deps.getUploadUrl(objectKey, f.type, f.size) })
  }
  return { status: 200, body: { uploads } }
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export async function submitSupportRequest(
  body: unknown,
  sender: SupportSender,
  request: RequestFacts,
  deps: SupportDeps
): Promise<SupportResult> {
  if (typeof body !== 'object' || body === null) return { status: 400, body: { error: 'invalid_body' } }
  const b = body as Record<string, unknown>

  // Honeypot: people never see the «website» field; bots fill everything in.
  // Answer like a success so the bot has nothing to tune against.
  if (typeof b.website === 'string' && b.website.trim() !== '') {
    return { status: 200, body: { ok: true } }
  }

  if (!isSupportTopic(b.topic)) return { status: 400, body: { error: 'invalid_topic' } }
  const topic = b.topic
  const message = typeof b.message === 'string' ? b.message.trim() : ''
  if (!message) return { status: 400, body: { error: 'empty_message' } }
  if (message.length > SUPPORT_MESSAGE_MAX) return { status: 400, body: { error: 'message_too_long' } }

  let email: string
  if (sender.kind === 'account') {
    email = sender.email
  } else {
    email = typeof b.email === 'string' ? b.email.trim() : ''
    if (!isValidEmail(email)) return { status: 400, body: { error: 'invalid_email' } }
  }

  const keys = b.attachments ?? []
  if (!Array.isArray(keys) || keys.length > SUPPORT_MAX_FILES || !keys.every((k) => typeof k === 'string')) {
    return { status: 400, body: { error: 'invalid_attachments' } }
  }
  if (new Set(keys).size !== keys.length || !keys.every((k) => ownsKey(sender, k as string))) {
    return { status: 400, body: { error: 'invalid_attachments' } }
  }

  // Rate limit: this instance's memory, and the saved rows when the table exists.
  const now = deps.now()
  const ipHash = hashIp(request.ip)
  const memKey = limiterKey(sender, request.ip, 'send')
  const limit = limitFor(sender)
  if (deps.limiter.count(memKey, now.getTime()) >= limit) {
    return { status: 429, body: { error: 'rate_limited' } }
  }
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const saved = await deps
    .countRecent(sender.kind === 'account' ? { userId: sender.userId } : { ipHash }, since)
    .catch(() => null)
  if (saved !== null && saved >= limit) {
    return { status: 429, body: { error: 'rate_limited' } }
  }
  deps.limiter.hit(memKey, now.getTime())

  // Screenshots: trust what the bucket stored, not what the browser said.
  const attachments: (SupportAttachment & { url: string })[] = []
  for (const key of keys as string[]) {
    const head = await deps.head(key)
    if (!head) return { status: 400, body: { error: 'attachment_missing' } }
    if (head.sizeBytes > SUPPORT_MAX_FILE_BYTES || !isSupportFileType(head.contentType)) {
      return { status: 400, body: { error: 'attachment_invalid' } }
    }
    attachments.push({ key, type: head.contentType, size: head.sizeBytes, url: await deps.signReadUrl(key) })
  }

  const context: Record<string, unknown> = {
    ...clientContext(b.context),
    ...(request.userAgentFromServer ? { serverUserAgent: str(request.userAgentFromServer) } : {}),
    locale: request.locale,
    receivedAt: now.toISOString(),
    ...(sender.kind === 'account' ? { plan: sender.plan ?? 'unknown' } : { ipHash }),
  }

  const row: SupportRow = {
    id: randomUUID(),
    user_id: sender.kind === 'account' ? sender.userId : null,
    email,
    topic,
    message,
    context,
    attachments: attachments.map(({ key, type, size }) => ({ key, type, size })),
  }

  const inbox = supportLetter(row, attachments, sender)
  const [mailed, inserted] = await Promise.all([
    deps.sendEmail({ to: supportEmail(), replyTo: email, ...inbox }),
    deps.insert(row).catch((error: unknown) => ({ error })),
  ])

  if (inserted.error) {
    await deps.reportError(inserted.error, { where: 'support_requests insert', requestId: row.id })
  }
  if (!mailed) {
    await deps.reportError(new Error('support letter not sent'), { where: 'support email', requestId: row.id })
  }
  if (!mailed && inserted.error) {
    return { status: 502, body: { error: 'not_delivered' } }
  }

  // A copy for the sender; replies to it reach us (Reply-To = hello@).
  const copy = senderCopy(row, request.copy)
  const copied = await deps.sendEmail({ to: email, replyTo: supportEmail(), ...copy })
  if (!copied) {
    await deps.reportError(new Error('support copy not sent'), { where: 'support copy', requestId: row.id })
  }

  return { status: 200, body: { ok: true, email } }
}

export interface RequestFacts {
  ip: string
  locale: string
  copy: SupportCopy
  /** The User-Agent header as the server saw it (beside the form's own). */
  userAgentFromServer?: string
}

function supportLetter(
  row: SupportRow,
  attachments: { url: string }[],
  sender: SupportSender
): { subject: string; text: string; html: string } {
  const topicUk = SUPPORT_TOPIC_UK[row.topic]
  const subject = `[Підтримка] ${topicUk} — ${row.email}`
  const c = row.context as Record<string, string | undefined>
  const rows: [string, string][] = [
    ['Email', row.email],
    ['Звідки', sender.kind === 'account' ? 'кабінет' : 'сторінка «Контакти»'],
  ]
  if (sender.kind === 'account') {
    rows.push(['user_id', sender.userId], ['Тариф', String(c.plan ?? '—')])
  }
  rows.push(
    ['Сторінка', c.url || '—'],
    ['Браузер', c.userAgent || c.serverUserAgent || '—'],
    ['Мова', c.language || c.locale || '—'],
    ['Вікно', c.viewport || '—'],
    ['Час (у фотографа)', c.time || '—'],
    ['Отримано', String(c.receivedAt)],
    ['ID звернення', row.id]
  )
  const doc: EmailDoc = {
    greeting: `${topicUk} — від ${row.email}`,
    lead: paragraphs(row.message),
    rows,
    ...(attachments.length
      ? {
          list: {
            title: 'Скриншоти (посилання діють 7 днів)',
            items: attachments.map((a) => a.url),
          },
        }
      : {}),
    after: ['Відповідайте просто на цей лист — відповідь піде на пошту фотографа.'],
  }
  return { subject, text: renderText(doc), html: renderHtml(doc, subject) }
}

function senderCopy(row: SupportRow, copy: SupportCopy): { subject: string; text: string; html: string } {
  const doc: EmailDoc = {
    greeting: copy.copyGreeting,
    lead: [copy.copyLead],
    rows: [[copy.copyTopic, copy.topics[row.topic]]],
    after: [copy.copyMessage, ...paragraphs(row.message), copy.copyAfter],
  }
  return { subject: copy.copySubject, text: renderText(doc), html: renderHtml(doc, copy.copySubject) }
}

/** Lines of the message as paragraphs (the HTML part drops bare newlines). */
function paragraphs(message: string): string[] {
  return message.split(/\n+/).map((l) => l.trim()).filter(Boolean)
}
