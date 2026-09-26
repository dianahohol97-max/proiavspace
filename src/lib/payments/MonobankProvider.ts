import { createVerify } from 'node:crypto'
import type {
  CheckoutForm,
  CheckoutRequest,
  PaymentStatus,
  RecurringChargeProvider,
  TokenChargeRequest,
  WebhookEvent,
} from './PaymentProvider'

const API_BASE = 'https://api.monobank.ua/api/merchant'

/**
 * Monobank acquiring — invoices via their hosted payment page. There are no
 * native subscriptions, so auto-renewal is built on card tokenization: the
 * first checkout saves the card (saveCardData), the webhook stores the
 * cardToken, and the renewal cron charges it via /wallet/payment.
 * Webhook trust model: the X-Sign header is a base64 ECDSA-SHA256 signature
 * of the raw body, verified against the merchant public key from
 * GET /merchant/pubkey. Anything unverifiable is dropped.
 */
export class MonobankProvider implements RecurringChargeProvider {
  readonly name = 'monobank'
  readonly recurring = false

  private publicKeyPem: string | null = null

  constructor(private readonly token: string) {}

  async createCheckoutForm(request: CheckoutRequest): Promise<CheckoutForm> {
    const response = await fetch(`${API_BASE}/invoice/create`, {
      method: 'POST',
      headers: { 'X-Token': this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Monobank counts in kopecks; plans are priced in whole hryvnias.
        amount: Math.round(request.amount * 100),
        ccy: 980,
        merchantPaymInfo: {
          reference: request.orderId,
          destination: request.description,
        },
        redirectUrl: request.resultUrl,
        webHookUrl: request.serverUrl,
        validity: 24 * 3600,
        paymentType: 'debit',
        // Tokenize the card so the renewal cron can auto-charge it later.
        ...(request.customerId
          ? { saveCardData: { saveCard: true, walletId: request.customerId } }
          : {}),
      }),
    })
    if (!response.ok) {
      throw new Error(
        `monobank invoice/create: ${response.status} ${await response.text()}`
      )
    }
    const payload = (await response.json()) as { pageUrl?: string }
    if (!payload.pageUrl) {
      throw new Error('monobank invoice/create: response has no pageUrl')
    }
    // Empty fields → the client does a plain redirect instead of a form POST.
    return { url: payload.pageUrl, fields: {} }
  }

  private async fetchPublicKey(): Promise<string> {
    const response = await fetch(`${API_BASE}/pubkey`, {
      headers: { 'X-Token': this.token },
    })
    if (!response.ok) throw new Error(`monobank pubkey: ${response.status}`)
    const payload = (await response.json()) as { key?: string }
    if (!payload.key) throw new Error('monobank pubkey: empty response')
    return Buffer.from(payload.key, 'base64').toString('utf8')
  }

  private verifySignature(rawBody: string, signature: string, pem: string): boolean {
    try {
      const verifier = createVerify('SHA256')
      verifier.update(rawBody)
      verifier.end()
      return verifier.verify(pem, Buffer.from(signature, 'base64'))
    } catch {
      return false
    }
  }

  async parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookEvent | null> {
    const signature = headers['x-sign']
    if (!signature) return null

    // Try the cached key first; on mismatch refetch once — mono rotates keys.
    let pem = this.publicKeyPem
    if (!pem) {
      try {
        pem = this.publicKeyPem = await this.fetchPublicKey()
      } catch {
        return null
      }
    }
    let verified = this.verifySignature(rawBody, signature, pem)
    if (!verified) {
      try {
        pem = this.publicKeyPem = await this.fetchPublicKey()
      } catch {
        return null
      }
      verified = this.verifySignature(rawBody, signature, pem)
    }
    if (!verified) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }

    // reference is our payments.order_id passed in merchantPaymInfo.
    const orderId = typeof payload.reference === 'string' ? payload.reference : null
    if (!orderId) return null

    const providerStatus = typeof payload.status === 'string' ? payload.status : ''
    const statusMap: Record<string, PaymentStatus> = {
      success: 'paid',
      created: 'pending',
      processing: 'pending',
      hold: 'pending',
      failure: 'failed',
      expired: 'failed',
      reversed: 'canceled',
    }

    // walletData appears when the payer agreed to save the card.
    const walletData = payload.walletData as { cardToken?: unknown } | undefined
    const cardToken =
      walletData && typeof walletData.cardToken === 'string'
        ? walletData.cardToken
        : undefined

    return {
      orderId,
      status: statusMap[providerStatus] ?? 'other',
      cardToken,
      raw: payload,
    }
  }

  async chargeToken(request: TokenChargeRequest): Promise<PaymentStatus> {
    const response = await fetch(`${API_BASE}/wallet/payment`, {
      method: 'POST',
      headers: { 'X-Token': this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardToken: request.cardToken,
        amount: Math.round(request.amount * 100),
        ccy: 980,
        // Merchant-initiated charge: no payer present, no 3DS redirect.
        initiationKind: 'merchant',
        merchantPaymInfo: {
          reference: request.orderId,
          destination: request.description,
        },
        webHookUrl: request.serverUrl,
      }),
    })
    if (!response.ok) {
      throw new Error(
        `monobank wallet/payment: ${response.status} ${await response.text()}`
      )
    }
    const payload = (await response.json()) as { status?: string }
    if (payload.status === 'success') return 'paid'
    if (payload.status === 'failure') return 'failed'
    // created/processing — the final word arrives via webhook.
    return 'pending'
  }

  async lookupCharge(
    orderId: string,
    createdAtIso: string
  ): Promise<'paid' | 'failed' | 'unknown'> {
    // The merchant statement lists payments with our reference; start a minute
    // before the payment row so clock skew can't hide it.
    const from = Math.floor(new Date(createdAtIso).getTime() / 1000) - 60
    const response = await fetch(`${API_BASE}/statement?from=${from}`, {
      headers: { 'X-Token': this.token },
    })
    if (!response.ok) {
      throw new Error(`monobank statement: ${response.status} ${await response.text()}`)
    }
    const payload = (await response.json()) as {
      list?: { reference?: string; status?: string }[]
    }
    const item = (payload.list ?? []).find((entry) => entry.reference === orderId)
    if (item?.status === 'success') return 'paid'
    if (item?.status === 'failure' || item?.status === 'reversed') return 'failed'
    return 'unknown'
  }

  async deleteToken(cardToken: string): Promise<void> {
    // Best-effort: a leftover token cannot be charged once the subscription
    // row is gone, so failures here are logged by the caller and ignored.
    const response = await fetch(
      `${API_BASE}/wallet/card?cardToken=${encodeURIComponent(cardToken)}`,
      { method: 'DELETE', headers: { 'X-Token': this.token } }
    )
    if (!response.ok) {
      throw new Error(`monobank wallet/card delete: ${response.status}`)
    }
  }
}
