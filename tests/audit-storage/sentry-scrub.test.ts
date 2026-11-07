/**
 * Sentry: вимкнений без DSN, персональні дані вирізаються з подій,
 * очікувана refresh_token_not_found не надсилається.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { isExpectedError, scrubBreadcrumb, scrubEvent, scrubString, sentryEnabled, sharedSentryOptions } from '@/lib/sentry/options'

const ROOT = join(__dirname, '..', '..')

describe('Sentry: приватність і вимкнення', () => {
  test('без NEXT_PUBLIC_SENTRY_DSN Sentry вимкнений', () => {
    assert.equal(process.env.NEXT_PUBLIC_SENTRY_DSN ?? '', '')
    assert.equal(sentryEnabled, false)
    assert.equal(sharedSentryOptions.enabled, false)
    assert.equal(sharedSentryOptions.sendDefaultPii, false)
  })

  test('next.config.js підключає Sentry лише за наявності DSN', () => {
    const cfg = readFileSync(join(ROOT, 'next.config.js'), 'utf8')
    assert.match(cfg, /if \(process\.env\.NEXT_PUBLIC_SENTRY_DSN\)/)
  })

  test('email, телефони й секретні параметри URL вирізаються з рядків', () => {
    const out = scrubString(
      'fail for anna.k@gmail.com +380 67 123 45 67 at https://proiav.space/uk/reset?token=abc123&lang=uk&password=qwerty'
    )
    assert.doesNotMatch(out, /anna\.k@gmail\.com/)
    assert.doesNotMatch(out, /123 45 67/)
    assert.doesNotMatch(out, /abc123|qwerty/)
    assert.match(out, /lang=uk/)
    assert.match(out, /token=\[Filtered\]/)
  })

  test('UUID, версії й номери рядків не плутаються з телефонами', () => {
    const s = 'galleries/550e8400-e29b-41d4-a716-446655440000/v/a.jpg chunk-1234567890.js:12:3456'
    assert.equal(scrubString(s), s)
  })

  test('підпис presigned-посилання вирізається', () => {
    const out = scrubString('https://s3.us-east-005.backblazeb2.com/b/k.jpg?X-Amz-Credential=AKIA/x&X-Amz-Signature=deadbeef')
    assert.doesNotMatch(out, /deadbeef|AKIA/)
  })

  test('подія: user, cookie, заголовки авторизації, тіло й query вирізаються', () => {
    const event = scrubEvent({
      event_id: 'abc',
      user: { email: 'a@b.co', ip_address: '1.2.3.4' },
      request: {
        url: 'https://proiav.space/uk/login?email=a%40b.co',
        query_string: 'email=a%40b.co',
        cookies: { 'sb-access-token': 'x' },
        headers: { Cookie: 'sb=1', Authorization: 'Bearer t', 'User-Agent': 'UA' },
        data: { password: 'p' },
      },
      exception: { values: [{ type: 'Error', value: 'no user maria@example.com' }] },
      extra: { phone: '+380671234567', note: 'call 0671234567' },
    })
    assert.ok(event)
    const json = JSON.stringify(event)
    assert.equal(event.user, undefined)
    assert.equal(event.request?.cookies, undefined)
    assert.equal(event.request?.data, undefined)
    assert.equal(event.request?.url, 'https://proiav.space/uk/login')
    assert.equal(event.request?.headers?.Cookie, '[Filtered]')
    assert.equal(event.request?.headers?.Authorization, '[Filtered]')
    assert.equal(event.request?.headers?.['User-Agent'], 'UA')
    assert.equal(event.event_id, 'abc')
    assert.doesNotMatch(json, /maria@example\.com|0671234567|Bearer t|a%40b\.co/)
  })

  test('refresh_token_not_found не надсилається', () => {
    const ev = { exception: { values: [{ type: 'AuthApiError', value: 'Invalid Refresh Token: Refresh Token Not Found' }] } }
    assert.equal(isExpectedError(ev), true)
    assert.equal(scrubEvent(ev), null)
    assert.equal(scrubEvent({ message: 'refresh_token_not_found' }), null)
    assert.ok(scrubEvent({ message: 'something else broke' }))
  })

  test('breadcrumb з URL і email очищується', () => {
    const crumb = scrubBreadcrumb({ category: 'fetch', data: { url: '/api/x?token=zzz' }, message: 'me@x.io' })
    assert.doesNotMatch(JSON.stringify(crumb), /zzz|me@x\.io/)
  })
})
