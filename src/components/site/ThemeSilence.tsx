import type { SiteContent } from '@/lib/site/content'
import { LeadForm, type LeadFormLabels } from './LeadForm'
import { PortfolioAlbums } from './PortfolioAlbums'
import { SiteLangSwitch } from './SiteLangSwitch'
import {
  groupPortfolio,
  type BookingNav,
  type LangSwitch,
  type PortfolioItem,
  type SiteLabels,
} from './SiteRenderer'
import s from './SiteThemes.module.css'

const RATIOS = [s.r34, s.r43, s.r11]

function bg(url: string | null | undefined): React.CSSProperties | undefined {
  return url ? { backgroundImage: `url("${url}")` } : undefined
}

/**
 * One infinitely-scrolling row: items laid out twice so the CSS
 * translateX(-50%) loops seamlessly; aspect ratios cycle for the varied,
 * editorial rhythm of the reference.
 */
function Marquee({ items, dir }: { items: PortfolioItem[]; dir: 'm1' | 'm2' }) {
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div className={`${s.sMarquee} ${dir === 'm1' ? s.m1 : s.m2}`}>
      {doubled.map((item, index) => (
        <div
          key={`${item.id}-${index}`}
          className={`${s.cell} ${RATIOS[index % RATIOS.length]}`}
          style={bg(item.previewUrl)}
        />
      ))}
    </div>
  )
}

/**
 * «Тиша» / «Опівніч» — the flagship, built to the design demo: full-bleed
 * hero, two portfolio marquees drifting toward each other, numbered genre
 * cards (from categories), an inverted quote band for the bio, a staggered
 * catalogue grid with index captions, and an about block with mono labels.
 */
export function ThemeSilence({
  content,
  displayName,
  logoUrl,
  portfolio,
  labels,
  langSwitch,
  leadForm,
  bookingNav,
  night = false,
}: {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  bookingNav?: BookingNav
  /** «Опівніч»: night hero — the giant name over drifting photos. */
  night?: boolean
}) {
  const brand = displayName ?? ''
  // The chosen hero photo (content.hero.imageId), falling back to the first.
  const heroImg =
    portfolio.find((p) => p.id === content.hero.imageId)?.previewUrl ??
    portfolio[0]?.previewUrl ??
    null
  const rowA = portfolio.filter((_, i) => i % 2 === 0)
  const rowB = portfolio.filter((_, i) => i % 2 === 1)
  const floats = portfolio.slice(0, 4)
  const floatClass = [s.sFl1, s.sFl2, s.sFl3, s.sFl4]
  // Albums = named categories; show cover-per-folder when the photographer used them.
  const portfolioGroups = groupPortfolio(portfolio)
  const hasAlbums = portfolioGroups.some((g) => g.category !== null)

  return (
    <div className={s.silence}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* nav */}
        <nav className={`${s.sNav} ${s.sPad}`}>
          <span className={s.sMono}>
            <a href="#catalog">{labels.portfolio}</a>
            {' · '}
            <a href="#about">{labels.about}</a>
          </span>
          <span className={s.sWordmark}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} />
            ) : (
              brand
            )}
          </span>
          <span className={`${s.sMono} ${s.sNavRight}`}>
            {content.pricing.items.length > 0 && <a href="#pricing">{labels.pricing}</a>}
            <a href="#contact">{labels.contacts}</a>
            {bookingNav && <a href={bookingNav.href}>{bookingNav.label}</a>}
            {langSwitch && (
              <span className={s.sLang}>
                <SiteLangSwitch langSwitch={langSwitch} />
              </span>
            )}
          </span>
        </nav>

        {/* hero — night: drifting photos + giant name; day: full-bleed cover */}
        {night ? (
          <header className={s.sNight}>
            {floats.map((item, index) => (
              <div key={item.id} className={`${s.sFl} ${floatClass[index]}`} style={bg(item.previewUrl)} />
            ))}
            <div className={s.sNightName}>
              <h1>{content.hero.title || brand}</h1>
              {content.hero.subtitle && <p className={s.sMono}>{content.hero.subtitle}</p>}
            </div>
          </header>
        ) : (
          <header className={s.sHero}>
            <div className={s.sHeroImg} style={bg(heroImg)} />
            <div className={s.sHeroText}>
              <h1>{content.hero.title || brand}</h1>
              {content.hero.subtitle && <p>{content.hero.subtitle}</p>}
            </div>
            {content.hero.subtitle && (
              <span className={`${s.sMono} ${s.sCorner} ${s.sCornerL}`}>{content.hero.subtitle}</span>
            )}
            {portfolio.length > 0 && (
              <span className={`${s.sMono} ${s.sCorner} ${s.sCornerR}`}>{labels.portfolio} ↓</span>
            )}
          </header>
        )}

        {/* strip-zone — two marquees drifting toward each other */}
        {portfolio.length > 0 && (
          <section style={{ padding: 'clamp(40px, 7vw, 80px) 0 0' }}>
            <div className={`${s.sLabels} ${s.sPad}`} style={{ margin: '0 auto 20px' }}>
              <span className={s.sMono}>{labels.portfolio}</span>
              <span className={s.sMono}>{portfolio.length}</span>
            </div>
            <div className={s.sMarquees}>
              <Marquee items={rowA} dir="m1" />
              {rowB.length > 0 && <Marquee items={rowB} dir="m2" />}
            </div>
          </section>
        )}

        {/* about — inverted quote band */}
        {content.about.text && (
          <section id="about" className={s.sBand}>
            <blockquote>{content.about.text}</blockquote>
          </section>
        )}

        {/* catalogue — albums (folders) when categories exist, else a flat grid */}
        {portfolio.length > 0 && (
          <div className={s.sPad}>
            <span className={s.sMono} style={{ display: 'block', margin: '0 0 18px' }}>
              {labels.portfolio}
            </span>
            <div id="catalog">
              {hasAlbums ? (
                <PortfolioAlbums
                  groups={portfolioGroups}
                  covers={content.albumCovers}
                  labels={{
                    portfolio: labels.portfolio,
                    photos: labels.photos,
                    viewSeries: labels.viewSeries,
                    close: labels.close,
                  }}
                />
              ) : (
                <div className={s.sGrid}>
                  {portfolio.map((item, index) => (
                    <figure key={item.id} className={s.sWork}>
                      <div className={s.sWorkImg} style={bg(item.previewUrl)} />
                      <figcaption className={s.sWorkCap}>
                        <span className={`${s.sMono} ${s.sWorkIdx}`}>
                          ({String(index + 1).padStart(3, '0')})
                        </span>
                        {(item.caption || item.category) && (
                          <span className={s.sWorkName}>{item.caption || item.category}</span>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* pricing */}
        {content.pricing.items.length > 0 && (
          <div className={s.sPad}>
            <h2 id="pricing" className={s.sSvcHead}>
              {labels.pricing}
            </h2>
            <div className={s.sSvcGrid}>
              {content.pricing.items.map((item, index) => (
                <div key={item.name} className={s.sSvc}>
                  <span className={s.sSvcNo}>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.name}</h3>
                  {item.price && <p className={s.sPrice}>{item.price}</p>}
                  {item.includes.length > 0 && (
                    <ul>
                      {item.includes.map((line) => (
                        <li key={line}>— {line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* contact — contacts + booking on the left, lead form on the right */}
        <div className={s.sPad}>
          <section id="contact" className={s.sAbout}>
            <div className={s.sAboutLabels}>
              {content.contact.email && (
                <div>
                  <span className={s.sMono}>{labels.contacts}</span>
                  <a className="val" href={`mailto:${content.contact.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {content.contact.email}
                  </a>
                </div>
              )}
              {content.contact.instagram && (
                <div>
                  <span className={s.sMono}>Instagram</span>
                  <a
                    className="val"
                    href={`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    @{content.contact.instagram.replace(/^@/, '')}
                  </a>
                </div>
              )}
              {content.contact.phone && (
                <div>
                  <span className={s.sMono}>{labels.book}</span>
                  <a className="val" href={`tel:${content.contact.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {content.contact.phone}
                  </a>
                </div>
              )}
              {content.contact.bookingUrl && (
                <a className={s.sBook} href={content.contact.bookingUrl}>
                  {labels.book}
                </a>
              )}
            </div>
            {leadForm && (
              <div className={s.sAboutForm}>
                <LeadForm handle={leadForm.handle} labels={leadForm.labels} />
              </div>
            )}
          </section>
        </div>

        {/* foot */}
        <div className={s.sPad}>
          <div className={s.sFoot}>
            <span className={s.sMono}>{brand}</span>
            {content.contact.bookingUrl && (
              <a className={s.sMono} href={content.contact.bookingUrl}>
                {labels.book} →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
