import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { ClientEmailControl } from '@/components/gallery/ClientEmailControl'
import { ClientPicksExport } from '@/components/gallery/ClientPicksExport'
import {
  pickLabels,
  buildClientPicks,
  lightroomFilterLine,
  picksCsv,
  picksTxt,
} from '@/lib/gallery/client-picks'
import {
  e2eClientEmailState,
  e2eMarkReadyForm,
  e2eReset,
  e2eSaveClientEmail,
  e2eSendAgain,
} from './actions'

/**
 * Test-only page: the dashboard's «Обране клієнта» export and «Лист
 * клієнтові» control on fixed data, with in-memory actions (./actions).
 * ?reset=1 clears the letter state (&ready=0 starts in «Обробка»).
 * ?empty=1 renders the export with no picks. E2E_THEME_PREVIEW=1 only.
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

const key = (name: string) => `u/1/g/2/o/3f2b8a1c-1111-4222-8333-444455556666-${name.replace(/[^\w.-]+/g, '_')}`
const ASSETS = [
  { id: 'a', r2_key: key('IMG_0012.jpg'), source_file_name: 'IMG_0012.jpg' },
  { id: 'b', r2_key: key('IMG_0015.jpg'), source_file_name: 'IMG_0015.jpg' },
  { id: 'c', r2_key: key('DSC 0101.jpg'), source_file_name: 'DSC 0101.jpg' },
  { id: 'd', r2_key: key('IMG_0012.png'), source_file_name: 'IMG_0012.png' },
  // Uploaded before 0066: the name comes from the storage key.
  { id: 'e', r2_key: key('IMG_0200.JPG'), source_file_name: null },
  { id: 'g', r2_key: key('Весілля_007.JPG'), source_file_name: 'Весілля_007.JPG' },
  { id: 'f', r2_key: key('IMG_0099.jpg'), source_file_name: 'IMG_0099.jpg' },
]
const SELECTIONS = [
  { asset_id: 'a', kind: 'favorite', client_token: 'x' },
  { asset_id: 'a', kind: 'retouch', client_token: 'x' },
  { asset_id: 'b', kind: 'favorite', client_token: 'y' },
  { asset_id: 'c', kind: 'favorite', client_token: 'x' },
  { asset_id: 'd', kind: 'favorite', client_token: 'y' },
  { asset_id: 'e', kind: 'retouch', client_token: 'y' },
  { asset_id: 'g', kind: 'favorite', client_token: 'x' },
]

export default async function E2EClientPicks({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { reset?: string; ready?: string; empty?: string }
}) {
  if (process.env.E2E_THEME_PREVIEW !== '1' || !isLocale(params.locale)) notFound()
  if (searchParams.reset === '1') await e2eReset(searchParams.ready !== '0')
  const locale = params.locale
  const dict = await getDictionary(locale)
  const t = dict.galleryManage
  const picks = searchParams.empty === '1' ? [] : buildClientPicks(ASSETS, SELECTIONS)
  const labels = pickLabels(dict.designer)
  const line = lightroomFilterLine(picks)
  const state = await e2eClientEmailState()
  const ready = state.ready

  return (
    <main
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16"
      data-testid="e2e-state"
      data-sent={String(state.sent)}
    >
      <ClientPicksExport
        line={line.text}
        count={line.count}
        skipped={line.skipped}
        txt={picksTxt(picks, labels)}
        csv={picksCsv(picks, labels)}
        fileBase="e2e-marta-bohdan-picks"
        labels={{
          copy: t.picksCopy,
          copied: t.picksCopied,
          copyFailed: t.picksCopyFailed,
          hint: t.picksHint,
          substringNote: t.picksSubstringNote,
          lineLabel: t.picksLineLabel,
          skipped: t.picksSkipped,
          download: t.picksDownload,
        }}
      />
      <ClientEmailControl
        available
        initialEmail={state.email}
        sentAtText={state.sentAt ? new Date(state.sentAt).toISOString().slice(0, 16).replace('T', ' ') : null}
        isReady={ready}
        isPublished
        save={e2eSaveClientEmail}
        sendAgain={e2eSendAgain}
        labels={{
          title: t.clientEmailTitle,
          hint: t.clientEmailHint,
          label: t.clientEmailLabel,
          consent: t.clientEmailConsent,
          save: t.clientEmailSave,
          remove: t.clientEmailRemove,
          saving: t.clientEmailSaving,
          saved: t.clientEmailSaved,
          invalid: t.clientEmailInvalid,
          needConsent: t.clientEmailNeedConsent,
          error: t.clientEmailError,
          unavailable: t.clientEmailUnavailable,
          sentAt: t.clientEmailSentAt,
          waitReady: t.clientEmailWaitReady,
          waitPublish: t.clientEmailWaitPublish,
          sendAgain: t.clientEmailSendAgain,
          sendNow: t.clientEmailSendNow,
          sending: t.clientEmailSending,
          sent: t.clientEmailSent,
          tooSoon: t.clientEmailTooSoon,
          sendFailed: t.clientEmailSendFailed,
        }}
      />
      <form action={e2eMarkReadyForm} className="mt-6">
        <button type="submit" data-testid="e2e-mark-ready" className="text-xs text-muted underline">
          e2e: статус → Готово
        </button>
      </form>
    </main>
  )
}
