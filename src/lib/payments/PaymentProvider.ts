/**
 * Payment abstraction for the Ukrainian market. LiqPay (subscriptions) and
 * Monobank acquiring (one-off invoices) ship as providers; Fondy/WayForPay
 * later mean one new class implementing this interface plus a case in the
 * factory — application code never touches provider specifics.
 */

import type { BillingPeriod } from '@/lib/plans'

export interface CheckoutRequest {
  /** Our payments.order_id — the provider echoes it back in the webhook. */
  orderId: string
  amount: number
  currency: 'UAH'
  description: string
  period: BillingPeriod
  /** Where the provider redirects the customer after payment. */
  resultUrl: string
  /** Server-to-server webhook endpoint. */
  serverUrl: string
  language: 'uk' | 'en'
  /**
   * Stable customer id (our user_id). Providers that tokenize cards use it
   * as the wallet key so the saved card can be charged on renewal.
   */
  customerId?: string
}

/**
 * How the browser reaches the provider's checkout page: a POST form it
 * auto-submits (LiqPay), or — when `fields` is empty — a plain redirect
 * to `url` (Monobank).
 */
export interface CheckoutForm {
  url: string
  fields: Record<string, string>
}

export type PaymentStatus = 'paid' | 'failed' | 'canceled' | 'pending' | 'other'

export interface WebhookEvent {
  orderId: string
  status: PaymentStatus
  /** Card token issued by the provider when the payer saved their card. */
  cardToken?: string
  raw: Record<string, unknown>
}

export interface PaymentProvider {
  readonly name: string
  /**
   * True when the provider renews on its own (LiqPay subscriptions).
   * False for invoice providers — renewal is ours: either a saved card
   * charged by the cron, or a plain expiry date when no card was saved.
   */
  readonly recurring: boolean
  createCheckoutForm(request: CheckoutRequest): Promise<CheckoutForm>
  /**
   * Receives the raw webhook body and lower-cased request headers.
   * Returns null when the signature does not verify — treat as hostile.
   */
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookEvent | null>
}

export interface TokenChargeRequest {
  cardToken: string
  /** Our payments.order_id for the renewal payment row. */
  orderId: string
  amount: number
  description: string
  /** Server-to-server webhook endpoint for the final status. */
  serverUrl: string
}

/** Capability: charge a previously saved card (renewal cron). */
export interface RecurringChargeProvider extends PaymentProvider {
  /**
   * Kicks off a charge on a saved card. 'paid'/'failed' when the provider
   * answers synchronously; 'pending' when the result arrives via webhook.
   */
  chargeToken(request: TokenChargeRequest): Promise<PaymentStatus>
  /** Best-effort card-token removal when the user cancels auto-renewal. */
  deleteToken(cardToken: string): Promise<void>
  /**
   * Final outcome of an earlier charge, found by our order id — for renewals
   * whose webhook never came. 'unknown' when the provider has no definite
   * answer (still processing, or not found); callers must not recharge then.
   */
  lookupCharge?(orderId: string, createdAtIso: string): Promise<'paid' | 'failed' | 'unknown'>
}

export function canChargeTokens(
  provider: PaymentProvider
): provider is RecurringChargeProvider {
  return (
    typeof (provider as Partial<RecurringChargeProvider>).chargeToken === 'function'
  )
}
