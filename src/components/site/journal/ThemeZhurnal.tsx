import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import {
  type BookingNav,
  type LangSwitch,
  type PortfolioItem,
  type SiteLabels,
} from '../SiteRenderer'
import { MagneticButton, MotionRoot, Reveal, RevealText } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import type { NavLink } from '../tysha/TyshaNav'
import { ContactLinks, FilterBar, GiftsBlock, TermsBlock } from '../card/blocks'
import { buildCard, type Photo } from '../card/data'
import { JOURNAL_FONT_URL } from './fonts'
import { JournalLeadForm, JournalNav, JournalPackCta } from './islands'
import { layoutJournal, ratio } from './layout'
import j from './Journal.module.css'

const GRID_MAX = 12
const pad2 = (n: number) => String(n).padStart(2, '0')

/** «№ 11 · Осінь 2026» — the issue line, from the server's clock. */
function issueLine(seasons: string | undefined): string {
  const now = new Date()
  const names = (seasons ?? 'Зима,Весна,Літо,Осінь').split(',')
  // Dec–Feb → 0 (winter), Mar–May → 1, Jun–Aug → 2, Sep–Nov → 3.
  const season = names[Math.floor(((now.getMonth() + 1) % 12) / 3)] ?? ''
  return `№ ${pad2(now.getMonth() + 1)} · ${season} ${now.getFullYear()}`
}

/**
 * «Журнал» — a fashion / beauty / editorial site laid out as a glossy
 * magazine: the first screen is the ISSUE COVER (masthead fitted to the
 * cover's width, cover lines, issue number) beside its table of contents;
 * the portfolio reads as magazine pages with folios; the signature moment is
 * THE SPREAD — a double page whose right leaf turns over the spine as you
 * scroll (CSS scroll-driven 3D, pinned for less than one screen); then the
 * editor's letter with a drop cap, rubrics (series), how we shoot, pull
 * quotes, a price list with dot leaders and the order form.
 *
 * Server component; the cover and the spread need no JS at all.
 */
export function ThemeZhurnal({
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
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: GRID_MAX })
  const { brand, lead: cover, portrait, bookHref, reviews, packs } = card
  const masthead = brand || content.hero.title
  const gridItems = card.grid
  const rows = layoutJournal(gridItems)

  const L = {
    ...card.L,
    book: labels.bookShoot ?? labels.book,
    selected: labels.selectedWork ?? labels.portfolio,
    choose: card.L.choosePack,
    contents: labels.inThisIssue ?? 'У номері',
    letter: labels.editorLetter ?? labels.about,
    p: labels.pageShort ?? 'стор.',
  }
  const issue = issueLine(labels.seasons)

  // Table of contents with folios that grow like a real issue's.
  let folio = 2
  const toc: { href: string; label: string; page: number }[] = []
  const tocAdd = (on: boolean, href: string, label: string, pages: number) => {
    if (!on) return
    toc.push({ href, label, page: folio })
    folio += pages
  }
  tocAdd(gridItems.length > 0, '#portfolio', L.selected, rows.length * 2)
  tocAdd(packs.length > 0, '#pricing', labels.pricing, 2)
  tocAdd(card.gifts.length > 0, '#gifts', L.giftsTitle, 2)
  tocAdd(!!content.about.text, '#about', L.letter, 2)
  tocAdd(reviews.length > 0, '#reviews', L.testimonials, 1)
  tocAdd(true, '#contact', labels.contacts, 1)
  const pageOf = (href: string) => toc.find((t) => t.href === href)?.page
  const navLinks: NavLink[] = card.navLinks
  const contactLinks: NavLink[] = card.contactLinks

  const head = (href: string, label: string, heading: string, extra?: React.ReactNode) => (
    <div className={j.sectionHead}>
      <div>
        <span className={j.kicker}>
          {label}
          {pageOf(href) !== undefined && (
            <span className={j.folioInline}>
              {' '}
              · {L.p} {pad2(pageOf(href)!)}
            </span>
          )}
        </span>
        <RevealText as="h2" text={heading} className={j.sectionTitle} />
      </div>
      {extra}
    </div>
  )

  // The masthead is fitted to the cover's width (container query units):
  // its size follows the number of letters.
  const mastLen = Math.max(Array.from(masthead).length, 4)
  let letter = 0

  const frame = (p: Photo, sizes: string, className = '') => (
    <div className={`${j.frame} ${className}`} style={{ '--r': ratio(p) } as React.CSSProperties}>
      <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || brand} sizes={sizes} objectPosition="50% 35%" />
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={JOURNAL_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={j.root}>
        <JournalNav
          skin={j}
          brand={brand}
          logoUrl={logoUrl}
          links={navLinks}
          cta={{ href: bookHref, label: L.book }}
          langSwitch={langSwitch}
          overHero={false}
          menuLabel={L.menu}
          closeLabel={labels.close}
          footLinks={contactLinks}
        />

        {/* ---- the cover + contents ---- */}
        <header id="top" className={`${j.wrap} ${j.hero}`}>
          <div className={j.cover} style={{ '--len': mastLen } as React.CSSProperties}>
            {cover && (
              <div className={j.coverImg}>
                <Picture
                  src={cover.previewUrl}
                  srcSet={cover.srcSet}
                  avifSrcSet={cover.avifSrcSet}
                  sizes="(max-width: 860px) 360px, 46vw"
                  alt={cover.caption || cover.category || masthead}
                  priority
                  objectPosition="50% 30%"
                />
              </div>
            )}
            <div className={j.coverShade} aria-hidden="true" />
            <h1 className={j.masthead} aria-label={masthead} data-card="name">
              <span aria-hidden="true">
                {Array.from(masthead).map((ch, i) => (
                  <span key={i} className={j.mastCh} style={{ '--i': letter++ } as React.CSSProperties}>
                    {ch === ' ' ? ' ' : ch}
                  </span>
                ))}
              </span>
            </h1>
            <p className={j.issue}>
              <span data-card="role">{card.role}</span>
              {card.city && (
                <>
                  {' · '}
                  <span data-card="city">{card.city}</span>
                </>
              )}
              <span className={j.issueNo}>{issue}</span>
            </p>
            <div className={j.coverLines}>
              {card.directions.length > 0 && (
                <p className={j.coverDirections} data-card="directions">
                  {card.directions.slice(0, 4).map((r) => (
                    <span key={r} className={j.coverLine}>
                      {r}
                    </span>
                  ))}
                </p>
              )}
              {content.hero.subtitle && <p className={j.coverHeadline}>{content.hero.subtitle}</p>}
              <a href={bookHref} className={j.coverCta} data-card="book">
                {L.book} <span className={j.arrow}>→</span>
              </a>
            </div>
          </div>

          <aside className={j.contents} aria-label={L.contents}>
            <span className={j.kicker}>{L.contents}</span>
            <ol className={j.tocList}>
              {toc.map((t, i) => (
                <li key={t.href}>
                  <a href={t.href} className={j.tocLink}>
                    <span className={j.tocNo}>{pad2(i + 1)}</span>
                    <span className={j.tocLabel}>{t.label}</span>
                    <span className={j.tocDots} aria-hidden="true" />
                    <span className={j.tocPage}>
                      {L.p} {pad2(t.page)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            {content.hero.title && content.hero.title !== masthead && <p className={j.contentsLead}>{content.hero.title}</p>}
            <span className={j.contentsCta} data-card="book">
              <MagneticButton href={bookHref} className={j.ctaInk}>
                {L.book} <span className={j.arrow}>→</span>
              </MagneticButton>
            </span>
          </aside>
        </header>

        {/* ---- portfolio: magazine pages ---- */}
        {rows.length > 0 && (
          <section id="portfolio" className={`${j.section} ${j.wrap}`}>
            {head('#portfolio', labels.portfolio, L.selected, <span className={j.kicker}>{pad2(gridItems.length)}</span>)}
            <FilterBar card={card} gridId="journal-pages" s={j} />
            <div className={j.pages} id="journal-pages">
              {rows.map((row, ri) => {
                const pageNo = (pageOf('#portfolio') ?? 2) + ri * 2
                const folioEl = (
                  <span className={j.folio} aria-hidden="true">
                    — {pad2(pageNo)} —
                  </span>
                )
                if (row.kind === 'feature') {
                  const p = row.items[0] as Photo
                  return (
                    <Reveal key={ri} className={`${j.row} ${j.feature} ${row.flip ? j.flip : ''}`} y={24} cat={p.category ?? ''}>
                      {frame(p, '(max-width: 760px) 360px, 52vw', j.wipe)}
                      <div className={j.featureText}>
                        <span className={j.kicker}>{p.category ?? labels.portfolio}</span>
                        {p.caption && <p className={j.featureTitle}>{p.caption}</p>}
                        {brand && <span className={j.credit}>© {brand}</span>}
                        {folioEl}
                      </div>
                    </Reveal>
                  )
                }
                const items = row.items as Photo[]
                return (
                  <Reveal key={ri} className={`${j.row} ${row.kind === 'pair' ? j.pair : j.triptych}`} y={24}>
                    {items.map((p) => (
                      <figure key={p.id} className={j.cell} data-cat={p.category ?? ''}>
                        {frame(p, row.kind === 'pair' ? '(max-width: 760px) 50vw, 40vw' : '(max-width: 760px) 50vw, 30vw', j.wipe)}
                        <figcaption className={j.cellCap}>
                          {p.caption && <span>{p.caption}</span>}
                        </figcaption>
                      </figure>
                    ))}
                    {folioEl}
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- price list ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${j.section} ${j.wrap}`}>
            {head('#pricing', labels.pricing, labels.pricing)}
            <ul className={j.prices}>
              {packs.map((pack) => (
                <Reveal as="li" key={pack.name} className={`${j.price} ${pack.featured ? j.priceFeatured : ''}`} pack={pack.name}>
                  <div className={j.priceLine}>
                    <h3 className={j.priceName}>
                      {pack.name}
                      {pack.featured && <span className={j.priceTag}>{L.popular}</span>}
                    </h3>
                    <span className={j.tocDots} aria-hidden="true" />
                    {pack.price && <span className={j.priceValue}>{pack.price}</span>}
                  </div>
                  <div className={j.priceMore}>
                    {pack.includes.length > 0 && <p className={j.priceIncludes}>{pack.includes.join(' · ')}</p>}
                    <JournalPackCta pack={pack.name} href={bookHref} className={j.textLink}>
                      {L.choose} <span className={j.arrow}>→</span>
                    </JournalPackCta>
                  </div>
                </Reveal>
              ))}
            </ul>
            <TermsBlock card={card} s={j} />
          </section>
        )}

        {/* ---- gifts & prints (optional) ---- */}
        <GiftsBlock
          card={card}
          s={{ ...j, gifts: `${j.section} ${j.wrap} ${j.gifts}` }}
          heading={head('#gifts', L.giftsTitle, L.giftsTitle)}
        />

        {/* ---- editor's letter ---- */}
        {content.about.text && (
          <section id="about" className={`${j.section} ${j.wrap}`}>
            {head('#about', labels.about, L.letter)}
            <div className={j.letter}>
              {portrait && <div className={j.letterPortrait}>{frame(portrait, '(max-width: 860px) 50vw, 24vw')}</div>}
              <div className={j.letterBody}>
                <p className={j.letterText}>{content.about.text}</p>
                {brand && <p className={j.letterSign}>{brand}</p>}
              </div>
            </div>
          </section>
        )}

        {/* ---- pull quotes ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${j.section} ${j.wrap}`}>
            {head('#reviews', L.testimonials, L.testimonials)}
            <div className={j.quotes}>
              {reviews.map((review, i) => {
                const photo = review.photo
                return (
                  <Reveal key={i} as="figure" className={j.quote}>
                    <blockquote className={j.quoteText}>
                      <span className={j.quoteMark} aria-hidden="true">
                        «
                      </span>
                      {review.text}
                      <span className={j.quoteMark} aria-hidden="true">
                        »
                      </span>
                    </blockquote>
                    {(review.names || photo) && (
                      <figcaption className={j.quoteWho}>
                        {photo && (
                          <span className={j.quotePhoto}>
                            <Picture src={photo.previewUrl} srcSet={photo.srcSet} alt="" sizes="44px" />
                          </span>
                        )}
                        {review.names && <span className={j.kicker}>{review.names}</span>}
                      </figcaption>
                    )}
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- order form ---- */}
        <section id="contact" className={`${j.section} ${j.wrap}`}>
          <div className={j.contact}>
            <div className={j.contactSide}>
              <span className={j.kicker}>{labels.contacts}</span>
              <RevealText as="h2" text={leadForm ? leadForm.labels.title : labels.contacts} className={j.contactTitle} />
              <ContactLinks card={card} s={j} />
              {content.contact.bookingUrl && (
                <a href={content.contact.bookingUrl} className={`${j.ctaInk} ${j.contactBook}`}>
                  {labels.book} <span className={j.arrow}>→</span>
                </a>
              )}
            </div>
            {leadForm && (
              <div className={j.contactForm}>
                <JournalLeadForm
                  skin={j}
                  handle={leadForm.handle}
                  labels={leadForm.labels}
                  shootTypes={card.topics}
                  certificateTopic={card.certificateTopic}
                />
              </div>
            )}
          </div>
        </section>

        {/* ---- back cover ---- */}
        <footer className={`${j.footer} ${j.wrap}`} style={{ '--len': mastLen } as React.CSSProperties}>
          <a href="#top" className={j.footMast}>
            {masthead}
          </a>
          <div className={j.footRow}>
            <span className={j.kicker}>{issue}</span>
            <div className={j.footLinks}>
              {contactLinks.map((link) => (
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
          </div>
        </footer>
      </div>
    </MotionRoot>
  )
}
