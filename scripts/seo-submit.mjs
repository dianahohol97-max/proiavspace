#!/usr/bin/env node
/**
 * Submit the sitemap after a deploy.
 *
 *   npm run seo:submit                 # IndexNow (Bing & co) + Google sitemap
 *   npm run seo:submit -- --inspect    # + Google URL Inspection status for key pages
 *
 * Env:
 *   SITE_URL             default https://proiav.space
 *   INDEXNOW_KEY         same value as in Vercel (served at /indexnow-key.txt)
 *   GOOGLE_SA_JSON       path to a Google service-account JSON key; add the
 *                        service account's e-mail as an OWNER of the property
 *                        in Search Console first
 *   GSC_PROPERTY         default sc-domain:proiav.space (or https://proiav.space/)
 *
 * Note: Google's Indexing API is only for JobPosting/BroadcastEvent pages —
 * it must NOT be used for regular pages. For Google, submit the sitemap and
 * use "Request indexing" in the Search Console UI for the key URLs.
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const SITE = (process.env.SITE_URL ?? 'https://proiav.space').replace(/\/+$/, '')
const SITEMAP = `${SITE}/sitemap.xml`
const PROPERTY = process.env.GSC_PROPERTY ?? `sc-domain:${new URL(SITE).hostname}`
const KEY_PAGES = ['/uk', '/uk/halerei', '/uk/tsiny', '/uk/halereia-z-parolem', '/uk/dlia-vesilnykh-fotohrafiv', '/uk/blog']

async function sitemapUrls() {
  const xml = await (await fetch(SITEMAP)).text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

async function indexNow(urls) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return console.log('• IndexNow: skipped (INDEXNOW_KEY not set)')
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).hostname, key, keyLocation: `${SITE}/indexnow-key.txt`, urlList: urls }),
  })
  console.log(`• IndexNow: ${res.status} ${res.statusText} (${urls.length} URLs)`)
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function googleToken() {
  const path = process.env.GOOGLE_SA_JSON
  if (!path) return null
  const sa = JSON.parse(readFileSync(path, 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key)
  const jwt = `${header}.${claims}.${b64url(signature)}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Google auth failed: ${JSON.stringify(json)}`)
  return json.access_token
}

async function googleSitemap(token) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/sitemaps/${encodeURIComponent(SITEMAP)}`
  const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
  console.log(`• Google sitemap submit: ${res.status} ${res.statusText}`)
}

async function googleInspect(token) {
  for (const path of KEY_PAGES) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: `${SITE}${path}`, siteUrl: PROPERTY, languageCode: 'uk' }),
    })
    const json = await res.json()
    const r = json.inspectionResult?.indexStatusResult
    console.log(`  ${path.padEnd(32)} ${r ? `${r.verdict} · ${r.coverageState}` : JSON.stringify(json.error?.message ?? json)}`)
  }
}

const urls = await sitemapUrls()
console.log(`Sitemap: ${urls.length} URLs`)
await indexNow(urls)
const token = await googleToken()
if (!token) {
  console.log('• Google: skipped (GOOGLE_SA_JSON not set) — submit the sitemap in Search Console → Sitemaps')
} else {
  await googleSitemap(token)
  if (process.argv.includes('--inspect')) {
    console.log('• URL Inspection:')
    await googleInspect(token)
  }
}
