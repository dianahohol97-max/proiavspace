import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, locales } from '@/lib/i18n/config'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import '@/app/globals.css'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const uk = locale === 'uk'

  const title = uk
    ? 'проЯв — галереї, сайти і бронювання для фотографів'
    : 'Proiav — galleries, sites and booking for photographers'
  const description = uk
    ? 'Передавайте зйомки клієнтам у красивих онлайн-галереях, збирайте персональний сайт за вечір і приймайте бронювання з оплатою напряму на вашу картку. 3 ГБ безкоштовно, без нашого брендингу на платних тарифах.'
    : 'Deliver shoots to clients in beautiful online galleries, build a personal site in an evening and take bookings paid straight to your card. 3 GB free.'

  return {
    metadataBase: new URL(BASE_URL),
    title: { default: title, template: uk ? '%s · проЯв' : '%s · Proiav' },
    description,
    applicationName: 'проЯв',
    keywords: uk
      ? [
          'онлайн галерея для фотографа',
          'передати фото клієнту',
          'сайт для фотографа',
          'бронювання фотосесії',
          'галерея фотографій з паролем',
          'фотограф Україна',
        ]
      : ['online client gallery', 'photographer website builder', 'photo session booking', 'Ukraine'],
    alternates: {
      // The marketing landing exists only in Ukrainian and English. The other
      // client-facing locales render the English copy, so they canonicalize to
      // /en — Google consolidates the signal instead of seeing duplicates.
      // (Gallery/booking/site pages set their own canonical and override this.)
      canonical: locale === 'uk' ? '/uk' : '/en',
      languages: { uk: '/uk', en: '/en', 'x-default': '/uk' },
    },
    openGraph: {
      type: 'website',
      siteName: 'проЯв',
      locale: uk ? 'uk_UA' : 'en_US',
      alternateLocale: uk ? ['en_US'] : ['uk_UA'],
      url: `/${locale}`,
      title,
      description,
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: uk
            ? 'проЯв — усе, що стається після зйомки'
            : 'Proiav — everything after the shutter clicks',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    // Google Search Console ownership tag — set the env after registering.
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
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
