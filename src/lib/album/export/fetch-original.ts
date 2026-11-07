/**
 * Fetching an original for export (main thread or worker). The URL is a
 * presigned Backblaze B2 S3 URL; fetch() can read it only when the bucket's
 * CORS rule allows our origin (docs/albums/B2-CORS.md). A CORS refusal
 * surfaces as a bare TypeError, so it is turned into a message that says
 * what to fix instead of «Failed to fetch».
 */

export type OriginalErrorCode = 'storage_cors' | 'storage_forbidden' | 'storage_missing' | 'offline' | 'storage_http'

export class OriginalFetchError extends Error {
  constructor(public code: OriginalErrorCode, message: string) {
    super(message)
    this.name = 'OriginalFetchError'
  }
}

export const CORS_HELP = 'docs/albums/B2-CORS.md'

export function explainFetchFailure(name: string, status: number | null, online: boolean, origin: string): OriginalFetchError {
  if (status === null) {
    if (!online) return new OriginalFetchError('offline', "Немає з'єднання з інтернетом — оригінали не завантажуються. Перевірте мережу і повторіть експорт.")
    return new OriginalFetchError(
      'storage_cors',
      `Сховище не дозволяє браузеру читати оригінали (CORS) для ${origin}. Потрібне правило CORS на бакеті B2 (GET/HEAD для proiav.space і www) — інструкція в ${CORS_HELP}. Фото «${name}» не завантажено.`
    )
  }
  if (status === 401 || status === 403)
    return new OriginalFetchError(
      'storage_forbidden',
      `Сховище відхилило посилання на оригінал «${name}» (${status}). Посилання могло прострочитися або годинник комп'ютера збитий — повторіть експорт.`
    )
  if (status === 404) return new OriginalFetchError('storage_missing', `Оригінал «${name}» не знайдено у сховищі (404). Можливо, фото видалили з галереї.`)
  return new OriginalFetchError('storage_http', `Сховище повернуло помилку ${status} для «${name}». Повторіть експорт трохи згодом.`)
}

export async function fetchOriginal(url: string, name: string, signal?: AbortSignal): Promise<Blob> {
  let response: Response
  try {
    // no-store: a copy cached earlier by an <img> (no CORS) must not be reused for a CORS read.
    response = await fetch(url, { signal, cache: 'no-store', mode: 'cors', credentials: 'omit' })
  } catch (cause) {
    if ((cause as Error)?.name === 'AbortError') throw cause
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
    const origin = typeof location === 'undefined' ? 'цього сайту' : location.origin
    throw explainFetchFailure(name, null, online, origin)
  }
  if (!response.ok) throw explainFetchFailure(name, response.status, true, '')
  return response.blob()
}
