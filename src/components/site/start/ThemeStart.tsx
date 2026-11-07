import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from '../SiteRenderer'
import { MotionRoot, Reveal } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import { ContactLinks, FilterBar, GiftsBlock, TermsBlock } from '../card/blocks'
import { buildCard, mergeSkin, ratioOf } from '../card/data'
import { CardLeadForm, CardNav } from '../card/islands'
import chrome from '../card/Chrome.module.css'
import { PackCta } from '../tysha/PackCta'
import { START_FONT_URL } from './fonts'
import s from './Start.module.css'

/**
 * «Старт» — the simple one: made to look finished with a first portfolio of
 * ten frames. Bright paper, a confident sans name with a hand-drawn marker
 * stroke, one big rounded photo, an even grid that never shows gaps, sticker
 * price tags and a booking pill that rides along the bottom of the phone
 * screen (sticky, no JS) until the form is in view.
 *
 * Effects: the marker stroke draws under the name and the hero photo opens
 * from a rounded window (CSS, from the first paint); frames pop in as they
 * scroll into view (scroll-driven); the price sticker swings on hover; the
 * sticky booking pill on phones.
 */
export function ThemeStart({
  content,
  displayName,
  logoUrl,
  portfolio,
  labels,
  langSwitch,
  leadForm,
  bookingNav,
  platformCredit = false,
}: {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  bookingNav?: BookingNav
  platformCredit?: boolean
}) {
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 9 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate

  // The name with its last word under a marker stroke.
  const words = title.split(/\s+/).filter(Boolean)
  const last = words.pop() ?? ''

  const head = (label: string, heading: string, extra?: React.ReactNode) => (
    <div className={s.sectionHead}>
      <div>
        <span className={s.label}>{label}</span>
        <h2 className={s.sectionTitle}>{heading}</h2>
      </div>
      {extra}
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={START_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={s.root}>
        <CardNav
          skin={skin}
          brand={brand}
          logoUrl={logoUrl}
          links={card.navLinks}
          cta={{ href: bookHref, label: book }}
          langSwitch={langSwitch}
          overHero={false}
          menuLabel={L.menu}
          closeLabel={labels.close}
          footLinks={card.contactLinks}
        />

        {/* ---- 1. first screen ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroFacts}>
              <span className={s.chip} data-card="role">
                {card.role}
              </span>
              {card.city && (
                <span className={s.chip} data-card="city">
                  {card.city}
                </span>
              )}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {words.length > 0 && <>{words.join(' ')} </>}
              <span className={s.marker}>{last}</span>
            </h1>
            {card.directions.length > 0 && (
              <p className={s.heroDirections} data-card="directions">
                {card.directions.join(' · ')}
              </p>
            )}
            {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
            <div className={s.heroActions}>
              <a href={bookHref} className={s.btn} data-card="book">
                {book} <span aria-hidden="true">→</span>
              </a>
              {card.grid.length > 0 && (
                <a href="#portfolio" className={s.btnGhost}>
                  {labels.portfolio}
                </a>
              )}
            </div>
          </div>
          {lead && (
            <div className={s.heroImg} style={{ '--r': ratioOf(lead, '4 / 5') } as React.CSSProperties}>
              <Picture
                src={lead.previewUrl}
                srcSet={lead.srcSet}
                avifSrcSet={lead.avifSrcSet}
                sizes="(max-width: 860px) 360px, 46vw"
                alt={lead.caption || lead.category || title}
                priority
              />
            </div>
          )}
        </header>

        <div className={s.flow}>
          {/* ---- 2. portfolio ---- */}
          {card.grid.length > 0 && (
            <section id="portfolio" className={`${s.section} ${s.wrap}`}>
              {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
              <FilterBar card={card} gridId="start-grid" s={s} />
              <div id="start-grid" className={s.grid}>
                {card.grid.map((p) => (
                  <figure key={p.id} className={s.work} data-cat={p.category ?? ''}>
                    <div className={s.workImg}>
                      <Picture
                        src={p.previewUrl}
                        srcSet={p.srcSet}
                        alt={p.caption || p.category || title}
                        sizes="(max-width: 760px) 50vw, 30vw"
                      />
                    </div>
                    {(p.caption || p.category) && (
                      <figcaption className={s.workCap}>
                        {p.caption}
                        {p.category && <span>{p.category}</span>}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* ---- 3. packages + terms ---- */}
          {packs.length > 0 && (
            <section id="pricing" className={`${s.section} ${s.wrap}`}>
              {head(labels.pricing, labels.pricing)}
              <div className={s.packs}>
                {packs.map((pack, i) => (
                  <Reveal key={pack.name} delay={i * 0.08} y={24} pack={pack.name}>
                    <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                      {pack.price && (
                        <p className={s.sticker} style={{ '--tilt': `${[-4, 3, -2, 4][i % 4]}deg` } as React.CSSProperties}>
                          {pack.price}
                        </p>
                      )}
                      <h3 className={s.packName}>{pack.name}</h3>
                      {pack.featured && <p className={s.packBadge}>{L.popular}</p>}
                      {pack.includes.length > 0 && (
                        <ul className={s.packList}>
                          {pack.includes.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      )}
                      <PackCta pack={pack.name} href={bookHref} className={pack.featured ? s.btn : s.btnGhost}>
                        {L.choosePack} <span aria-hidden="true">→</span>
                      </PackCta>
                    </article>
                  </Reveal>
                ))}
              </div>
              <TermsBlock card={card} s={s} />
            </section>
          )}

          {/* ---- 7. gifts & prints (optional) ---- */}
          <GiftsBlock card={card} s={{ ...s, gifts: `${s.section} ${s.wrap}` }} heading={head(L.giftsTitle, L.giftsTitle)} />

          {/* ---- 4. about ---- */}
          {content.about.text && (
            <section id="about" className={`${s.section} ${s.wrap}`}>
              <div className={`${s.about} ${portrait ? '' : s.aboutSolo}`}>
                {portrait && (
                  <div className={s.aboutImg}>
                    <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
                  </div>
                )}
                <div>
                  <span className={s.label}>{labels.about}</span>
                  <p className={s.aboutText}>{content.about.text}</p>
                  {brand && <p className={s.sign}>— {brand}</p>}
                </div>
              </div>
            </section>
          )}

          {/* ---- 5. reviews (optional) ---- */}
          {reviews.length > 0 && (
            <section id="reviews" className={`${s.section} ${s.wrap}`}>
              {head(L.testimonials, L.testimonials)}
              <div className={s.reviews}>
                {reviews.map((r, i) => (
                  <figure key={i} className={s.review}>
                    <blockquote className={s.reviewText}>{r.text}</blockquote>
                    <figcaption className={s.reviewWho}>
                      {r.photo && (
                        <span className={s.reviewPhoto}>
                          <Picture src={r.photo.previewUrl} srcSet={r.photo.srcSet} alt="" sizes="44px" />
                        </span>
                      )}
                      {r.names}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* phones: the booking pill rides along until the form */}
          <div className={s.dock} aria-hidden="true">
            <a href={bookHref} className={s.dockBtn} tabIndex={-1}>
              {book} <span>→</span>
            </a>
          </div>
        </div>

        {/* ---- 6. booking & contacts ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          <div className={s.contact}>
            <div>
              <span className={s.label}>{labels.contacts}</span>
              <h2 className={s.sectionTitle}>{leadForm ? leadForm.labels.title : labels.contacts}</h2>
              <ContactLinks card={card} s={s} />
              {content.contact.bookingUrl && (
                <a href={content.contact.bookingUrl} className={s.btnGhost}>
                  {labels.book} →
                </a>
              )}
            </div>
            {leadForm && (
              <div className={s.formCard}>
                <CardLeadForm
                  skin={skin}
                  handle={leadForm.handle}
                  labels={leadForm.labels}
                  shootTypes={card.topics}
                  certificateTopic={card.certificateTopic}
                />
              </div>
            )}
          </div>
        </section>

        <footer className={`${s.footer} ${s.wrap}`}>
          <a href="#top" className={s.footName}>
            {brand}
          </a>
          <div className={s.footLinks}>
            {card.contactLinks.map((link) => (
              <a key={link.href} href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {link.label}
              </a>
            ))}
            {platformCredit && (
              <a href={BASE_URL} target="_blank" rel="noopener">
                {L.madeOn}
              </a>
            )}
          </div>
        </footer>
      </div>
    </MotionRoot>
  )
}
