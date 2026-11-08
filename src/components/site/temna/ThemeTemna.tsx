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
import { LAB_FONT_URL } from './fonts'
import s from './Lab.module.css'

const SWAY = [-2.4, 1.6, -1, 2.1, -1.7, 1.2, -2, 0.8, 1.8, -1.3, 2.3, -0.7]

/**
 * «Темна кімната» — the darkroom: near-black with a red safelight glow, print
 * white, an old book face. Prints hang on lines with wooden clothespins and
 * develop from a white sheet as they come into view; the first-screen print
 * develops on the first paint.
 *
 * Effects: the first-screen print develops from white (CSS); the safelight
 * glow breathes (CSS); prints develop from white on scroll (scroll-driven)
 * and sway on their pegs on hover; a lab timer reads the page progress
 * (scroll-driven, no JS).
 */
export function ThemeTemna({
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
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 10 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={LAB_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={s.root}>
        <div className={s.safelight} aria-hidden="true" />
        <span className={s.timer} aria-hidden="true" />
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

        {/* ---- 1. first screen: a print developing ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroRole}>
              <span data-card="role">{card.role}</span>
              {card.city && (
                <>
                  {' · '}
                  <span data-card="city">{card.city}</span>
                </>
              )}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
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
          {lead && (
            <div className={s.heroPrint} style={{ '--r': ratioOf(lead, '4 / 5') } as React.CSSProperties}>
              <span className={s.peg} aria-hidden="true" />
              <div className={s.heroImg}>
                <Picture
                  src={lead.previewUrl}
                  srcSet={lead.srcSet}
                  avifSrcSet={lead.avifSrcSet}
                  sizes="(max-width: 760px) 140px, 30vw"
                  alt={lead.caption || lead.category || title}
                  priority
                />
              </div>
            </div>
          )}
        </header>

        {/* ---- 2. portfolio: prints on the line ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="lab-line" s={s} />
            <ul id="lab-line" className={s.line}>
              {card.grid.map((p, i) => (
                <li key={p.id} className={s.hang} data-cat={p.category ?? ''} style={{ '--sway': `${SWAY[i % SWAY.length]}deg` } as React.CSSProperties}>
                  <span className={s.peg} aria-hidden="true" />
                  <figure className={s.print} style={{ '--r': ratioOf(p) } as React.CSSProperties}>
                    <div className={s.printImg}>
                      <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 46vw, 24vw" />
                    </div>
                    {p.caption && <figcaption className={s.printCap}>{p.caption}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
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
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 24vw" />
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
                  <blockquote className={s.reviewText}>«{r.text}»</blockquote>
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
