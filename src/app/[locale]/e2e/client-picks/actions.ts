'use server'

/**
 * Test-only stand-ins for setClientEmail / sendClientReadyEmailAgain
 * (tests/e2e/client-picks.spec.ts): the same validation and the same
 * once/«not twice a minute» logic (lib/gallery/ready-email), with the gallery
 * and the outbox in this server's memory. E2E_THEME_PREVIEW=1 only.
 */
import { revalidatePath } from 'next/cache'
import type { ClientEmailSaveResult } from '@/lib/actions/client-email'
import {
  parseClientEmail,
  sendReadyEmailAgain,
  sendReadyEmailOnce,
  type ReadyEmailDeps,
  type ReadyEmailGallery,
  type ReadyEmailResult,
} from '@/lib/gallery/ready-email'

const gallery: ReadyEmailGallery = {
  id: 'e2e',
  title: 'Марта і Богдан',
  slug: 'e2e-marta-bohdan',
  is_published: true,
  has_password: false,
  delivery_status: 'ready',
  client_email: null,
  ready_email_sent_at: null,
}
const outbox: { to: string; subject: string }[] = []

const enabled = () => process.env.E2E_THEME_PREVIEW === '1'

const deps: ReadyEmailDeps = {
  appUrl: 'http://localhost',
  photographer: { name: 'Ольга Вишня', email: 'olha@example.com' },
  async load(id, owner) {
    return id === gallery.id && owner === 'e2e' ? { ...gallery } : null
  },
  async claim(_id, expected, at) {
    if (gallery.ready_email_sent_at !== expected) return false
    gallery.ready_email_sent_at = at
    return true
  },
  async release(_id, at, previous) {
    if (gallery.ready_email_sent_at === at) gallery.ready_email_sent_at = previous
  },
  async send(input) {
    outbox.push({ to: input.to, subject: input.subject })
    return true
  },
}

export async function e2eClientEmailState() {
  return { email: gallery.client_email, sentAt: gallery.ready_email_sent_at, sent: outbox.length, ready: gallery.delivery_status === 'ready' }
}

export async function e2eReset(ready: boolean): Promise<void> {
  if (!enabled()) return
  gallery.client_email = null
  gallery.ready_email_sent_at = null
  gallery.delivery_status = ready ? 'ready' : 'editing'
  outbox.length = 0
}

export async function e2eSaveClientEmail(raw: string, consent: boolean): Promise<ClientEmailSaveResult> {
  if (!enabled()) return { ok: false, error: 'failed' }
  const trimmed = raw.trim()
  const email = trimmed ? parseClientEmail(trimmed) : null
  if (trimmed && !email) return { ok: false, error: 'invalid' }
  if (email && !consent) return { ok: false, error: 'consent' }
  gallery.client_email = email
  return { ok: true }
}

/** «Статус → Готово» as setGalleryDelivery does it. */
export async function e2eMarkReady(): Promise<ReadyEmailResult> {
  if (!enabled()) return 'not_found'
  gallery.delivery_status = 'ready'
  return sendReadyEmailOnce(deps, gallery.id, 'e2e')
}

export async function e2eSendAgain(): Promise<ReadyEmailResult> {
  if (!enabled()) return 'not_found'
  return sendReadyEmailAgain(deps, gallery.id, 'e2e')
}

/** Form wrapper for the test page's «статус → Готово» button. */
export async function e2eMarkReadyForm(): Promise<void> {
  await e2eMarkReady()
  revalidatePath('/[locale]/e2e/client-picks', 'page')
}
