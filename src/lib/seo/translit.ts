/**
 * Official Ukrainian romanization (Cabinet of Ministers resolution No. 55,
 * 2010) — the ONE system for every new public slug: галерея → halereia,
 * фотограф → fotohraf, прояв → proiav, ціни → tsiny.
 *
 * Positional rules: є/ї/й/ю/я are ye/yi/y/yu/ya at the start of a word and
 * ie/i/i/iu/ia elsewhere; «зг» is «zgh» (to tell it from «ж»); soft sign and
 * apostrophe are dropped.
 */
const BASE: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  // Non-Ukrainian Cyrillic that shows up in pasted titles.
  ы: 'y', э: 'e', ё: 'io', ъ: '',
}

const WORD_START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }

const APOSTROPHES = /['’ʼ`]/g

export function transliterateUk(input: string): string {
  const text = input.toLowerCase().replace(APOSTROPHES, '')
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const prev = i > 0 ? text[i - 1] : ''
    const atWordStart = !prev || !/[a-zа-яіїєґ0-9]/i.test(prev)
    if (ch === 'г' && prev === 'з') {
      out += 'gh'
      continue
    }
    if (atWordStart && WORD_START[ch]) {
      out += WORD_START[ch]
      continue
    }
    out += BASE[ch] ?? ch
  }
  return out
}

/** Readable, stable slug from a Ukrainian phrase (no random suffix). */
export function slugifyUk(input: string, maxLength = 80): string {
  const words = transliterateUk(input)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
  // Cut on a word boundary, never mid-word.
  let slug = ''
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > maxLength) break
    slug = next
  }
  return slug
}
