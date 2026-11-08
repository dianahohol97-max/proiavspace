import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { APP_THEME_COLOR, appMetadata } from '@/lib/app/manifest'
import type { AppEvent } from '@/lib/app/events'
import { AppShell } from '@/components/app/AppShell'
import { InstallAppCard } from '@/components/app/InstallAppCard'
import { NotificationSettings } from '@/components/app/NotificationSettings'
import { OfflinePortfolio } from '@/components/app/OfflinePortfolio'
import { QuickActions } from '@/components/app/QuickActions'
import { Uploader } from '@/components/Uploader'

/**
 * Test-only page (tests/e2e/photographer-app.spec.ts): the phone app's
 * pieces on fixed data, without a database — the dashboard <head> (manifest,
 * home-screen icon), the service worker, quick actions and client events,
 * install card, notification settings, offline portfolio and the uploader.
 * API calls are answered by the test (page.route). E2E_THEME_PREVIEW=1 only.
 */
export const dynamic = 'force-dynamic'

/** A real P-256 public key (format only: nothing is ever sent with it). */
const E2E_VAPID_PUBLIC_KEY = 'BK__dyIj0tHueCZXQ9xwrOHV7-3QxjpXknJsN0Zcpr_KhUvzU5bNrFpa-DNznDhyQwY41DOqYAqVnnSOGVvgJSo'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return { robots: { index: false, follow: false }, ...appMetadata(params.locale) }
}

export const viewport: Viewport = { themeColor: APP_THEME_COLOR }

const E2E_GALLERIES = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'Весілля Ані й Марка', photoCount: 4, coverUrl: '/themes/01-1080.webp' },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Сімейна прогулянка', photoCount: 3, coverUrl: '/themes/02-1080.webp' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'Портрет у студії', photoCount: 2, coverUrl: '/themes/03-1080.webp' },
  { id: '44444444-4444-4444-8444-444444444444', title: 'Хрестини', photoCount: 2, coverUrl: '/themes/04-1080.webp' },
]

export default async function E2EPhotographerApp({ params }: { params: { locale: string } }) {
  if (process.env.E2E_THEME_PREVIEW !== '1' || !isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  const events: AppEvent[] = [
    { kind: 'retouch', at: ago(3), galleryId: E2E_GALLERIES[0].id, galleryTitle: E2E_GALLERIES[0].title, count: 5 },
    { kind: 'favorite', at: ago(50), galleryId: E2E_GALLERIES[0].id, galleryTitle: E2E_GALLERIES[0].title, count: 24 },
    { kind: 'booking', at: ago(60 * 5), clientName: 'Олена', startsAt: '2026-11-14T11:00:00' },
  ]

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
      <AppShell locale={locale} />
      <QuickActions
        t={dict.app}
        locale={locale}
        lastPublished={{ title: E2E_GALLERIES[0].title, url: `http://localhost/${locale}/g/anya-marko` }}
        events={events}
      />
      <InstallAppCard t={dict.app} />
      <NotificationSettings t={dict.app} locale={locale} publicKey={E2E_VAPID_PUBLIC_KEY} />
      <section>
        <h2 className="mb-3 font-brand text-2xl">{dict.app.offlineTitle}</h2>
        <OfflinePortfolio t={dict.app} locale={locale} galleries={E2E_GALLERIES} />
      </section>
      <section data-testid="uploader">
        <Uploader
          galleryId="55555555-5555-4555-8555-555555555555"
          dropHint={dict.galleryManage.dropHint}
          videoPlanNotice={dict.galleryManage.videoPlanNotice}
          videoPlanLink={dict.galleryManage.videoPlanLink}
          billingHref={`/${locale}/dashboard/billing`}
          pickPhoneLabel={dict.app.uploadPickPhone}
          backgroundHint={dict.app.uploadBackgroundHint}
          pausedHint={dict.app.uploadPaused}
        />
      </section>
    </main>
  )
}
