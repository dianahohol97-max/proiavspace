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
import { LETTER_FONT_URL } from './fonts'
import s from './Letter.module.css'

const TILTS = [-2.2, 1.6, -1.1, 2.4, -1.8, 1.2, -0.8, 1.9, -1.4, 0.9, -2, 1.5]

/**
 * «Лист» — love stories, weddings, anniversaries, told like a letter:
 * letter paper, brown-black ink, blue fountain-pen ink, a handwriting for
 * the name and the postcards. No pinks, no hearts.
 *
 * Effects: the first screen is an envelope whose flap opens and three
 * photos slide out of it (CSS, from the first paint); portfolio frames are
 * prints with white borders lying at a slight angle that straighten on hover;
 * the signature under «Про мене» writes itself (scroll-driven); reviews are
 * handwritten postcards with a stamp and a postmark.
 */
export function ThemeLyst({
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

  // Three photos come out of the envelope: the first-screen frame and the
  // first two of the best frames; the grid shows the rest when there is enough.
  const extras = card.grid.length >= 8 ? card.grid.slice(0, 2) : []
  const letters = lead ? [lead, ...extras] : []
  const taken = new Set(extras.map((p) => p.id))
  const grid = card.grid.filter((p) => !taken.has(p.id))
  const year = new Date().getFullYear()

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={LETTER_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: the envelope ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroTo}>
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
              <p className={s.heroDirections} data-card="directions">
                {card.directions.join(' · ')}
              </p>
            )}
            {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
            <a href={bookHref} className={s.btn} data-card="book">
              {book}
            </a>
          </div>
          {letters.length > 0 && (
            <div className={s.envelope} data-count={letters.length}>
              <div className={s.back} aria-hidden="true" />
              {letters.map((p, i) => (
                <div
                  key={p.id}
                  className={s.letter}
                  data-i={i}
                  style={{ '--r': ratioOf(p, '4 / 5') } as React.CSSProperties}
                >
                  <Picture
                    src={p.previewUrl}
                    srcSet={p.srcSet}
                    avifSrcSet={p.avifSrcSet}
                    sizes="(max-width: 760px) 150px, 18vw"
                    alt={p.caption || p.category || title}
                    priority={i === 0}
                    low={i > 0}
                  />
                </div>
              ))}
              <div className={s.front} aria-hidden="true">
                <span className={s.address}>
                  {brand}
                  {card.city && <small>{card.city}</small>}
                </span>
              </div>
              <div className={s.flap} aria-hidden="true" />
            </div>
          )}
        </header>

        {/* ---- 2. portfolio: prints on the table ---- */}
        {grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="letter-prints" s={s} />
            <div id="letter-prints" className={s.prints}>
              {grid.map((p, i) => (
                <figure
                  key={p.id}
                  className={s.print}
                  data-cat={p.category ?? ''}
                  style={{ '--tilt': `${TILTS[i % TILTS.length]}deg`, '--r': ratioOf(p) } as React.CSSProperties}
                >
                  <div className={s.printImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 30vw" />
                  </div>
                  {p.caption && <figcaption className={s.printCap}>{p.caption}</figcaption>}
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
                <Reveal key={pack.name} delay={i * 0.08} y={20} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
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
        <GiftsBlock card={card} s={{ ...s, gifts: `${s.section} ${s.wrap}` }} heading={head(L.giftsTitle, L.giftsTitle)} />

        {/* ---- 4. about: a letter with a signature that writes itself ---- */}
        {content.about.text && (
          <section id="about" className={`${s.section} ${s.wrap}`}>
            <div className={`${s.sheet} ${portrait ? '' : s.sheetSolo}`}>
              {portrait && (
                <div className={s.sheetPhoto}>
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
                </div>
              )}
              <div>
                <span className={s.label}>{labels.about}</span>
                <p className={s.sheetText}>{content.about.text}</p>
                {brand && (
                  <p className={s.signature}>
                    <span>{brand}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---- 5. reviews: postcards ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${s.section} ${s.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={s.cards}>
              {reviews.map((r, i) => (
                <figure key={i} className={s.postcard} style={{ '--tilt': `${[-1.6, 1.2, -0.8][i % 3]}deg` } as React.CSSProperties}>
                  <blockquote className={s.postText}>{r.text}</blockquote>
                  <div className={s.postSide}>
                    <span className={s.stamp} aria-hidden="true">
                      {r.photo ? <Picture src={r.photo.previewUrl} srcSet={r.photo.srcSet} alt="" sizes="64px" /> : <span>{year}</span>}
                    </span>
                    <span className={s.postmark} aria-hidden="true">
                      {card.city || brand}
                    </span>
                    <figcaption className={s.postFrom}>{r.names}</figcaption>
                  </div>
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
