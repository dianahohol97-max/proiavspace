import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from '../SiteRenderer'
import { MotionRoot, Reveal } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import { ContactLinks, FilterBar, GiftsBlock, TermsBlock } from '../card/blocks'
import { buildCard, mergeSkin, type Photo } from '../card/data'
import { CardLeadForm, CardNav } from '../card/islands'
import chrome from '../card/Chrome.module.css'
import { PackCta } from '../tysha/PackCta'
import { INDEX_FONT_URL } from './fonts'
import s from './Index.module.css'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * «Індекс» — commercial work: brands, campaigns, product. A bold condensed
 * grotesk name across the full width, a running ticker of the directions, the
 * portfolio as a numbered INDEX of projects (one per direction, with frame
 * counts) whose preview cycles through that project's frames on hover, and a
 * numbered grid of the best frames.
 *
 * Effects: the name tracks in from wide letter-spacing (CSS); the ticker
 * runs (CSS, still under reduced motion); index rows cycle their preview on
 * hover (CSS); grid numbers count in as frames scroll by (scroll-driven).
 */
export function ThemeIndeks({
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
  const nameLen = Math.max(Array.from(title).length, 6)

  // The index: one project per direction (then other categories), with
  // frame counts over the whole portfolio and up to four frames to cycle.
  const projects: { name: string; count: number; frames: Photo[] }[] = []
  const names = [...card.directions, ...card.photos.map((p) => p.category?.trim() ?? '').filter(Boolean)]
  for (const name of names) {
    if (projects.some((p) => p.name === name)) continue
    const frames = card.photos.filter((p) => p.category?.trim() === name)
    if (frames.length) projects.push({ name, count: frames.length, frames: frames.slice(0, 4) })
  }
  const ticker = card.directions.length > 0 ? card.directions : projects.map((p) => p.name)

  const head = (no: string, heading: string) => (
    <div className={s.sectionHead}>
      <span className={s.sectionNo}>{no}</span>
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={INDEX_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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
          <h1 className={s.heroTitle} data-card="name" style={{ '--len': nameLen } as React.CSSProperties}>
            {title}
          </h1>
          <div className={s.heroRow}>
            <dl className={s.heroFacts}>
              <div>
                <dt>{L.photographer}</dt>
                <dd data-card="role">{card.role}</dd>
              </div>
              {card.city && (
                <div>
                  <dt aria-hidden="true">↳</dt>
                  <dd data-card="city">{card.city}</dd>
                </div>
              )}
              {card.directions.length > 0 && (
                <div className={s.heroDirs}>
                  <dt>{labels.portfolio}</dt>
                  <dd data-card="directions">
                    {card.directions.map((d, i) => (
                      <span key={d}>
                        <b>{pad2(i + 1)}</b> {d}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            {lead && (
              <div className={s.heroImg}>
                <Picture
                  src={lead.previewUrl}
                  srcSet={lead.srcSet}
                  avifSrcSet={lead.avifSrcSet}
                  sizes="(max-width: 760px) 120px, 22vw"
                  alt={lead.caption || lead.category || title}
                  priority
                />
              </div>
            )}
            <a href={bookHref} className={s.btn} data-card="book">
              {book} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        {ticker.length > 0 && (
          <div className={s.ticker} aria-hidden="true">
            <div className={s.tickerTrack}>
              {[0, 1].map((k) => (
                <span key={k}>
                  {ticker.map((t) => (
                    <span key={t}>
                      {t} <i>✕</i>{' '}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ---- 2. portfolio: the index + numbered grid ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head('A', labels.portfolio)}
            {projects.length > 1 && (
              <ol className={s.index}>
                {projects.map((p, i) => (
                  <li key={p.name}>
                    <a href="#index-grid" className={s.row}>
                      <span className={s.rowNo}>{pad2(i + 1)}</span>
                      <span className={s.rowName}>{p.name}</span>
                      <span className={s.rowCount}>
                        {p.count} {L.framesWord}
                      </span>
                      <span className={s.preview} aria-hidden="true" data-n={p.frames.length}>
                        {p.frames.map((f, k) => (
                          <span key={f.id} className={s.previewImg}>
                            <Picture src={f.previewUrl} srcSet={f.srcSet} alt="" sizes="160px" />
                          </span>
                        ))}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
            <FilterBar card={card} gridId="index-grid" s={s} />
            <div id="index-grid" className={s.grid}>
              {card.grid.map((p) => (
                <figure key={p.id} className={s.work} data-cat={p.category ?? ''}>
                  <div className={s.workImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 30vw" />
                  </div>
                  <figcaption className={s.workCap}>
                    <span className={s.workNo} />
                    {p.category}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 3. packages + terms ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${s.section} ${s.wrap}`}>
            {head('B', labels.pricing)}
            <div className={s.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.06} y={14} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    <p className={s.packNo}>{pad2(i + 1)}</p>
                    <h3 className={s.packName}>{pack.name}</h3>
                    {pack.featured && <p className={s.packBadge}>{L.popular}</p>}
                    {pack.price && <p className={s.packPrice}>{pack.price}</p>}
                    {pack.includes.length > 0 && (
                      <ul className={s.packList}>
                        {pack.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <PackCta pack={pack.name} href={bookHref} className={pack.featured ? s.btn : s.btnLine}>
                      {L.choosePack}
                    </PackCta>
                  </article>
                </Reveal>
              ))}
            </div>
            <TermsBlock card={card} s={s} />
          </section>
        )}

        {/* ---- 7. gifts & prints (optional) ---- */}
        <GiftsBlock card={card} s={{ ...s, gifts: `${s.section} ${s.wrap}` }} heading={head('B+', L.giftsTitle)} />

        {/* ---- 4. about ---- */}
        {content.about.text && (
          <section id="about" className={`${s.section} ${s.wrap}`}>
            {head('C', labels.about)}
            <div className={`${s.about} ${portrait ? '' : s.aboutSolo}`}>
              {portrait && (
                <div className={s.aboutImg}>
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
                </div>
              )}
              <p className={s.aboutText}>{content.about.text}</p>
            </div>
          </section>
        )}

        {/* ---- 5. reviews (optional) ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${s.section} ${s.wrap}`}>
            {head('D', L.testimonials)}
            <div className={s.reviews}>
              {reviews.map((r, i) => (
                <figure key={i} className={s.review}>
                  <blockquote className={s.reviewText}>{r.text}</blockquote>
                  <figcaption className={s.reviewWho}>{r.names}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 6. booking & contacts ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          {head('E', leadForm ? leadForm.labels.title : labels.contacts)}
          <div className={s.contact}>
            <div>
              <ContactLinks card={card} s={s} />
              {content.contact.bookingUrl && (
                <a href={content.contact.bookingUrl} className={s.btnLine}>
                  {labels.book}
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
