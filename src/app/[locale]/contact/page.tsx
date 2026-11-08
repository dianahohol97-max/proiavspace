import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo/metadata'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SupportForm } from '@/components/support/SupportForm'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const t = (await getDictionary(locale)).support
  return buildMetadata({
    locale,
    path: '/contact',
    languages: ['uk', 'en'],
    title: t.contactMetaTitle,
    absoluteTitle: true,
    description: t.contactLead,
  })
}

/**
 * Public «Контакти»: the same support form as the dashboard panel, with an
 * email field (or the account's, when signed in), a honeypot and a limit of
 * 5 requests per IP per hour (src/lib/support/handler.ts). No captcha.
 * Only on proiav's own pages — photographers' galleries and sites never link here.
 */
export default async function ContactPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const t = (await getDictionary(locale)).support

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  let account: { email: string; userId: string; plan: string } | undefined
  if (user?.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle<{ plan: string | null }>()
    account = { email: user.email, userId: user.id, plan: profile?.plan ?? '—' }
  }

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-xl px-6 pb-20 pt-6">
        <h1 className="text-3xl font-extrabold text-fg sm:text-4xl">{t.contactTitle}</h1>
        <p className="mt-3 text-base leading-7 text-muted">{t.contactLead}</p>
        {account && (
          <p className="mt-3 text-sm font-semibold text-fg">{t.contactSignedIn.replace('{email}', account.email)}</p>
        )}
        <div className="mt-8 rounded-3xl border border-line bg-white p-5 sm:p-7">
          <SupportForm locale={locale} t={t} account={account} />
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
