import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, locales } from '@/lib/i18n/config'
import { brandOgImage } from '@/lib/seo/pages'
import { BASE_URL, BRAND, OG_LOCALE, isIndexedLocale } from '@/lib/seo/site'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import '@/app/globals.css'

/**
 * Site-wide DEFAULTS only. Every marketing page builds its own complete
 * metadata via buildMetadata() (src/lib/seo/metadata.ts); these fallbacks
 * cover the pages that don't — client galleries and booking links, which are
 * noindex and only need a sane title and share card. No canonical here: a
 * canonical inherited from the layout would point every child page at /uk.
 */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const uk = locale === 'uk'
  const title = uk ? 'проЯв — онлайн-галереї для фотографів' : 'proiav — online client galleries for photographers'
  const description = uk
    ? 'Онлайн-галерея для фотографа: передайте зйомку клієнту красивим посиланням, з відбором фото, паролем і завантаженням оригіналів.'
    : 'Online client galleries for photographers: deliver a shoot with a beautiful link, favourites, a password and full-resolution downloads.'

  const verificationOther: Record<string, string> = {}
  if (process.env.BING_SITE_VERIFICATION) verificationOther['msvalidate.01'] = process.env.BING_SITE_VERIFICATION

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,
    applicationName: BRAND,
    openGraph: {
      type: 'website',
      siteName: BRAND,
      locale: OG_LOCALE[locale] ?? 'uk_UA',
      title,
      description,
      images: [{ url: brandOgImage(locale), width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [brandOgImage(locale)] },
    robots: isIndexedLocale(locale) ? { index: true, follow: true } : { index: false, follow: true },
    // Search Console / Bing Webmaster ownership tags — set the env vars in Vercel.
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
      ...(Object.keys(verificationOther).length ? { other: verificationOther } : {}),
    },
    // Belt-and-suspenders with <html translate="no">: page-level opt-out from
    // machine translation, which corrupts React-managed DOM (see layout note).
    other: { google: 'notranslate' },
  }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) notFound()

  return (
    // translate="no" + notranslate app-wide: browser machine translation
    // (Chrome auto-translate, Safari translate) rewrites the SSR DOM before
    // React hydrates → hydration mismatch (#418/#423) → root re-render races
    // the still-active translator → fatal removeChild/appendChild and a white
    // screen (reproduced 1:1 in a headless simulation). The app ships its own
    // localization (uk/en + per-site languages), so MT adds nothing here.
    <html lang={params.locale} translate="no" className="notranslate">
      <body className="min-h-screen bg-bg text-fg antialiased">
        {children}
        {/* Lightweight crash telemetry: on the first uncaught client error per
            page, POST message+stack to /api/debug-log (→ debug_events). This
            forensics loop is what finally located the galleries.style grant
            bug, so it stays — silent, no UI, ~0 cost when nothing breaks. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var sent=false;function s(m){if(sent)return;sent=true;try{fetch('/api/debug-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,ua:navigator.userAgent,message:String(m).slice(0,4000)})}).catch(function(){});}catch(_){}}window.addEventListener('error',function(ev){var t=ev&&ev.error;s((t&&t.message?t.message:(ev&&ev.message?ev.message:'error'))+(t&&t.stack?'\\n'+t.stack:''));});window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;s('promise: '+(r&&(r.stack||r.message)?(r.stack||r.message):String(r)));});})();",
          }}
        />
        <GoogleAnalytics />
      </body>
    </html>
  )
}
