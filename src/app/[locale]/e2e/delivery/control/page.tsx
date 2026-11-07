import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { parseDeliveryEta, parseDeliveryStatus } from '@/lib/gallery/delivery'
import { DeliveryStatusControl } from '@/components/gallery/DeliveryStatusControl'
import { HowItWorks } from '@/components/gallery/HowItWorks'
import { galleryHelp } from '@/lib/gallery/help'
import { e2eDeliveryState, e2eResetDelivery, e2eSaveDelivery } from './actions'

/**
 * Test-only page with the dashboard's «Статус для клієнта» control wired to an
 * in-memory save (./actions). ?reset=1 clears it. E2E_THEME_PREVIEW=1 only.
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default async function E2EDeliveryControl({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { reset?: string }
}) {
  if (process.env.E2E_THEME_PREVIEW !== '1' || !isLocale(params.locale)) notFound()
  if (searchParams.reset === '1') await e2eResetDelivery()
  const dict = await getDictionary(params.locale)
  const state = await e2eDeliveryState()
  const t = dict.galleryManage
  return (
    // The saved value is exposed to the test as an attribute only — nothing
    // extra is printed on the page (the control must look as in the dashboard).
    <main
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16"
      data-testid="saved-state"
      data-state={`${state.status ?? 'null'}|${state.eta ?? 'null'}|${state.saves}`}
    >
      <DeliveryStatusControl
        initialStatus={parseDeliveryStatus(state.status)}
        initialEta={parseDeliveryEta(state.eta)}
        save={e2eSaveDelivery}
        labels={{
          title: t.deliveryTitle,
          hint: t.deliveryHint,
          teaser: t.deliveryTeaserHint,
          none: t.deliveryNone,
          shot: t.deliveryShot,
          editing: t.deliveryEditing,
          ready: t.deliveryReady,
          etaLabel: t.deliveryEtaLabel,
          etaHint: t.deliveryEtaHint,
          etaClear: t.deliveryEtaClear,
          saving: t.deliverySaving,
          saved: t.deliverySaved,
          error: t.deliveryError,
        }}
      />
      <HowItWorks help={galleryHelp(params.locale).delivery} testId="help-delivery" />
    </main>
  )
}
