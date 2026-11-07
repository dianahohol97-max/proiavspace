'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'

/** proiav.space GA4 stream; override per-environment with NEXT_PUBLIC_GA_ID. */
const DEFAULT_GA_ID = 'G-VV417KX665'

/**
 * Pages that belong to a PHOTOGRAPHER or their clients, not to proiav:
 * public sites (/s/…, incl. legal), the theme demos of such sites (/themes,
 * and its test-only twin /e2e/themes), the editor's site preview, client
 * galleries (/g/…) and booking pages (/b/…). Their visitors never agreed to proiav's analytics, so GA is not
 * loaded there at all.
 *
 * Also off on the local-only tools — «Відбір із папки» (/dashboard/cull and
 * its demo /cull-demo): they promise that everything stays in the browser.
 */
const NOT_OURS =
  /^\/[a-z]{2}\/(?:s|g|b)\/|^\/[a-z]{2}\/(?:themes|site-preview|e2e|cull-demo|dashboard\/cull)(?:\/|$)/

export function isProiavAnalyticsPage(pathname: string): boolean {
  return !NOT_OURS.test(pathname)
}

/**
 * Google Analytics 4 — only on proiav's own pages (landing, pricing, blog,
 * comparisons, dashboard…), loaded with lazyOnload so it never competes with
 * the page's first paint. A Measurement ID is public, so the default is fine.
 *
 * If a visitor moves client-side from a proiav page onto a photographer's
 * page, GA is already in memory: the official `ga-disable-<ID>` switch stops
 * it from sending anything there (and is lifted again on proiav pages).
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID || DEFAULT_GA_ID
  const pathname = usePathname() ?? '/'
  const ours = isProiavAnalyticsPage(pathname)

  useEffect(() => {
    if (!id) return
    ;(window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = !ours
  }, [id, ours])

  if (!id || !ours) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="lazyOnload" />
      <Script id="ga-init" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  )
}
