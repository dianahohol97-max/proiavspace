/**
 * Message formatting shared by every language.
 *
 * Templates use `{name}` placeholders and an ICU-style plural block for
 * counts, so each language follows its own plural rules (Intl.PluralRules)
 * instead of «1 фото / 5 фото» everywhere:
 *
 *   '{n, plural, one {# zdjęcie} few {# zdjęcia} many {# zdjęć} other {# zdjęcia}}'
 *
 * Categories: zero, one, two, few, many, other (`other` is required), plus
 * exact matches like `=0 {…}`. `#` inside a branch is the number, formatted
 * for the locale. Dates, numbers and money also go through Intl here, keyed by
 * the page language.
 */

/** BCP 47 tag for Intl, by page locale. */
const INTL_LOCALES: Record<string, string> = {
  uk: 'uk-UA',
  en: 'en-GB',
  pl: 'pl-PL',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  ro: 'ro-RO',
  pt: 'pt-PT',
}

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale
}

type Values = Record<string, string | number>

/** Index of the brace that closes the one opened at `open`. */
function matchingBrace(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function pluralBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>()
  let i = 0
  while (i < body.length) {
    const m = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(body.slice(i))
    if (!m) break
    const open = i + m[0].length - 1
    const close = matchingBrace(body, open)
    if (close < 0) break
    branches.set(m[1], body.slice(open + 1, close))
    i = close + 1
  }
  return branches
}

/**
 * Fill `{name}` placeholders and resolve `{name, plural, …}` blocks.
 * Unknown placeholders are left as they are.
 */
export function formatMessage(template: string, values: Values = {}, locale = 'en'): string {
  let out = ''
  let i = 0
  while (i < template.length) {
    const open = template.indexOf('{', i)
    if (open < 0) {
      out += template.slice(i)
      break
    }
    out += template.slice(i, open)
    const close = matchingBrace(template, open)
    if (close < 0) {
      out += template.slice(open)
      break
    }
    const inner = template.slice(open + 1, close)
    const plural = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner)
    if (plural) {
      const [, key, body] = plural
      const raw = values[key]
      const n = typeof raw === 'number' ? raw : Number(raw)
      const branches = pluralBranches(body)
      const category = Number.isFinite(n) ? new Intl.PluralRules(intlLocale(locale)).select(n) : 'other'
      const branch = branches.get(`=${n}`) ?? branches.get(category) ?? branches.get('other') ?? ''
      const shown = Number.isFinite(n) ? formatNumber(n, locale) : String(raw ?? '')
      out += formatMessage(branch.replace(/#/g, shown), values, locale)
    } else if (/^\w+$/.test(inner) && inner in values) {
      out += String(values[inner])
    } else {
      out += template.slice(open, close + 1)
    }
    i = close + 1
  }
  return out
}

/** Placeholder names a template uses (plural blocks count once, by name). */
export function placeholders(template: string): string[] {
  const names = new Set<string>()
  let i = 0
  while (i < template.length) {
    const open = template.indexOf('{', i)
    if (open < 0) break
    const close = matchingBrace(template, open)
    if (close < 0) break
    const inner = template.slice(open + 1, close)
    const plural = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner)
    if (plural) {
      names.add(plural[1])
      for (const branch of pluralBranches(plural[2]).values()) {
        for (const nested of placeholders(branch)) names.add(nested)
      }
    } else if (/^\w+$/.test(inner)) {
      names.add(inner)
    }
    i = close + 1
  }
  return [...names].sort()
}

export function formatNumber(n: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(n)
}

export function formatDate(
  date: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(date))
}

/** Hryvnia amount in the page language: «1 200 ₴», «UAH 1,200», «1200,00 UAH»… */
export function formatUah(amount: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: 'UAH',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    ...options,
  }).format(amount)
}
