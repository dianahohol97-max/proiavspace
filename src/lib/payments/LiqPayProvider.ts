import { createHash } from 'node:crypto'
import type {
  CheckoutForm,
  CheckoutRequest,
  PaymentProvider,
  PaymentStatus,
  WebhookEvent,
} from './PaymentProvider'

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout'

/**
 * LiqPay (PrivatBank) — subscription checkout via their hosted page.
 * Protocol: JSON params → base64 `data`, `signature` = base64(sha1(private +
 * data + private)). The webhook posts the same pair back; verifying the
 * signature is the whole trust model, so parseWebhook returns null on any
 * mismatch and the caller must drop the request.
 */
export class LiqPayProvider implements PaymentProvider {
  readonly name = 'liqpay'
  readonly recurring = true

  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string
  ) {}

  private sign(data: string): string {
    return createHash('sha1')
      .update(this.privateKey + data + this.privateKey)
      .digest('base64')
  }

  async createCheckoutForm(request: CheckoutRequest): Promise<CheckoutForm> {
    // A LiqPay subscription only with the payer's auto-renewal consent;
    // otherwise a one-off payment.
    const recurring = request.autopay
      ? {
          action: 'subscribe',
          subscribe: '1',
          subscribe_date_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
          subscribe_periodicity: request.period,
        }
      : { action: 'pay' }
    const params = {
      version: 3,
      public_key: this.publicKey,
      ...recurring,
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      order_id: request.orderId,
      result_url: request.resultUrl,
      server_url: request.serverUrl,
      language: request.language,
    }
    const data = Buffer.from(JSON.stringify(params)).toString('base64')
    return {
      url: CHECKOUT_URL,
      fields: { data, signature: this.sign(data) },
    }
  }

  async parseWebhook(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<WebhookEvent | null> {
    // LiqPay posts application/x-www-form-urlencoded: data + signature.
    const params = new URLSearchParams(rawBody)
    const data = params.get('data')
    const signature = params.get('signature')
    if (!data || !signature || this.sign(data) !== signature) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as Record<
        string,
        unknown
      >
    } catch {
      return null
    }

    const orderId = typeof payload.order_id === 'string' ? payload.order_id : null
    if (!orderId) return null

    const providerStatus = typeof payload.status === 'string' ? payload.status : ''
    const statusMap: Record<string, PaymentStatus> = {
      success: 'paid',
      subscribed: 'paid',
      wait_accept: 'pending',
      processing: 'pending',
      failure: 'failed',
      error: 'failed',
      reversed: 'canceled',
      unsubscribed: 'canceled',
    }

    return {
      orderId,
      status: statusMap[providerStatus] ?? 'other',
      raw: payload,
    }
  }
}
