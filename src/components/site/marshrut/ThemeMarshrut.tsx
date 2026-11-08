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
import { ROUTE_FONT_URL } from './fonts'
import { parseStops, routePath, routePoints } from './stops'
import s from './Route.module.css'

/**
 * «Маршрут» — a photographer on the road: map paper with contour lines,
 * spruce ink, route rust. The first screen is a small hand-drawn map (no map
 * service, no tiles): the stops of the coming weeks — from the «фірмовий
 * кадр» phrase («Карпати 12–14; Львів 18–19») — joined by a route that draws
 * itself, beside the name and the first frame. The same stops come back as
 * travel tickets next to the form («де я буду найближчим часом»).
 *
 * Effects: the route draws and the pins drop (CSS); place tags on portfolio
 * frames stamp in on scroll (scroll-driven); the next stop pulses; contour
 * lines on the paper.
 */
export function ThemeMarshrut({
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
  const stops = parseStops(content.moment.text)
  const pts = routePoints(stops.length)
  const path = routePath(pts)

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={ROUTE_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: name, photo and the route ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroRole} data-card="role">
              {card.role}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
            {card.directions.length > 0 && (
              <p className={s.heroDirs} data-card="directions">
                {card.directions.join(' · ')}
              </p>
            )}
            {card.city && (
              <p className={s.heroCity} data-card="city">
                <span aria-hidden="true">⌂</span> {card.city}
              </p>
            )}
            <a href={bookHref} className={s.btn} data-card="book">
              {book} →
            </a>
          </div>
          <div className={s.heroSide}>
            {lead && (
              <div className={s.heroImg} style={{ '--r': ratioOf(lead, '3 / 2') } as React.CSSProperties}>
                <Picture
                  src={lead.previewUrl}
                  srcSet={lead.srcSet}
                  avifSrcSet={lead.avifSrcSet}
                  sizes="(max-width: 760px) 92vw, 46vw"
                  alt={lead.caption || lead.category || title}
                  priority
                />
                {lead.caption && <span className={s.tag}>{lead.caption}</span>}
              </div>
            )}
            {stops.length >= 2 && (
              <figure className={s.map} aria-label={`${L.nextStops}: ${stops.map((x) => `${x.place} ${x.when}`.trim()).join(', ')}`}>
                <svg viewBox="0 0 1000 600" className={s.mapSvg} aria-hidden="true">
                  <path d={path} className={s.route} pathLength={1} />
                  {pts.map((p, i) => (
                    <g key={i} className={s.pin} style={{ '--i': i } as React.CSSProperties} transform={`translate(${p.x} ${p.y})`}>
                      <circle r={i === 0 ? 16 : 11} className={i === 0 ? s.pinNow : s.pinDot} />
                      <text y={-30} textAnchor="middle" className={s.pinLabel}>
                        {stops[i].place}
                      </text>
                      {stops[i].when && (
                        <text y={50} textAnchor="middle" className={s.pinWhen}>
                          {stops[i].when}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </figure>
            )}
          </div>
        </header>

        {/* ---- 2. portfolio: postcards from the road ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="route-grid" s={s} />
            <div id="route-grid" className={s.grid}>
              {card.grid.map((p) => (
                <figure key={p.id} className={s.work} data-cat={p.category ?? ''}>
                  <div className={s.workImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 30vw" />
                  </div>
                  {p.caption && (
                    <figcaption className={s.stamp}>
                      <span aria-hidden="true">⌖</span> {p.caption}
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
                <Reveal key={pack.name} delay={i * 0.06} y={14} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    {pack.featured && <p className={s.packBadge}>{L.popular}</p>}
                    <h3 className={s.packName}>{pack.name}</h3>
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
                  <figcaption className={s.reviewWho}>{r.names}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 6. booking & contacts (+ where I will be) ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          <div className={s.contact}>
            <div>
              <span className={s.label}>{labels.contacts}</span>
              <h2 className={s.sectionTitle}>{leadForm ? leadForm.labels.title : labels.contacts}</h2>
              <ContactLinks card={card} s={s} />
              {stops.length > 0 && (
                <div className={s.tickets}>
                  <p className={s.ticketsTitle}>{L.nextStops}</p>
                  <ol className={s.ticketList}>
                    {stops.map((stop, i) => (
                      <li key={`${stop.place}-${i}`} className={`${s.ticket} ${i === 0 ? s.ticketNow : ''}`}>
                        <span className={s.ticketPlace}>{stop.place}</span>
                        {stop.when && <span className={s.ticketWhen}>{stop.when}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
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
