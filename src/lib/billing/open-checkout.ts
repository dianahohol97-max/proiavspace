'use client'

/**
 * Hand the browser over to the payment provider's checkout returned by
 * /api/billing/checkout. No fields (monobank) → the checkout page is opened by
 * plain redirect; otherwise (LiqPay) auto-submit a hidden POST form.
 */
export function openCheckout(form: { url: string; fields: Record<string, string> }): void {
  if (Object.keys(form.fields).length === 0) {
    window.location.assign(form.url)
    return
  }

  const element = document.createElement('form')
  element.method = 'POST'
  element.action = form.url
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    element.appendChild(input)
  }
  document.body.appendChild(element)
  element.submit()
}
