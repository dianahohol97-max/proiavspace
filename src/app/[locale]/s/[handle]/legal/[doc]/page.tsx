import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { renderClientPolicy, type PolicyDoc } from '@/lib/legal/clientPolicies'
import { localizedSiteContent, parseSiteContent } from '@/lib/site/content'
import { isThemeId } from '@/lib/site/themes'
import { siteCssVars } from '@/lib/site/themes'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface SiteRow {
  theme: string
  mode: string
  content: unknown
  display_name: string | null
  logo_key: string | null
}

function isDoc(value: string): value is PolicyDoc {
  return value === 'privacy' || value === 'refund'
}

async function loadSite(handle: string): Promise<SiteRow | null> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.rpc('get_site', { p_handle: handle })
  return (data as SiteRow[] | null)?.[0] ?? null
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; handle: string; doc: string }
}): Promise<Metadata> {
  if (!isDoc(params.doc)) return { robots: { index: false, follow: false } }
  const site = await loadSite(params.handle)
  if (!site) return { robots: { index: false, follow: false } }
  const content = localizedSiteContent(parseSiteContent(site.content), params.locale)
  const policy = renderClientPolicy(params.doc, {
    name: site.display_name ?? content.hero.title,
    email: content.contact.email,
    locale: params.locale,
  })
  return {
    title: { absolute: `${policy.title} — ${site.display_name ?? params.handle}` },
    alternates: { canonical: `/${params.locale}/s/${params.handle}/legal/${params.doc}` },
    // Client policies are useful, not content to rank.
    robots: { index: false, follow: true },
  }
}

export default async function ClientPolicyPage({
  params,
}: {
  params: { locale: string; handle: string; doc: string }
}) {
  if (!isLocale(params.locale) || !isDoc(params.doc)) notFound()
  const site = await loadSite(params.handle)
  if (!site || !isThemeId(site.theme)) notFound()

  const content = localizedSiteContent(parseSiteContent(site.content), params.locale)
  const brand = site.display_name ?? (content.hero.title || params.handle)
  const policy = renderClientPolicy(params.doc, {
    name: brand,
    email: content.contact.email,
    locale: params.locale,
  })
  const uk = params.locale === 'uk'
  const vars = siteCssVars(site.theme, site.mode === 'night' ? 'night' : 'light')

  return (
    <main
      style={{
        ...vars,
        background: 'var(--site-bg)',
        color: 'var(--site-fg)',
        fontFamily: 'var(--site-font-body)',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <Link
          href={`/${params.locale}/s/${params.handle}`}
          style={{ color: 'var(--site-muted)', textDecoration: 'none', fontSize: 14 }}
        >
          ← {brand}
        </Link>

        <h1
          style={{
            fontFamily: 'var(--site-font-display)',
            fontWeight: 'var(--site-display-weight)' as unknown as number,
            fontSize: 'clamp(28px, 5vw, 44px)',
            lineHeight: 1.1,
            margin: '28px 0 8px',
          }}
        >
          {policy.title}
        </h1>
        <p style={{ color: 'var(--site-muted)', fontSize: 13, margin: '0 0 32px' }}>
          {uk ? 'Оновлено для сайту ' : 'For the site of '} {brand}
        </p>

        <article style={{ display: 'flex', flexDirection: 'column', gap: 14, lineHeight: 1.75 }}>
          {policy.blocks.map((block, i) =>
            block.startsWith('# ') ? (
              <h2
                key={i}
                style={{
                  fontFamily: 'var(--site-font-display)',
                  fontSize: 18,
                  margin: '18px 0 0',
                }}
              >
                {block.slice(2)}
              </h2>
            ) : (
              <p key={i} style={{ margin: 0, maxWidth: '62ch' }}>
                {block}
              </p>
            )
          )}
        </article>

        <p style={{ marginTop: 40, fontSize: 13, color: 'var(--site-muted)' }}>
          <Link
            href={`/${params.locale}/s/${params.handle}/legal/${params.doc === 'privacy' ? 'refund' : 'privacy'}`}
            style={{ color: 'inherit' }}
          >
            {params.doc === 'privacy'
              ? uk
                ? 'Умови оплати та повернення →'
                : 'Payment & refund terms →'
              : uk
                ? 'Політика конфіденційності →'
                : 'Privacy policy →'}
          </Link>
        </p>
      </div>
    </main>
  )
}
