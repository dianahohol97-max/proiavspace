import type { SiteContent } from '@/lib/site/content'
import { LeadForm, type LeadFormLabels } from './LeadForm'
import { SiteLangSwitch } from './SiteLangSwitch'
import {
  groupPortfolio,
  type BookingNav,
  type LangSwitch,
  type PortfolioItem,
  type SiteLabels,
} from './SiteRenderer'
import s from './SiteThemes.module.css'

/**
 * «Галерея» — the museum wall: white, hard 3-column grid, etikett captions,
 * red accent on links only, uppercase Helvetica display. Built for commercial
 * and fashion portfolios where the client judges the hand, not the emotion.
 * Portfolio is grouped into labeled collections (categories).
 */
export function ThemeGallery({
  content,
  displayName,
  logoUrl,
  portfolio,
  labels,
  langSwitch,
  leadForm,
  bookingNav,
}: {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  bookingNav?: BookingNav
}) {
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)
  const hasCategories = groups.some((group) => group.category !== null)

  return (
    <div className={s.gal}>
      <div className={s.galInner}>
        {/* nav */}
        <div className={s.galNav}>
          <span className={s.galBrand}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} />
            ) : (
              brand
            )}
          </span>
          <nav>
            <a href="#portfolio">{labels.portfolio}</a>
            {content.about.text && <a href="#about">{labels.about}</a>}
            {content.pricing.items.length > 0 && <a href="#pricing">{labels.pricing}</a>}
            <a href="#contact">{labels.contacts}</a>
            {bookingNav && <a href={bookingNav.href}>{bookingNav.label}</a>}
            {langSwitch && <SiteLangSwitch langSwitch={langSwitch} />}
          </nav>
        </div>

        {/* hero */}
        <header className={s.galHero}>
          <h1>{content.hero.title || brand}</h1>
          {content.hero.subtitle && <p>{content.hero.subtitle}</p>}
        </header>

        {/* portfolio — grouped collections */}
        {portfolio.length > 0 && (
          <div id="portfolio">
            {groups.map((group) => (
              <section key={group.category ?? '_'}>
                {hasCategories && (
                  <h2 className={s.galCatHead}>{group.category ?? labels.portfolio}</h2>
                )}
                <div className={s.galWorks}>
                  {group.items.map((item, index) => (
                    <figure key={item.id}>
                      <div
                        className={s.galWorkImg}
                        style={
                          item.previewUrl
                            ? { backgroundImage: `url("${item.previewUrl}")` }
                            : undefined
                        }
                      />
                      <figcaption>
                        <span>
                          {item.caption?.trim() ||
                            `${group.category ?? labels.portfolio} — ${String(index + 1).padStart(3, '0')}`}
                        </span>
                        {item.previewUrl && (
                          <a href={item.previewUrl} target="_blank" rel="noopener noreferrer">
                            {labels.viewSeries}
                          </a>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* about */}
        {content.about.text && (
          <section id="about" className={s.galAbout}>
            <p className="lbl">{labels.about}</p>
            <p className="txt">{content.about.text}</p>
          </section>
        )}

        {/* pricing */}
        {content.pricing.items.length > 0 && (
          <section id="pricing" className={s.galPrice}>
            {content.pricing.items.map((item) => (
              <div key={item.name}>
                <h3>{item.name}</h3>
                {item.includes.length > 0 && (
                  <ul>
                    {item.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {item.price && <b>{item.price}</b>}
              </div>
            ))}
          </section>
        )}

        {/* contact */}
        <section id="contact" className={s.galContact}>
          {content.contact.email && (
            <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
          )}
          {content.contact.phone && <a href={`tel:${content.contact.phone}`}>{content.contact.phone}</a>}
          {content.contact.instagram && (
            <a
              href={`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--site-accent)' }}
            >
              @{content.contact.instagram.replace(/^@/, '')}
            </a>
          )}
          {content.contact.bookingUrl && (
            <a className="book" href={content.contact.bookingUrl}>
              {labels.book}
            </a>
          )}
        </section>
        {leadForm && (
          <div style={{ marginTop: 8 }}>
            <LeadForm handle={leadForm.handle} labels={leadForm.labels} />
          </div>
        )}
      </div>
    </div>
  )
}
