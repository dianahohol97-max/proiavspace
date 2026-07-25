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
    <html lang={params.locale}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        {children}
        {/* TEMP diagnostic: surface any uncaught client error / hydration /
            chunk-load failure on-screen so it can be read without DevTools.
            Installed before hydration so it catches those too. Remove once the
            gallery crash is diagnosed. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function s(m){try{var e=document.getElementById('__diag');if(!e){e=document.createElement('div');e.id='__diag';e.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b00020;color:#fff;font:12px/1.45 ui-monospace,monospace;padding:10px 14px;white-space:pre-wrap;word-break:break-word;max-height:50vh;overflow:auto';document.body.appendChild(e);}e.textContent='\\u26A0 '+m;}catch(_){}}window.addEventListener('error',function(ev){var t=ev&&ev.error;s((t&&t.message?t.message:(ev&&ev.message?ev.message:'error'))+(t&&t.stack?'\\n'+t.stack:''));});window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;s('promise: '+(r&&r.stack?r.stack:(r&&r.message?r.message:String(r))));});})();",
          }}
        />
      </body>
      <GoogleAnalytics />
    </html>
  )
}
