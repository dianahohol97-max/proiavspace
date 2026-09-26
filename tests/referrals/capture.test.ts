/**
 * Referral link capture (BUG-03): the ?ref= code is stored in a 30-day cookie
 * by the middleware and claimed in the auth callback, so Google / magic-link
 * signups and later signups still link to the inviter.
 */
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import {
  REF_COOKIE,
  captureRefParam,
  normalizeRefCode,
} from '../../src/lib/referrals'
import { codeOf, dbAvailable, installMocks, profile, session, signUp } from './harness'

describe('normalizeRefCode', () => {
  test('trims, lowercases, rejects anything that is not an 8-char hex code', () => {
    assert.equal(normalizeRefCode(' ABCDEF12 '), 'abcdef12')
    assert.equal(normalizeRefCode('abcdef1'), null)
    assert.equal(normalizeRefCode('<script>'), null)
    assert.equal(normalizeRefCode(null), null)
  })
})

describe('middleware: captureRefParam', () => {
  const run = (url: string, cookie?: string) => {
    const request = new NextRequest(url, cookie ? { headers: { cookie } } : undefined)
    const response = NextResponse.next()
    const stored = captureRefParam(request, response)
    return { stored, cookie: response.cookies.get(REF_COOKIE) }
  }

  test('?ref= on any page → cookie for 30 days, path /', () => {
    const { stored, cookie } = run('https://proiav.space/uk/tsiny?ref=ABCDEF12')
    assert.equal(stored, 'abcdef12')
    assert.equal(cookie?.value, 'abcdef12')
    assert.equal(cookie?.maxAge, 30 * 24 * 3600)
    assert.equal(cookie?.path, '/')
    assert.equal(cookie?.httpOnly, false)
  })

  test('first inviter wins: an existing cookie is not overwritten', () => {
    const { stored, cookie } = run('https://proiav.space/uk/login?ref=abcdef12', `${REF_COOKIE}=11111111`)
    assert.equal(stored, null)
    assert.equal(cookie, undefined)
  })

  test('garbage ref → no cookie', () => {
    assert.equal(run('https://proiav.space/uk?ref=%3Cscript%3E').cookie, undefined)
    assert.equal(run('https://proiav.space/uk').cookie, undefined)
  })
})

const skip = !dbAvailable && 'run via tests/referrals/run.sh'
describe('auth callback claims the cookie', { skip }, () => {
  before(async () => {
    if (!skip) await installMocks()
  })

  async function callback(userId: string | null, cookie?: string) {
    session.userId = userId
    const { GET } = await import('@/app/auth/callback/route')
    const request = new NextRequest(
      'https://proiav.test/auth/callback?next=/uk/dashboard',
      cookie ? { headers: { cookie } } : undefined
    )
    return GET(request)
  }

  test('Google / magic-link signup with the cookie → linked, cookie cleared', async () => {
    const referrer = signUp()
    const me = signUp()
    const res = await callback(me, `${REF_COOKIE}=${codeOf(referrer)}`)
    assert.equal(res.status, 307)
    assert.equal(res.headers.get('location'), 'https://proiav.test/uk/dashboard')
    assert.equal(profile(me).referred_by, referrer)
    assert.equal(res.cookies.get(REF_COOKIE)?.value, '')
    assert.equal(res.cookies.get(REF_COOKIE)?.maxAge, 0)
  })

  test('sign-in of an existing (old) account with a stray cookie → nothing happens', async () => {
    const referrer = signUp()
    const old = signUp({ createdAgo: '3 days' })
    await callback(old, `${REF_COOKIE}=${codeOf(referrer)}`)
    assert.equal(profile(old).referred_by, null)
  })

  test('no cookie → plain redirect', async () => {
    const me = signUp()
    const res = await callback(me)
    assert.equal(res.status, 307)
    assert.equal(profile(me).referred_by, null)
  })
})
