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
import { MAT_FONT_URL } from './fonts'
import { ViewerControls } from './islands'
import s from './Mat.module.css'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * «Паспарту» — one frame at a time, the way a gallery hangs prints: each
 * photograph sits in a white mat on a wall tinted by the photograph itself (a
 * heavily blurred copy of the frame behind it — works for any upload, no
 * colour data needed), with a museum label: series, title, «07 / 11».
 *
 * Effects: the wall picks up each frame's colour; the viewer is a native
 * scroll-snap row (swipe, trackpad, keys) with ‹ › and drag from the shared
 * strip controls; labels fade in as their frame centres (scroll-driven,
 * inline axis); the first-screen mat lifts off the wall (CSS).
 */
export function ThemePaspartu({
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
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 12 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate
  const total = card.grid.length

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={MAT_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: one print on a wall of its own colour ---- */}
        <header id="top" className={s.hero}>
          {lead && (
            <div className={s.wall} aria-hidden="true">
              <img src={(lead.srcSet?.split(' ')[0]) || lead.previewUrl} alt="" decoding="async" />
            </div>
          )}
          <div className={`${s.wrap} ${s.heroInner}`}>
            {lead && (
              <div className={s.heroMat} style={{ '--r': ratioOf(lead, '4 / 5') } as React.CSSProperties}>
                <div className={s.heroImg}>
                  <Picture
                    src={lead.previewUrl}
                    srcSet={lead.srcSet}
                    avifSrcSet={lead.avifSrcSet}
                    sizes="(max-width: 760px) 150px, 28vw"
                    alt={lead.caption || lead.category || title}
                    priority
                  />
                </div>
              </div>
            )}
            <div className={s.heroLabel}>
              <h1 className={s.heroTitle} data-card="name">
                {title}
              </h1>
              <p className={s.heroRole}>
                <span data-card="role">{card.role}</span>
                {card.city && (
                  <>
                    {', '}
                    <span data-card="city">{card.city}</span>
                  </>
                )}
              </p>
              {card.directions.length > 0 && (
                <p className={s.heroDirs} data-card="directions">
                  {card.directions.join(' · ')}
                </p>
              )}
              {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
              <a href={bookHref} className={s.btn} data-card="book">
                {book}
              </a>
            </div>
          </div>
        </header>

        {/* ---- 2. portfolio: the viewer ---- */}
        {total > 0 && (
          <section id="portfolio" className={s.section}>
            <div className={s.wrap}>
              {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
              <div className={s.viewerBar}>
                <FilterBar card={card} gridId="mat-viewer" s={s} />
                <ViewerControls
                  scrollerId="mat-viewer"
                  prevLabel={labels.prev ?? '‹'}
                  nextLabel={labels.next ?? '›'}
                  className={s.controls}
                  buttonClassName={s.control}
                />
              </div>
            </div>
            <ol id="mat-viewer" className={s.viewer} tabIndex={0} aria-label={labels.portfolio}>
              {card.grid.map((p, i) => (
                <li key={p.id} className={s.slide} data-cat={p.category ?? ''} data-frame="">
                  <span className={s.slideWall} aria-hidden="true">
                    <img src={(p.srcSet?.split(' ')[0]) || p.previewUrl} alt="" loading="lazy" decoding="async" />
                  </span>
                  <div className={s.mat} style={{ '--r': ratioOf(p) } as React.CSSProperties}>
                    <div className={s.matImg}>
                      <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 80vw, 46vw" />
                    </div>
                  </div>
                  <p className={s.museum}>
                    {p.category && <span className={s.series}>{p.category}</span>}
                    {p.caption && <span className={s.work}>{p.caption}</span>}
                    <span className={s.count}>
                      {pad2(i + 1)} / {pad2(total)}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---- 3. packages + terms ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${s.section} ${s.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={s.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.08} y={16} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    <h3 className={s.packName}>{pack.name}</h3>
                    {pack.price && <p className={s.packPrice}>{pack.price}</p>}
                    {pack.featured && <p className={s.packBadge}>{L.popular}</p>}
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
                <div className={s.aboutMat}>
                  <div className={s.matImg}>
                    <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
                  </div>
                </div>
              )}
              <div>
                <span className={s.label}>{labels.about}</span>
                <p className={s.aboutText}>{content.about.text}</p>
                {brand && <p className={s.sign}>{brand}</p>}
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

        {/* ---- 6. booking & contacts ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          <div className={s.contact}>
            <div>
              <span className={s.label}>{labels.contacts}</span>
              <h2 className={s.sectionTitle}>{leadForm ? leadForm.labels.title : labels.contacts}</h2>
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
