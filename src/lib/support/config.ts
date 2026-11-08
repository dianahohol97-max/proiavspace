/**
 * Support form: the shape shared by the browser (form, panel) and the server
 * (routes, handler). No server imports here — it ships to the client.
 */

export const SUPPORT_TOPICS = ['bug', 'question', 'billing', 'idea'] as const
export type SupportTopic = (typeof SUPPORT_TOPICS)[number]

export function isSupportTopic(value: unknown): value is SupportTopic {
  return typeof value === 'string' && (SUPPORT_TOPICS as readonly string[]).includes(value)
}

/** Ukrainian topic names: the support inbox subject and the admin list. */
export const SUPPORT_TOPIC_UK: Record<SupportTopic, string> = {
  bug: 'Щось не працює',
  question: 'Питання',
  billing: 'Оплата і тариф',
  idea: 'Ідея',
}

export const SUPPORT_MESSAGE_MAX = 5000
export const SUPPORT_MAX_FILES = 3
export const SUPPORT_MAX_FILE_BYTES = 5 * 1024 * 1024

/** Screenshot types and the extension each one is stored under. */
export const SUPPORT_FILE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function isSupportFileType(type: unknown): type is string {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(SUPPORT_FILE_TYPES, type)
}

/** Public form: requests per IP per hour (submissions; uploads get 3× that). */
export const SUPPORT_PUBLIC_PER_HOUR = 5
/** Dashboard form: requests per account per hour. */
export const SUPPORT_ACCOUNT_PER_HOUR = 10

/** How long the screenshot links in the support letter stay valid (S3 maximum). */
export const SUPPORT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60

/** What the browser adds on its own (shown to the sender before sending). */
export interface SupportClientContext {
  url: string
  userAgent: string
  language: string
  viewport: string
  time: string
}

export const SUPPORT_STATUSES = ['new', 'answered', 'closed'] as const
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

export function isSupportStatus(value: unknown): value is SupportStatus {
  return typeof value === 'string' && (SUPPORT_STATUSES as readonly string[]).includes(value)
}
