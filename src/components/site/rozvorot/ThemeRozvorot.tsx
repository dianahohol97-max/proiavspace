import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from '../SiteRenderer'
import { MotionRoot, Reveal } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import { ContactLinks, FilterBar, GiftsBlock, TermsBlock } from '../card/blocks'
import { buildCard, mergeSkin, ratioOf, type Photo } from '../card/data'
import { CardLeadForm, CardNav } from '../card/islands'
import chrome from '../card/Chrome.module.css'
import { PackCta } from '../tysha/PackCta'
import { SPREAD_FONT_URL } from './fonts'
import s from './Spread.module.css'

const isLandscape = (p: Photo) => !!p.width && !!p.height && p.width > p.height

/**
 * «Розворот» — quiet luxury: stone paper, warm black, bronze, an editorial
 * serif. The first screen is one large photograph with the directions laid
 * over it as lines; hovering a line brings up that direction's photograph
 * (CSS :has, no JS). The portfolio reads as magazine spreads — a vertical and
 * a horizontal frame across a fold — with one spread given to a handwritten
 * quote (the «фірмовий кадр» phrase).
 *
 * Effects: direction lines swap the hero background on hover (CSS); the
 * hero settles in a slow zoom (CSS); spreads open from the fold as they
 * scroll in (scroll-driven); the quote underlines itself (scroll-driven).
 */
export function ThemeRozvorot({
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

  // One background per direction: its first landscape frame (the first-screen
  // frame stands for the first direction).
  const layers = card.directions.slice(0, 4).map((d, i) => {
    const own = card.photos.filter((p) => p.category?.trim() === d)
    const photo = i === 0 && lead ? lead : (own.find(isLandscape) ?? own[0] ?? lead)
    return { d, photo }
  })

  // Spreads: frames in pairs across a fold; the quote takes the second spread.
  const spreads: Photo[][] = []
  for (let i = 0; i < card.grid.length; i += 2) spreads.push(card.grid.slice(i, i + 2))
  const quote = content.moment.text.trim()
  const quotePhoto = card.byId(content.moment.imageId)

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={SPREAD_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: the photograph and the direction lines ---- */}
        <header id="top" className={s.hero}>
          <div className={s.layers}>
            {layers.map(({ d, photo }, i) =>
              photo ? (
                <div key={d} className={s.layer} data-k={i}>
                  <Picture
                    src={photo.previewUrl}
                    srcSet={photo.srcSet}
                    avifSrcSet={photo.avifSrcSet}
                    sizes="(max-width: 760px) 360px, 100vw"
                    alt={i === 0 ? photo.caption || title : ''}
                    priority={i === 0}
                    low={i > 0}
                  />
                </div>
              ) : null
            )}
          </div>
          <div className={s.shade} aria-hidden="true" />
          <div className={`${s.wrap} ${s.heroInner}`}>
            <p className={s.heroRole}>
              <span data-card="role">{card.role}</span>
              {card.city && (
                <>
                  <span aria-hidden="true"> — </span>
                  <span data-card="city">{card.city}</span>
                </>
              )}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
            {layers.length > 0 && (
              <ul className={s.lines} data-card="directions">
                {layers.map(({ d }, i) => (
                  <li key={d}>
                    <a href="#portfolio" className={s.line} data-k={i}>
                      <span className={s.lineNo}>{String(i + 1).padStart(2, '0')}</span>
                      {d}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a href={bookHref} className={s.btnLight} data-card="book">
              {book}
            </a>
          </div>
        </header>

        {/* ---- 2. portfolio: spreads ---- */}
        {spreads.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="spread-book" s={s} />
            <div id="spread-book" className={s.book}>
              {spreads.map((pair, si) => (
                <div key={si} className={s.spreadWrap}>
                  <div className={`${s.spread} ${si % 2 ? s.spreadFlip : ''}`}>
                    {pair.map((p) => (
                      <figure key={p.id} className={s.page} data-cat={p.category ?? ''} style={{ '--r': ratioOf(p) } as React.CSSProperties}>
                        <div className={s.pageImg}>
                          <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 40vw" />
                        </div>
                        {(p.caption || p.category) && (
                          <figcaption className={s.pageCap}>
                            {p.category && <span>{p.category}</span>}
                            {p.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                  {si === 0 && quote && (
                    <blockquote className={s.quote}>
                      {quotePhoto && (
                        <span className={s.quoteImg}>
                          <Picture src={quotePhoto.previewUrl} srcSet={quotePhoto.srcSet} alt="" sizes="200px" />
                        </span>
                      )}
                      <span className={s.quoteText}>{quote}</span>
                      <span className={s.quoteBy}>— {brand}</span>
                    </blockquote>
                  )}
                </div>
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
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 26vw" />
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
