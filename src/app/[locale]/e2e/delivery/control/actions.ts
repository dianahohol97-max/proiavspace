'use server'

/**
 * Test-only stand-in for setGalleryDelivery (tests/e2e/delivery-status.spec.ts):
 * keeps the value in this server's memory, so a reload shows what was saved.
 * Refuses unless the server runs with E2E_THEME_PREVIEW=1.
 */
import { parseDeliveryEta, parseDeliveryStatus } from '@/lib/gallery/delivery'

const store: { status: string | null; eta: string | null; saves: number } = { status: null, eta: null, saves: 0 }

export async function e2eDeliveryState() {
  return { ...store }
}

export async function e2eSaveDelivery(status: string | null, eta: string | null): Promise<{ ok: boolean }> {
  if (process.env.E2E_THEME_PREVIEW !== '1') return { ok: false }
  if (status && !parseDeliveryStatus(status)) return { ok: false }
  if (eta && !parseDeliveryEta(eta)) return { ok: false }
  store.status = parseDeliveryStatus(status)
  store.eta = parseDeliveryEta(eta)
  store.saves += 1
  return { ok: true }
}

export async function e2eResetDelivery(): Promise<void> {
  if (process.env.E2E_THEME_PREVIEW !== '1') return
  store.status = null
  store.eta = null
  store.saves = 0
}
