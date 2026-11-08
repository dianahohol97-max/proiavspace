import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { THEME_DEMOS } from '@/lib/site/demoContent'
import { SiteRenderer, type SiteLabels } from '@/components/site/SiteRenderer'
import { getDictionary } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n/format'
import { leadFormLabelsFromDict, siteLabelsFromDict } from '@/lib/site/labels'

export const dynamic = 'force-dynamic'

/** The theme's name in this language (transliterated outside Ukrainian — GLOSSARY). */
function themeName(dict: Awaited<ReturnType<typeof getDictionary>>, value: string, fallback: string): string {
  const key = `theme${value.charAt(0).toUpperCase()}${value.slice(1)}` as keyof typeof dict.site
  const name = dict.site[key]
  return typeof name === 'string' ? name : fallback
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; value: string }
}): Promise<Metadata> {
  const demo = THEME_DEMOS.find((d) => d.value === params.value)
  if (!demo || !isLocale(params.locale)) return { robots: { index: false, follow: true } }
  const dict = await getDictionary(params.locale)
  const title = formatMessage(dict.pages.themeDemoTitle, { name: themeName(dict, demo.value, demo.name) }, params.locale)
  return { title, robots: { index: false, follow: true } }
}

/** Full-page live preview of a single theme's demo site (real size, scrollable). */
export default async function ThemePreviewPage({
  params,
}: {
  params: { locale: string; value: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const demo = THEME_DEMOS.find((d) => d.value === params.value)
  if (!demo) notFound()

  // Every wording — site labels, the form and the demo bar — comes from the
  // dictionary of this locale.
  const dict = await getDictionary(locale)
  const labels: SiteLabels = siteLabelsFromDict(dict, locale)
  const leadFormLabels = leadFormLabelsFromDict(dict)
  const name = { name: themeName(dict, demo.value, demo.name) }

  return (
    <>
      {/* thin bar so the viewer knows this is a demo and can get back; one
          line at a fixed height, so the web font arriving never shifts the page */}
      <div className="flex h-[52px] items-center justify-between gap-3 overflow-hidden border-b border-line bg-bg px-4 text-sm">
        <span className="min-w-0 truncate font-semibold">
          {formatMessage(dict.pages.themeDemoBanner, name, locale)}
        </span>
        <span className="flex shrink-0 items-center gap-4 whitespace-nowrap">
          <Link href={`/${locale}/themes`} className="hidden text-muted no-underline hover:text-fg sm:inline">
            ← {dict.pages.themeDemoAll}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="rounded-full bg-accent px-4 py-1.5 font-semibold text-white no-underline hover:bg-accent-deep"
          >
            {formatMessage(dict.pages.themeDemoChoose, name, locale)}
          </Link>
        </span>
      </div>

      <SiteRenderer
        theme={demo.theme}
        mode={demo.mode}
        content={demo.content}
        displayName={demo.displayName}
        logoUrl={null}
        portfolio={demo.portfolio}
        freeDates={demo.freeDates}
        labels={labels}
        leadForm={{ handle: null, labels: leadFormLabels }}
      />
    </>
  )
}
