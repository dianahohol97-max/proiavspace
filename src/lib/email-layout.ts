/**
 * The look of every проЯв e-mail (Brevo). One source → two parts: a plain-text
 * part and an HTML part that says the same thing, so a letter reads the same
 * in any client and does not look like a bare-HTML bulk mail to spam filters.
 *
 *   letters with a structure (receipt, «через 3 дні спишемо») → EmailDoc
 *   everything else (plain text)                              → wrapText()
 *
 * Every HTML part ends with the business details and the support address.
 */

export const BUSINESS = {
  entity: 'ФОП Гоголь Діана Іванівна',
  city: 'м. Тернопіль',
  site: 'proiav.space',
}

/**
 * The one support address: letters (footer, Reply-To), the offer and the
 * privacy policy (lib/legal/copy).
 */
export const SUPPORT_EMAIL = 'hello@proiav.space'

/** Where replies and questions go; also the Reply-To of every letter. */
export function supportEmail(): string {
  return SUPPORT_EMAIL
}

/** The footer lines, same in the text and the HTML part. */
export function footerLines(): string[] {
  return [
    `проЯв · ${BUSINESS.site}`,
    `${BUSINESS.entity}, ${BUSINESS.city}`,
    `Питання й рахунок для ФОП: ${supportEmail()}`,
  ]
}

/**
 * «Привіт, Олено!» / «Привіт!». The name comes from the profile, and only if it
 * is a real name: a display_name that is the e-mail's local part (the signup
 * default, «dianahohol97») or looks like an address is not a name.
 */
export function greetingName(displayName: string | null | undefined, email?: string | null): string | null {
  const name = displayName?.trim()
  if (!name || name.includes('@')) return null
  const local = email?.split('@')[0]?.trim().toLowerCase()
  if (local) {
    const bare = local.split('+')[0]
    const n = name.toLowerCase()
    if (n === local || n === bare) return null
  }
  return name
}

export function hello(name: string | null, locale: 'uk' | 'en' = 'uk'): string {
  if (locale === 'en') return name ? `Hi, ${name}!` : 'Hi!'
  return name ? `Привіт, ${name}!` : 'Привіт!'
}

export interface EmailDoc {
  greeting: string
  /** Paragraphs before the details table. */
  lead: string[]
  /** «Тариф — Базовий», «Сума — 129 ₴» … */
  rows?: [string, string][]
  /** A titled bullet list («Що входить»). */
  list?: { title: string; items: string[] }
  /** Paragraphs after the table. */
  after?: string[]
  button?: { label: string; url: string }
  /** A second, quieter link under the button. */
  link?: { label: string; url: string }
}

export function renderText(doc: EmailDoc): string {
  const out: string[] = [doc.greeting, '', ...joinParas(doc.lead)]
  if (doc.rows?.length) {
    out.push('', ...doc.rows.map(([k, v]) => `${k}: ${v}`))
  }
  if (doc.list?.items.length) {
    out.push('', `${doc.list.title}:`, ...doc.list.items.map((i) => `• ${i}`))
  }
  if (doc.after?.length) out.push('', ...joinParas(doc.after))
  if (doc.button) out.push('', `${doc.button.label}: ${doc.button.url}`)
  if (doc.link) out.push(`${doc.link.label}: ${doc.link.url}`)
  out.push('', '—', ...footerLines())
  return out.join('\n')
}

function joinParas(paras: string[]): string[] {
  return paras.flatMap((p, i) => (i === 0 ? [p] : ['', p]))
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Bare URLs in escaped text become links. */
const linkify = (s: string) =>
  s.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#2f55ff;word-break:break-all;">${url}</a>`)

const P = 'margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#0d0c0a;'

export function renderHtml(doc: EmailDoc, subject: string): string {
  const parts: string[] = [`<p style="${P}">${esc(doc.greeting)}</p>`]
  for (const p of doc.lead) parts.push(`<p style="${P}">${linkify(esc(p))}</p>`)
  if (doc.rows?.length) {
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 18px 0;font-size:14px;">${doc.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:7px 12px 7px 0;color:#6f6d66;border-bottom:1px solid #ecebe6;vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:7px 0;color:#0d0c0a;border-bottom:1px solid #ecebe6;">${esc(v)}</td></tr>`
        )
        .join('')}</table>`
    )
  }
  if (doc.list?.items.length) {
    parts.push(
      `<p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#0d0c0a;">${esc(doc.list.title)}</p><ul style="margin:0 0 16px 18px;padding:0;font-size:14px;line-height:1.6;color:#0d0c0a;">${doc.list.items
        .map((i) => `<li>${esc(i)}</li>`)
        .join('')}</ul>`
    )
  }
  for (const p of doc.after ?? []) parts.push(`<p style="${P}">${linkify(esc(p))}</p>`)
  if (doc.button) {
    parts.push(
      `<p style="margin:8px 0 14px 0;"><a href="${doc.button.url}" style="display:inline-block;background:#2f55ff;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:999px;">${esc(doc.button.label)}</a></p>`
    )
  }
  if (doc.link) {
    parts.push(
      `<p style="margin:0 0 14px 0;font-size:13px;"><a href="${doc.link.url}" style="color:#2f55ff;">${esc(doc.link.label)}</a></p>`
    )
  }
  return page(subject, parts.join(''))
}

/** A plain-text letter as a proper HTML document with the same footer. */
export function wrapText(text: string, subject: string): string {
  const body = text
    .split(/\n{2,}/)
    .map((para) => `<p style="${P}">${linkify(esc(para)).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return page(subject, body)
}

function page(subject: string, body: string): string {
  const footer = footerLines()
    .map((l) => linkify(esc(l)))
    .join('<br>')
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:#f6f5f1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;"><tr><td style="padding:28px 28px 8px 28px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 20px 0;font-size:18px;font-weight:700;color:#0d0c0a;">проЯв</p>${body}</td></tr><tr><td style="padding:12px 28px 24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6f6d66;border-top:1px solid #ecebe6;">${footer}</td></tr></table></td></tr></table></body></html>`
}
