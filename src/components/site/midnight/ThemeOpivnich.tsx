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
import { DevelopImage, MagneticButton, MotionRoot, Reveal, RevealText } from '../motion/lazy'
import { ParallaxImage } from '../motion/ParallaxImage'
import { Picture } from '../motion/Picture'
import { ScrollLitText } from '../motion/ScrollLitText'
import type { NavLink } from '../tysha/TyshaNav'
import { MIDNIGHT_FONT_URL } from './fonts'
import {
  MidnightAlbums,
  MidnightAllPortfolio,
  MidnightLeadForm,
  MidnightNav,
  MidnightPackCta,
  SpotlightFollow,
  StripControls,
} from './islands'
import { layoutMidnight } from './layout'
import m from './Midnight.module.css'

const GRID_MAX = 9
const STRIP_MAX = 10
const pad2 = (n: number) => String(n).padStart(2, '0')
type Photo = PortfolioItem & { previewUrl: string }
const lean = (p: Photo): PortfolioItem => ({ id: p.id, previewUrl: p.previewUrl, caption: p.caption ?? null, category: p.category ?? null })
const ratioOf = (p: Photo) => (p.width && p.height ? `${p.width} / ${p.height}` : '3 / 2')
/** Full-width frames on phones: 360px so a 3× screen still takes the 1080 px `mobile`. */
const PHONE_FULL = '(max-width: 760px) 360px'

/**
 * «Опівніч» — evening weddings, candles and sparklers: light finding its way
 * out of the dark. Its own layout on the shared kit (not a recoloured
 * «Тиша»): a hero that is almost black with a soft patch of light (it follows
 * the cursor on desktop, drifts on phones), frames that rise out of black,
 * a portfolio rhythm with dark pauses, a horizontal «strip of lights» like a
 * contact strip of film, a candle-lit about quote, series, process, reviews,
 * pricing with a gold-lit featured card, a dark enquiry form and the footer.
 *
 * Server component; the hero frame and the name are plain HTML (no JS needed
 * to see them). Client islands load only where this theme renders.
 */
export function ThemeOpivnich({
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
  const title = content.hero.title || brand
  const photos = portfolio.filter((p): p is Photo => !!p.previewUrl)
  const byId = (id: string) => (id ? photos.find((p) => p.id === id) : undefined)
  const shown = new Set<string>()

  const lead = byId(content.hero.imageId) ?? photos[0]
  if (lead) shown.add(lead.id)
  const portrait = byId(content.about.imageId)
  if (portrait) shown.add(portrait.id)

  const pool = photos.length >= 7 ? photos.filter((p) => !shown.has(p.id)) : photos
  const gridItems = pool.slice(0, GRID_MAX)
  gridItems.forEach((p) => shown.add(p.id))
  const spread = layoutMidnight(gridItems)

  // The strip shows what the page has not shown yet; with a small portfolio,
  // the whole portfolio.
  const unseen = photos.filter((p) => !shown.has(p.id))
  const strip = (unseen.length >= 4 ? unseen : photos).slice(0, STRIP_MAX)

  const groups = groupPortfolio(photos)
  const hasSeries = groups.some((g) => g.category !== null)
  const covers: Record<string, { src: string; srcSet?: string }> = {}
  for (const g of groups) {
    const chosen = g.items.find((it) => it.id === content.albumCovers[g.category ?? ''])
    const fresh = chosen && !shown.has(chosen.id) ? chosen : g.items.find((it) => !shown.has(it.id))
    const cover = (fresh ?? chosen ?? g.items[0]) as Photo | undefined
    if (cover) covers[g.category ?? ''] = { src: cover.previewUrl, srcSet: cover.srcSet }
  }
  const leanGroups = groups.map((g) => ({ category: g.category, items: (g.items as Photo[]).map(lean) }))

  const steps = content.process.steps
  const reviews = content.testimonials.items
  const packs = content.pricing.items
  const contact = content.contact
  const instagram = contact.instagram.replace(/^@/, '')

  const L = {
    book: labels.bookEvening ?? labels.bookDate ?? labels.book,
    scroll: labels.scrollHint ?? 'Гортайте',
    menu: labels.menu ?? 'Меню',
    process: labels.process ?? 'Як ми працюємо',
    selected: labels.selectedWork ?? labels.portfolio,
    series: labels.series ?? labels.portfolio,
    testimonials: labels.testimonials ?? 'Відгуки',
    popular: labels.popular ?? 'Найчастіше обирають',
    choose: labels.choosePack ?? labels.book,
    madeOn: labels.madeOn ?? 'Сайт на проЯв',
    all: labels.allPortfolio ?? labels.portfolio,
    strip: labels.filmStrip ?? 'Стрічка вогнів',
    swipe: labels.swipeHint ?? 'Гортайте вбік',
    prev: labels.prev ?? '‹',
    next: labels.next ?? '›',
  }
  const bookHref = leadForm ? '#contact' : contact.bookingUrl || bookingNav?.href || '#contact'
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

  let sectionNo = 0
  const head = (label: string, heading: string, extra?: React.ReactNode) => {
    sectionNo += 1
    return (
      <div className={m.sectionHead}>
        <div>
          <span className={m.label}>
            {pad2(sectionNo)} — {label}
          </span>
          <RevealText as="h2" text={heading} className={m.sectionTitle} />
        </div>
        {extra}
      </div>
    )
  }

  // The name surfaces out of the dark letter by letter — CSS only, from the
  // first paint; readers and crawlers get the plain string.
  let letter = 0
  const heroName = (
    <h1 className={m.heroTitle} aria-label={title}>
      {title.split(/\s+/).filter(Boolean).map((word, wi) => (
        <span key={wi} aria-hidden="true">
          {wi > 0 && ' '}
          <span className={m.heroWord}>
            {Array.from(word).map((ch, ci) => (
              <span key={ci} className={m.heroCh} style={{ '--i': letter++ } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </span>
      ))}
    </h1>
  )
  const afterName = { '--d': `${Math.min(700 + letter * 60, 1800)}ms` } as React.CSSProperties

  return (
    <MotionRoot>
      <link rel="preload" href={MIDNIGHT_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={m.root}>
        <MidnightNav
          skin={m}
          brand={brand}
          logoUrl={logoUrl}
          links={navLinks}
          cta={{ href: bookHref, label: L.book }}
          langSwitch={langSwitch}
          overHero={!!lead}
          menuLabel={L.menu}
          closeLabel={labels.close}
          footLinks={contactLinks}
        />

        {/* ---- hero: light in the dark ---- */}
        <header id="top" className={m.hero}>
          {lead && (
            <div className={m.heroImg}>
              <Picture
                src={lead.previewUrl}
                srcSet={lead.srcSet}
                avifSrcSet={lead.avifSrcSet}
                sizes={`${PHONE_FULL}, 100vw`}
                alt={lead.caption || lead.category || title}
                priority
              />
            </div>
          )}
          <div className={m.spotWrap} aria-hidden="true">
            <div id="midnight-spot" className={m.spot} />
          </div>
          <div className={m.heroVeil} aria-hidden="true" />
          <div className={m.grain} aria-hidden="true" />
          <div className={`${m.wrap} ${m.heroInner}`}>
            <div className={m.heroCopy}>
              {heroName}
              <div className={m.heroRow}>
                {content.hero.subtitle && (
                  <p className={`${m.heroSub} ${m.heroFade}`} style={afterName}>
                    {content.hero.subtitle}
                  </p>
                )}
                <div className={m.heroFade} style={afterName}>
                  <MagneticButton href={bookHref} className={m.ctaGold}>
                    {L.book} <span className={m.arrow}>→</span>
                  </MagneticButton>
                </div>
              </div>
            </div>
            <a href={photos.length > 0 ? '#portfolio' : '#contact'} className={`${m.label} ${m.scrollHint}`}>
              <span className={m.scrollLine} aria-hidden="true" />
              {L.scroll}
            </a>
          </div>
          <SpotlightFollow heroId="top" spotId="midnight-spot" />
        </header>

        {/* ---- portfolio: frames out of the dark ---- */}
        {spread.length > 0 && (
          <section id="portfolio" className={`${m.section} ${m.wrap}`}>
            {head(labels.portfolio, L.selected, <span className={m.label}>{pad2(photos.length)}</span>)}
            <div className={m.grid}>
              {spread.map(({ item, row, desk, mobile }, i) => (
                <Reveal
                  key={item.id}
                  as="figure"
                  className={`${m.work} ${row === 'pause' ? m.pause : ''} ${desk.bleed ? m.bleed : ''}`}
                  delay={desk.offset * 0.08}
                  y={0}
                  style={
                    {
                      '--col': desk.col,
                      '--span': desk.span,
                      '--ratio': desk.ratio,
                      '--offset': desk.offset,
                      '--m-ratio': mobile.ratio,
                      '--m-col': mobile.full ? '1 / -1' : 'auto',
                    } as React.CSSProperties
                  }
                >
                  <div className={m.workFrame}>
                    <DevelopImage
                      from="dark"
                      src={item.previewUrl!}
                      srcSet={item.srcSet}
                      alt={item.caption || item.category || title}
                      sizes={`(max-width: 760px) ${mobile.full ? '360px' : '50vw'}, ${desk.bleed ? '100vw' : `${Math.round((desk.span / 12) * 92)}vw`}`}
                      objectPosition="50% 40%"
                    />
                  </div>
                  <figcaption className={m.workCap}>
                    <span className={m.workNo}>№ {pad2(i + 1)}</span>
                    {item.caption && <span className={m.workTitle}>{item.caption}</span>}
                  </figcaption>
                </Reveal>
              ))}
            </div>
            {photos.length > gridItems.length && (
              <div className={m.allRow}>
                <MidnightAllPortfolio
                  skin={m}
                  items={photos.map(lean)}
                  label={L.all}
                  labels={{ portfolio: L.all, photos: labels.photos, close: labels.close }}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- signature: the strip of lights ---- */}
        {strip.length >= 3 && (
          <section className={m.strip} aria-labelledby="midnight-strip-title">
            <div className={`${m.wrap} ${m.stripHead}`}>
              <div>
                <span className={m.label}>{L.strip}</span>
                <RevealText
                  as="h2"
                  id="midnight-strip-title"
                  text={content.moment.text || L.strip}
                  className={m.stripTitle}
                />
              </div>
              <div className={m.stripNav}>
                <span className={m.label}>{L.swipe} →</span>
                <StripControls
                  scrollerId="midnight-strip"
                  prevLabel={L.prev}
                  nextLabel={L.next}
                  className={m.stripButtons}
                  buttonClassName={m.stripButton}
                />
              </div>
            </div>
            <div className={m.film}>
              <ol id="midnight-strip" className={m.stripScroller} tabIndex={0} aria-label={L.strip}>
                {strip.map((p, i) => (
                  <li key={p.id} data-frame="" className={m.frame}>
                    <div className={m.frameEdge} aria-hidden="true">
                      <span>▸ {i + 1}</span>
                      <span>{i + 1}A</span>
                    </div>
                    <div className={m.frameImg} style={{ '--r': ratioOf(p) } as React.CSSProperties}>
                      <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || title} sizes="(max-width: 760px) 70vw, 34vw" />
                    </div>
                    <div className={m.frameEdge}>
                      <span aria-hidden="true">800T</span>
                      <span>{p.caption || pad2(i + 1)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* ---- about: the quote catches the candle light ---- */}
        {content.about.text && (
          <section id="about" className={`${m.section} ${m.wrap}`}>
            <div className={m.about}>
              {portrait && (
                <div className={m.aboutPortrait}>
                  <ParallaxImage
                    src={portrait.previewUrl}
                    srcSet={portrait.srcSet}
                    alt={brand}
                    sizes="(max-width: 860px) 62vw, 36vw"
                    objectPosition="50% 30%"
                  />
                </div>
              )}
              <div className={portrait ? m.aboutBody : m.aboutBodyWide}>
                <span className={m.label}>{labels.about}</span>
                <ScrollLitText as="blockquote" tone="warm" text={content.about.text} className={m.quote} />
                {brand && <p className={m.signature}>— {brand}</p>}
              </div>
            </div>
          </section>
        )}

        {/* ---- series ---- */}
        {hasSeries && (
          <section id="series" className={`${m.section} ${m.wrap}`}>
            {head(L.series, L.series, <span className={m.label}>{pad2(groups.length)}</span>)}
            <MidnightAlbums
              skin={m}
              reveal="dark"
              groups={leanGroups}
              covers={covers}
              labels={{ portfolio: labels.portfolio, photos: labels.photos, viewSeries: labels.viewSeries, close: labels.close }}
            />
          </section>
        )}

        {/* ---- how we work ---- */}
        {steps.length > 0 && (
          <section id="process" className={`${m.section} ${m.wrap}`}>
            {head(L.process, L.process)}
            <ol className={m.steps}>
              {steps.map((step, i) => (
                <Reveal key={i} as="li" className={m.step} delay={i * 0.1}>
                  <span className={m.stepNo} aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <div>
                    {step.title && <h3 className={m.stepTitle}>{step.title}</h3>}
                    {step.text && <p className={m.stepText}>{step.text}</p>}
                  </div>
                </Reveal>
              ))}
            </ol>
          </section>
        )}

        {/* ---- testimonials ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${m.section} ${m.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={m.reviews}>
              {reviews.map((review, i) => {
                const photo = byId(review.photoId)
                return (
                  <Reveal key={i} as="figure" className={m.review}>
                    <blockquote className={m.reviewText}>«{review.text}»</blockquote>
                    {(review.names || photo) && (
                      <figcaption className={m.reviewWho}>
                        {photo && (
                          <span className={m.reviewPhoto}>
                            <Picture src={photo.previewUrl} srcSet={photo.srcSet} alt="" sizes="48px" />
                          </span>
                        )}
                        {review.names && <span className={m.label}>{review.names}</span>}
                      </figcaption>
                    )}
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- pricing ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${m.section} ${m.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={m.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.1}>
                  <article className={`${m.pack} ${pack.featured ? m.packFeatured : ''}`}>
                    {pack.featured && <span className={m.packBadge}>{L.popular}</span>}
                    <h3 className={m.packName}>{pack.name}</h3>
                    {pack.price && <p className={m.packPrice}>{pack.price}</p>}
                    {pack.includes.length > 0 && (
                      <ul className={m.packList}>
                        {pack.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <div className={m.packCta}>
                      <MidnightPackCta pack={pack.name} href={bookHref} className={pack.featured ? m.ctaGoldFull : m.ctaLine}>
                        {L.choose} <span className={m.arrow}>→</span>
                      </MidnightPackCta>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ---- contact + enquiry form ---- */}
        <section id="contact" className={`${m.section} ${m.wrap}`}>
          <div className={m.contact}>
            <div className={m.contactSide}>
              <span className={m.label}>{labels.contacts}</span>
              <RevealText as="h2" text={leadForm ? leadForm.labels.title : labels.contacts} className={m.contactTitle} />
              {contactLinks.length > 0 && (
                <ul className={m.contactList}>
                  {contactLinks.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {contact.bookingUrl && (
                <div className={m.contactBook}>
                  <a href={contact.bookingUrl} className={m.ctaLine}>
                    {labels.book} <span className={m.arrow}>→</span>
                  </a>
                </div>
              )}
            </div>
            {leadForm && (
              <div className={m.contactForm}>
                <MidnightLeadForm
                  skin={m}
                  handle={leadForm.handle}
                  labels={leadForm.labels}
                  shootTypes={packs.map((p) => p.name)}
                />
              </div>
            )}
          </div>
        </section>

        {/* ---- footer ---- */}
        <footer className={`${m.footer} ${m.wrap}`}>
          <a href="#top" className={m.footName}>
            {brand}
          </a>
          <div className={`${m.footRow} ${m.label}`}>
            <div className={m.footLinks}>
              {contactLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {link.label}
                </a>
              ))}
            </div>
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
