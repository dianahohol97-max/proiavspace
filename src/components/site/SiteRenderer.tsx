import { siteCssVars, type SiteMode, type ThemeId } from '@/lib/site/themes'
import type { SiteContent } from '@/lib/site/content'
import { LeadForm, type LeadFormLabels } from './LeadForm'
import { SiteLangSwitch } from './SiteLangSwitch'
import { ThemeGallery } from './ThemeGallery'
import { ThemeSilence } from './ThemeSilence'
import {
  ThemeAir,
  ThemeArchive,
  ThemeFilm,
  ThemeJournal,
  ThemeProduction,
  type ThemeProps,
} from './ThemeVariants'

export interface PortfolioItem {
  id: string
  previewUrl: string | null
  /** Editor-only: the public RPC already filters hidden photos out. */
  visible?: boolean
  /** Collection this photo is grouped under; null/empty = untagged. */
  category?: string | null
  /** Optional short title shown as the photo's caption; null/empty = none. */
  caption?: string | null
}

/** Portfolio grouped into labeled collections, preserving first-seen order. */
export interface PortfolioGroup {
  category: string | null
  items: PortfolioItem[]
}

export function groupPortfolio(items: PortfolioItem[]): PortfolioGroup[] {
  const order: string[] = []
  const map = new Map<string, PortfolioItem[]>()
  for (const item of items) {
    const key = item.category?.trim() ? item.category.trim() : ''
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(item)
  }
  // Untagged photos sort last when named categories exist.
  order.sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0))
  return order.map((key) => ({ category: key || null, items: map.get(key)! }))
}

export interface SiteLabels {
  portfolio: string
  about: string
  pricing: string
  contacts: string
  book: string
  /** Album lightbox: count word (e.g. «фото») and the close action. */
  photos: string
  close: string
  /** «Дивитись серію» — opens an album. */
  viewSeries: string
}

/** One selectable language in a site's switcher. */
export interface LangSwitchOption {
  locale: string
  href: string
  label: string
  current: boolean
}

/** Multilingual switcher for sites offered in more than one language. */
export interface LangSwitch {
  options: LangSwitchOption[]
}

/**
 * The shared block set of the constructor: header, hero, portfolio, about,
 * pricing, contact. Every theme renders THESE blocks — themes only change
 * the CSS custom properties (see lib/site/themes.ts). No platform branding
 * anywhere on the page.
 */
export function SiteRenderer({
  theme,
  mode,
  content,
  displayName,
  logoUrl,
  portfolio,
  labels,
  langSwitch,
  leadForm,
}: {
  theme: ThemeId
  mode: SiteMode
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  /** Present only for bilingual sites. */
  langSwitch?: LangSwitch
  /** Present only when the lead form option is on; handle null in preview. */
  leadForm?: { handle: string | null; labels: LeadFormLabels }
}) {
  const vars = siteCssVars(theme, mode)

  // Themes with their own distinct layout dispatch here; the rest still use
  // the shared block layout below until each gets its own design.
  if (theme === 'tysha') {
    return (
      <div style={vars}>
        <ThemeSilence
          content={content}
          displayName={displayName}
          logoUrl={logoUrl}
          portfolio={portfolio}
          labels={labels}
          langSwitch={langSwitch}
          leadForm={leadForm}
          night={mode === 'night'}
        />
      </div>
    )
  }
  if (theme === 'galereia') {
    return (
      <div style={vars}>
        <ThemeGallery
          content={content}
          displayName={displayName}
          logoUrl={logoUrl}
          portfolio={portfolio}
          labels={labels}
          langSwitch={langSwitch}
          leadForm={leadForm}
        />
      </div>
    )
  }
  const variant: Partial<Record<ThemeId, (p: ThemeProps) => React.ReactElement>> = {
    povitria: ThemeAir,
    plivka: ThemeFilm,
    zhurnal: ThemeJournal,
    arkhiv: ThemeArchive,
    prodakshn: ThemeProduction,
  }
  const Variant = variant[theme]
  if (Variant) {
    return (
      <div style={vars}>
        <Variant
          content={content}
          displayName={displayName}
          logoUrl={logoUrl}
          portfolio={portfolio}
          labels={labels}
          langSwitch={langSwitch}
          leadForm={leadForm}
        />
      </div>
    )
  }

  const label: React.CSSProperties = {
    fontFamily: 'var(--site-font-label)',
    fontSize: '11px',
    letterSpacing: '.18em',
    textTransform: 'uppercase',
    color: 'var(--site-muted)',
  }
  const display: React.CSSProperties = {
    fontFamily: 'var(--site-font-display)',
    fontWeight: 'var(--site-display-weight)' as unknown as number,
    textTransform: 'var(--site-display-transform)' as React.CSSProperties['textTransform'],
    letterSpacing: 'var(--site-display-tracking)',
    lineHeight: 1.1,
    margin: 0,
  }

  const brand = displayName ?? ''
  const portfolioGroups = groupPortfolio(portfolio)

  return (
    <div
      style={{
        ...vars,
        background: 'var(--site-bg)',
        color: 'var(--site-fg)',
        fontFamily: 'var(--site-font-body)',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
        {/* ---- header ---- */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 16,
            padding: '26px 0',
            borderBottom: '1px solid var(--site-line)',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} style={{ maxHeight: 34, width: 'auto' }} />
          ) : (
            <span style={{ ...display, fontSize: 15, letterSpacing: '.24em', textTransform: 'uppercase' }}>
              {brand}
            </span>
          )}
          <nav style={{ ...label, display: 'flex', gap: 22, alignItems: 'baseline' }}>
            <a href="#portfolio" style={{ color: 'inherit', textDecoration: 'none' }}>{labels.portfolio}</a>
            <a href="#about" style={{ color: 'inherit', textDecoration: 'none' }}>{labels.about}</a>
            {content.pricing.items.length > 0 && (
              <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>{labels.pricing}</a>
            )}
            <a href="#contact" style={{ color: 'inherit', textDecoration: 'none' }}>{labels.contacts}</a>
            {langSwitch && <SiteLangSwitch langSwitch={langSwitch} />}
          </nav>
        </header>

        {/* ---- hero ---- */}
        <section style={{ padding: 'clamp(56px, 10vw, 120px) 0 clamp(40px, 7vw, 80px)', textAlign: 'center' }}>
          <h1 style={{ ...display, fontSize: 'clamp(34px, 6.5vw, 72px)', textWrap: 'balance' as never }}>
            {content.hero.title || brand}
          </h1>
          {content.hero.subtitle && (
            <p style={{ ...label, marginTop: 22 }}>{content.hero.subtitle}</p>
          )}
        </section>

        {/* ---- portfolio (grouped into labeled collections) ---- */}
        {portfolio.length > 0 && (
          <section id="portfolio" style={{ paddingBottom: 'clamp(48px, 8vw, 96px)' }}>
            <p style={{ ...label, marginBottom: 20 }}>{labels.portfolio}</p>
            {portfolioGroups.map((group) => {
              const showHeading = portfolioGroups.some((g) => g.category !== null)
              return (
                <div key={group.category ?? '_'} style={{ marginBottom: 36 }}>
                  {showHeading && (
                    <h2
                      style={{
                        ...display,
                        fontSize: 'clamp(18px, 2.6vw, 24px)',
                        marginBottom: 16,
                      }}
                    >
                      {group.category ?? labels.portfolio}
                    </h2>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: 22,
                    }}
                  >
                    {group.items.map((item) => (
                      <span
                        key={item.id}
                        style={{
                          display: 'block',
                          aspectRatio: '4 / 5',
                          borderRadius: 'var(--site-radius)',
                          background: item.previewUrl
                            ? `center / cover no-repeat url("${item.previewUrl}")`
                            : 'var(--site-line)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ---- about ---- */}
        {content.about.text && (
          <section
            id="about"
            style={{
              borderTop: '1px solid var(--site-line)',
              padding: 'clamp(40px, 7vw, 80px) 0',
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
              gap: 32,
            }}
          >
            <p style={label}>{labels.about}</p>
            <p
              style={{
                fontFamily: 'var(--site-font-display)',
                fontSize: 'clamp(17px, 2.2vw, 21px)',
                lineHeight: 1.7,
                margin: 0,
                maxWidth: '56ch',
                whiteSpace: 'pre-line',
              }}
            >
              {content.about.text}
            </p>
          </section>
        )}

        {/* ---- pricing ---- */}
        {content.pricing.items.length > 0 && (
          <section
            id="pricing"
            style={{ borderTop: '1px solid var(--site-line)', padding: 'clamp(40px, 7vw, 80px) 0' }}
          >
            <p style={{ ...label, marginBottom: 24 }}>{labels.pricing}</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 24,
              }}
            >
              {content.pricing.items.map((item) => (
                <div
                  key={item.name}
                  style={{ borderLeft: '1px solid var(--site-line)', paddingLeft: 18 }}
                >
                  <h3 style={{ ...display, fontSize: 19, marginBottom: 6 }}>{item.name}</h3>
                  {item.price && <p style={{ margin: '0 0 10px', fontSize: 15 }}>{item.price}</p>}
                  {item.includes.length > 0 && (
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        fontSize: 13.5,
                        color: 'var(--site-muted)',
                        lineHeight: 1.8,
                      }}
                    >
                      {item.includes.map((line) => (
                        <li key={line}>— {line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- contact ---- */}
        <section
          id="contact"
          style={{
            borderTop: '1px solid var(--site-line)',
            padding: 'clamp(40px, 7vw, 80px) 0 clamp(56px, 9vw, 100px)',
            textAlign: 'center',
          }}
        >
          <p style={{ ...label, marginBottom: 18 }}>{labels.contacts}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                style={{ fontFamily: 'var(--site-font-display)', fontSize: 'clamp(19px, 3vw, 26px)', color: 'inherit', textDecoration: 'none' }}
              >
                {content.contact.email}
              </a>
            )}
            {content.contact.phone && (
              <a href={`tel:${content.contact.phone}`} style={{ color: 'inherit', textDecoration: 'none', fontSize: 15 }}>
                {content.contact.phone}
              </a>
            )}
            {content.contact.instagram && (
              <a
                href={`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...label, color: 'var(--site-fg)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                @{content.contact.instagram.replace(/^@/, '')}
              </a>
            )}
            {content.contact.bookingUrl && (
              <a
                href={content.contact.bookingUrl}
                style={{
                  marginTop: 18,
                  display: 'inline-block',
                  border: '1px solid var(--site-fg)',
                  padding: '13px 32px',
                  fontFamily: 'var(--site-font-label)',
                  fontSize: 11,
                  letterSpacing: '.2em',
                  textTransform: 'uppercase',
                  color: 'inherit',
                  textDecoration: 'none',
                  borderRadius: 'var(--site-radius)',
                }}
              >
                {labels.book}
              </a>
            )}
          </div>
          {leadForm && <LeadForm handle={leadForm.handle} labels={leadForm.labels} />}
        </section>
      </div>
    </div>
  )
}
