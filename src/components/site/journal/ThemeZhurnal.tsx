import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import {
  groupPortfolio,
  type BookingNav,
  type LangSwitch,
  type PortfolioItem,
  type SiteLabels,
} from '../SiteRenderer'
import { MagneticButton, MotionRoot, Reveal, RevealText } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import type { NavLink } from '../tysha/TyshaNav'
import { JOURNAL_FONT_URL } from './fonts'
import { JournalAlbums, JournalAllPortfolio, JournalLeadForm, JournalNav, JournalPackCta } from './islands'
import { layoutJournal, ratio } from './layout'
import j from './Journal.module.css'

const GRID_MAX = 9
const pad2 = (n: number) => String(n).padStart(2, '0')
type Photo = PortfolioItem & { previewUrl: string }
const lean = (p: Photo): PortfolioItem => ({ id: p.id, previewUrl: p.previewUrl, caption: p.caption ?? null, category: p.category ?? null })

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
  const brand = displayName || content.hero.title || ''
  const masthead = brand || content.hero.title
  const photos = portfolio.filter((p): p is Photo => !!p.previewUrl)
  const byId = (id: string) => (id ? photos.find((p) => p.id === id) : undefined)
  const shown = new Set<string>()

  const cover = byId(content.hero.imageId) ?? photos[0]
  if (cover) shown.add(cover.id)
  const portrait = byId(content.about.imageId)
  if (portrait) shown.add(portrait.id)

  // The spread takes four frames the page doesn't use elsewhere when the
  // portfolio is big enough; otherwise it is left out.
  const rest = photos.filter((p) => !shown.has(p.id))
  const spread = rest.length >= 7 ? rest.slice(0, 4) : []
  spread.forEach((p) => shown.add(p.id))
  const pool = photos.length >= 6 ? photos.filter((p) => !shown.has(p.id)) : photos
  const gridItems = pool.slice(0, GRID_MAX)
  gridItems.forEach((p) => shown.add(p.id))
  const rows = layoutJournal(gridItems)

  const groups = groupPortfolio(photos)
  const hasSeries = groups.some((g) => g.category !== null)
  const covers: Record<string, { src: string; srcSet?: string }> = {}
  for (const g of groups) {
    const chosen = g.items.find((it) => it.id === content.albumCovers[g.category ?? ''])
    const fresh = chosen && !shown.has(chosen.id) ? chosen : g.items.find((it) => !shown.has(it.id))
    const c = (fresh ?? chosen ?? g.items[0]) as Photo | undefined
    if (c) covers[g.category ?? ''] = { src: c.previewUrl, srcSet: c.srcSet }
  }
  const leanGroups = groups.map((g) => ({ category: g.category, items: (g.items as Photo[]).map(lean) }))
  const rubrics = groups.filter((g) => g.category).map((g) => g.category!)

  const steps = content.process.steps
  const reviews = content.testimonials.items
  const packs = content.pricing.items
  const contact = content.contact
  const instagram = contact.instagram.replace(/^@/, '')

  const L = {
    book: labels.bookShoot ?? labels.book,
    menu: labels.menu ?? 'Меню',
    process: labels.process ?? 'Як ми працюємо',
    selected: labels.selectedWork ?? labels.portfolio,
    series: labels.series ?? labels.portfolio,
    testimonials: labels.testimonials ?? 'Відгуки',
    popular: labels.popular ?? 'Найчастіше обирають',
    choose: labels.choosePack ?? labels.book,
    madeOn: labels.madeOn ?? 'Сайт на проЯв',
    all: labels.allPortfolio ?? labels.portfolio,
    contents: labels.inThisIssue ?? 'У номері',
    letter: labels.editorLetter ?? labels.about,
    spread: labels.spread ?? 'Розворот',
    p: labels.pageShort ?? 'стор.',
  }
  const issue = issueLine(labels.seasons)
  const bookHref = leadForm ? '#contact' : contact.bookingUrl || bookingNav?.href || '#contact'

  // Table of contents with folios that grow like a real issue's.
  let folio = 2
  const toc: { href: string; label: string; page: number }[] = []
  const tocAdd = (on: boolean, href: string, label: string, pages: number) => {
    if (!on) return
    toc.push({ href, label, page: folio })
    folio += pages
  }
  tocAdd(gridItems.length > 0, '#portfolio', L.selected, rows.length * 2)
  tocAdd(spread.length === 4, '#spread', L.spread, 2)
  tocAdd(!!content.about.text, '#about', L.letter, 2)
  tocAdd(hasSeries, '#series', L.series, 2)
  tocAdd(steps.length > 0, '#process', L.process, 2)
  tocAdd(packs.length > 0, '#pricing', labels.pricing, 2)
  tocAdd(true, '#contact', labels.contacts, 1)
  const pageOf = (href: string) => toc.find((t) => t.href === href)?.page

  const navLinks: NavLink[] = [
    ...(photos.length > 0 ? [{ href: '#portfolio', label: labels.portfolio }] : []),
    ...(content.about.text ? [{ href: '#about', label: labels.about }] : []),
    ...(packs.length > 0 ? [{ href: '#pricing', label: labels.pricing }] : []),
    { href: '#contact', label: labels.contacts },
    ...(bookingNav ? [bookingNav] : []),
  ]
  const contactLinks: NavLink[] = [
    ...(contact.phone ? [{ href: `tel:${contact.phone.replace(/[^\d+]/g, '')}`, label: contact.phone }] : []),
    ...(contact.email ? [{ href: `mailto:${contact.email}`, label: contact.email }] : []),
    ...(instagram ? [{ href: `https://instagram.com/${instagram}`, label: `@${instagram}` }] : []),
  ]

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
            <h1 className={j.masthead} aria-label={masthead}>
              <span aria-hidden="true">
                {Array.from(masthead).map((ch, i) => (
                  <span key={i} className={j.mastCh} style={{ '--i': letter++ } as React.CSSProperties}>
                    {ch === ' ' ? ' ' : ch}
                  </span>
                ))}
              </span>
            </h1>
            <p className={j.issue}>{issue}</p>
            <div className={j.coverLines}>
              {rubrics.slice(0, 3).map((r) => (
                <span key={r} className={j.coverLine}>
                  {r}
                </span>
              ))}
              {content.hero.subtitle && <p className={j.coverHeadline}>{content.hero.subtitle}</p>}
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
            <MagneticButton href={bookHref} className={j.ctaInk}>
              {L.book} <span className={j.arrow}>→</span>
            </MagneticButton>
          </aside>
        </header>

        {/* ---- portfolio: magazine pages ---- */}
        {rows.length > 0 && (
          <section id="portfolio" className={`${j.section} ${j.wrap}`}>
            {head('#portfolio', labels.portfolio, L.selected, <span className={j.kicker}>{pad2(photos.length)}</span>)}
            <div className={j.pages}>
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
                    <Reveal key={ri} className={`${j.row} ${j.feature} ${row.flip ? j.flip : ''}`} y={24}>
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
                      <figure key={p.id} className={j.cell}>
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
            {photos.length > gridItems.length + spread.length + 1 && (
              <div className={j.allRow}>
                <JournalAllPortfolio
                  skin={j}
                  items={photos.map(lean)}
                  label={L.all}
                  labels={{ portfolio: L.all, photos: labels.photos, close: labels.close }}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- signature: the spread turns over ---- */}
        {spread.length === 4 && (() => {
          const [aL, aR, bL, bR] = spread
          const pg = pageOf('#spread') ?? 12
          const page = (p: Photo, n: number, extra = '') => (
            <div className={`${j.page} ${extra}`}>
              <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || brand} sizes="(max-width: 760px) 46vw, 34vw" objectPosition="50% 30%" />
              <span className={j.pageFolio} aria-hidden="true">
                {pad2(n)}
              </span>
            </div>
          )
          return (
            <section id="spread" className={j.spread} aria-label={L.spread}>
              <div className={`${j.wrap} ${j.spreadHead}`}>
                <span className={j.kicker}>
                  {L.spread} · {L.p} {pad2(pg)}–{pad2(pg + 3)}
                </span>
                <RevealText as="h2" text={content.moment.text || L.spread} className={j.spreadTitle} />
              </div>
              {/* Fallback: both spreads, one under the other. */}
              <div className={`${j.wrap} ${j.spreadStatic}`}>
                <div className={j.staticSpread}>
                  {page(aL, pg)}
                  {page(aR, pg + 1)}
                </div>
                <div className={j.staticSpread}>
                  {page(bL, pg + 2)}
                  {page(bR, pg + 3)}
                </div>
              </div>
              {/* With scroll-driven animations: the right leaf turns over. */}
              <div className={j.spreadBook} aria-hidden="true">
                <div className={j.bookStage}>
                  <div className={j.book}>
                    {page(aL, pg, j.pageLeft)}
                    {page(bR, pg + 3, j.pageRight)}
                    <div className={j.leaf}>
                      {page(aR, pg + 1, j.leafFront)}
                      {page(bL, pg + 2, j.leafBack)}
                    </div>
                    <span className={j.spine} />
                  </div>
                </div>
              </div>
            </section>
          )
        })()}

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

        {/* ---- rubrics (series) ---- */}
        {hasSeries && (
          <section id="series" className={`${j.section} ${j.wrap}`}>
            {head('#series', L.series, L.series, <span className={j.kicker}>{pad2(groups.length)}</span>)}
            <JournalAlbums
              skin={j}
              groups={leanGroups}
              covers={covers}
              labels={{ portfolio: labels.portfolio, photos: labels.photos, viewSeries: labels.viewSeries, close: labels.close }}
            />
          </section>
        )}

        {/* ---- how we shoot ---- */}
        {steps.length > 0 && (
          <section id="process" className={`${j.section} ${j.wrap}`}>
            {head('#process', L.process, L.process)}
            <ol className={j.steps}>
              {steps.map((step, i) => (
                <Reveal key={i} as="li" className={j.step} delay={i * 0.08}>
                  <span className={j.stepNo}>{pad2(i + 1)}</span>
                  {step.title && <h3 className={j.stepTitle}>{step.title}</h3>}
                  {step.text && <p className={j.stepText}>{step.text}</p>}
                </Reveal>
              ))}
            </ol>
          </section>
        )}

        {/* ---- pull quotes ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${j.section} ${j.wrap}`}>
            {head('#reviews', L.testimonials, L.testimonials)}
            <div className={j.quotes}>
              {reviews.map((review, i) => {
                const photo = byId(review.photoId)
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

        {/* ---- price list ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${j.section} ${j.wrap}`}>
            {head('#pricing', labels.pricing, labels.pricing)}
            <ul className={j.prices}>
              {packs.map((pack) => (
                <Reveal as="li" key={pack.name} className={`${j.price} ${pack.featured ? j.priceFeatured : ''}`}>
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
          </section>
        )}

        {/* ---- order form ---- */}
        <section id="contact" className={`${j.section} ${j.wrap}`}>
          <div className={j.contact}>
            <div className={j.contactSide}>
              <span className={j.kicker}>{labels.contacts}</span>
              <RevealText as="h2" text={leadForm ? leadForm.labels.title : labels.contacts} className={j.contactTitle} />
              {contactLinks.length > 0 && (
                <ul className={j.contactList}>
                  {contactLinks.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {contact.bookingUrl && (
                <a href={contact.bookingUrl} className={`${j.ctaInk} ${j.contactBook}`}>
                  {labels.book} <span className={j.arrow}>→</span>
                </a>
              )}
            </div>
            {leadForm && (
              <div className={j.contactForm}>
                <JournalLeadForm skin={j} handle={leadForm.handle} labels={leadForm.labels} shootTypes={packs.map((p) => p.name)} />
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
