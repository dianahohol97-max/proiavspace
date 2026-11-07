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
import { TYSHA_FONT_URL } from './fonts'
import {
  AllPortfolio,
  HeroCounter,
  HeroSlides,
  PackCta,
  TyshaAlbums,
  TyshaLeadForm,
  TyshaNav,
} from './islands'
import { layoutEditorial } from './layout'
import type { HeroSlide } from './TyshaHero'
import type { NavLink } from './TyshaNav'
import t from './Tysha.module.css'

/** The home page shows at most this many frames; the rest sit behind «Усе портфоліо». */
const GRID_MAX = 9
const HERO_FRAMES = 4

const pad2 = (n: number) => String(n).padStart(2, '0')
/**
 * Full-width frames on phones: «360px», not «100vw». A 3× iPhone would ask
 * for 390 × 3 = 1170 px and skip the 1080 px `mobile` rendition for the
 * 2048 px preview; 1080 is 92% of that — indistinguishable, a fraction of
 * the bytes. Desktops still get the preview.
 */
const PHONE_FULL = '(max-width: 760px) 360px'
type Photo = PortfolioItem & { previewUrl: string }
const isLandscape = (p: Photo) => !!p.width && !!p.height && p.width >= p.height
/** What the lightboxes need — keeps the client payload (and the HTML) lean. */
const lean = (p: Photo): PortfolioItem => ({ id: p.id, previewUrl: p.previewUrl, caption: p.caption ?? null, category: p.category ?? null })

/**
 * «Тиша» — the flagship, rebuilt as a premium wedding-photographer site:
 * full-screen cross-fading hero, a dense editorial portfolio (orientation-
 * aware pairs and full-width frames), a signature frame that opens up to the
 * full screen, a scroll-lit about quote beside a parallax portrait, numbered
 * series, «Як ми працюємо», reviews, pricing cards, a hairline enquiry form
 * and a big-name footer. Blocks with no data are simply not rendered.
 *
 * Server component. The hero's first frame and the name are plain server
 * HTML (no JS needed to see them); only what moves is a client island.
 */
export function ThemeTysha({
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
  /** Free site plan only: the small «Сайт на проЯв» credit in the footer. */
  platformCredit?: boolean
}) {
  const brand = displayName || content.hero.title || ''
  const title = content.hero.title || brand
  const photos = portfolio.filter((p): p is Photo => !!p.previewUrl)
  const byId = (id: string) => (id ? photos.find((p) => p.id === id) : undefined)
  const shown = new Set<string>()

  // Hero: the chosen photo first, then the next frames of the portfolio.
  const heroFirst = byId(content.hero.imageId) ?? photos[0]
  const heroPhotos = heroFirst
    ? [heroFirst, ...photos.filter((p) => p.id !== heroFirst.id)].slice(0, HERO_FRAMES)
    : []
  heroPhotos.forEach((p) => shown.add(p.id))
  const heroSlides: HeroSlide[] = heroPhotos.map((p) => ({
    id: p.id,
    src: p.previewUrl,
    srcSet: p.srcSet,
    avifSrcSet: p.avifSrcSet,
    alt: p.caption || p.category || title,
  }))

  // Selected frames: continue where the hero stopped when there is enough to
  // show; at most GRID_MAX, laid out as an editorial spread.
  const pool = photos.length >= heroPhotos.length + 6 ? photos.filter((p) => !shown.has(p.id)) : photos
  const gridItems = pool.slice(0, GRID_MAX)
  gridItems.forEach((p) => shown.add(p.id))
  const spread = layoutEditorial(gridItems)

  // Signature frame: the chosen one, else a landscape frame not used yet.
  const momentPhoto =
    byId(content.moment.imageId) ??
    photos.find((p) => !shown.has(p.id) && isLandscape(p)) ??
    photos.find((p) => !shown.has(p.id)) ??
    (photos.length > 1 ? photos[photos.length - 1] : undefined)
  if (momentPhoto) shown.add(momentPhoto.id)

  const portrait = byId(content.about.imageId)
  if (portrait) shown.add(portrait.id)

  // Series: a cover the visitor has not just seen above, when there is one.
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
    bookDate: labels.bookDate ?? labels.book,
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
  }

  // Where «Забронювати дату» leads: the form when it is on, else the booking
  // section/page, else the contacts.
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
      <div className={t.sectionHead}>
        <div>
          <span className={t.label}>
            {pad2(sectionNo)} — {label}
          </span>
          <RevealText as="h2" text={heading} className={t.sectionTitle} />
        </div>
        {extra}
      </div>
    )
  }

  // Hero name: server-rendered letters with a CSS-only rise (no JS, no
  // hydration wait); screen readers and crawlers get the plain string.
  let letter = 0
  const heroName = (
    <h1 className={t.heroTitle} aria-label={title}>
      {title.split(/\s+/).filter(Boolean).map((word, wi) => (
        <span key={wi} aria-hidden="true">
          {wi > 0 && ' '}
          <span className={t.heroWord}>
            {Array.from(word).map((ch, ci) => (
              <span key={ci} className={t.heroCh} style={{ '--i': letter++ } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </span>
      ))}
    </h1>
  )
  const afterName = { '--d': `${Math.min(300 + letter * 38, 1100)}ms` } as React.CSSProperties
  const lead = heroSlides[0]

  return (
    <MotionRoot>
      {/* One font file, preloaded only where «Тиша» renders. */}
      <link rel="preload" href={TYSHA_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={t.root}>
        <TyshaNav
          brand={brand}
          logoUrl={logoUrl}
          links={navLinks}
          cta={{ href: bookHref, label: L.bookDate }}
          langSwitch={langSwitch}
          overHero={heroSlides.length > 0}
          menuLabel={L.menu}
          closeLabel={labels.close}
          footLinks={contactLinks}
        />

        {/* ---- hero ---- */}
        <header id="top" className={`${t.hero} ${lead ? '' : t.heroPlain}`}>
          {lead && (
            <div className={t.slides}>
              <div className={`${t.slide} ${t.slideBase}`}>
                <div className={t.kb}>
                  <Picture
                    src={lead.src}
                    srcSet={lead.srcSet}
                    avifSrcSet={lead.avifSrcSet}
                    sizes={`${PHONE_FULL}, 100vw`}
                    alt={lead.alt}
                    priority
                  />
                </div>
              </div>
              {heroSlides.length > 1 && <HeroSlides slides={heroSlides} />}
            </div>
          )}
          {lead && <div className={t.heroShade} aria-hidden="true" />}
          <div className={`${t.wrap} ${t.heroInner}`}>
            <div className={t.heroCopy}>
              {heroName}
              <div className={t.heroRow}>
                {content.hero.subtitle && (
                  <p className={`${t.heroSub} ${t.heroFade}`} style={afterName}>
                    {content.hero.subtitle}
                  </p>
                )}
                <div className={t.heroFade} style={afterName}>
                  <MagneticButton href={bookHref} className={t.ctaLight}>
                    {L.bookDate} <span className={t.arrow}>→</span>
                  </MagneticButton>
                </div>
              </div>
            </div>
            <div className={t.heroBar}>
              <a
                href={photos.length > 0 ? '#portfolio' : '#contact'}
                className={`${t.label} ${t.heroLabel} ${t.scrollHint}`}
              >
                <span className={t.scrollLine} aria-hidden="true" />
                {L.scroll}
              </a>
              {heroSlides.length > 1 && <HeroCounter total={heroSlides.length} />}
            </div>
          </div>
        </header>

        {/* ---- portfolio: dense editorial spread, ≤ 9 frames ---- */}
        {spread.length > 0 && (
          <section id="portfolio" className={`${t.section} ${t.wrap}`}>
            {head(labels.portfolio, L.selected, <span className={t.label}>{pad2(photos.length)}</span>)}
            <div className={t.grid}>
              {spread.map(({ item, desk, mobile }, i) => (
                <Reveal
                  key={item.id}
                  as="figure"
                  className={t.work}
                  delay={desk.second ? 0.12 : 0}
                  y={32}
                  style={
                    {
                      '--col': desk.col,
                      '--span': desk.span,
                      '--align': desk.align,
                      '--ratio': desk.ratio,
                      '--m-ratio': mobile.ratio,
                      '--m-col': mobile.full ? '1 / -1' : 'auto',
                    } as React.CSSProperties
                  }
                >
                  <div className={t.workFrame}>
                    <DevelopImage
                      src={item.previewUrl!}
                      srcSet={item.srcSet}
                      alt={item.caption || item.category || title}
                      sizes={`(max-width: 760px) ${mobile.full ? '360px' : '50vw'}, ${Math.round((desk.span / 12) * 92)}vw`}
                      objectPosition="50% 38%"
                    />
                  </div>
                  <figcaption className={t.workCap}>
                    <span className={t.workIdx}>({pad2(i + 1)})</span>
                    {item.category && <span className={t.workSeries}>{item.category}</span>}
                    {item.caption && <span className={t.workTitle}>{item.caption}</span>}
                  </figcaption>
                </Reveal>
              ))}
            </div>
            {photos.length > gridItems.length && (
              <div className={t.allRow}>
                <AllPortfolio
                  items={photos.map(lean)}
                  label={L.all}
                  labels={{ portfolio: L.all, photos: labels.photos, close: labels.close }}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- signature moment: a frame that opens up to the full screen ---- */}
        {momentPhoto && (
          <section className={t.moment} aria-label={content.moment.text || undefined}>
            <div className={t.momentStage}>
              <div className={t.momentFrame}>
                <Picture
                  src={momentPhoto.previewUrl}
                  srcSet={momentPhoto.srcSet}
                  avifSrcSet={momentPhoto.avifSrcSet}
                  sizes={`${PHONE_FULL}, 100vw`}
                  alt={content.moment.text ? '' : momentPhoto.caption || title}
                  className={t.momentImg}
                />
              </div>
              {content.moment.text && <p className={t.momentText}>{content.moment.text}</p>}
            </div>
          </section>
        )}

        {/* ---- about: scroll-lit quote beside a parallax portrait ---- */}
        {content.about.text && (
          <section id="about" className={`${t.section} ${t.wrap}`}>
            <div className={t.about}>
              {portrait && (
                <div className={t.aboutPortrait}>
                  <ParallaxImage
                    src={portrait.previewUrl}
                    srcSet={portrait.srcSet}
                    alt={brand}
                    sizes="(max-width: 860px) 78vw, 40vw"
                    objectPosition="50% 30%"
                  />
                </div>
              )}
              <div className={portrait ? t.aboutBody : t.aboutBodyWide}>
                <span className={t.label}>{labels.about}</span>
                <ScrollLitText as="blockquote" text={content.about.text} className={t.quote} />
                {brand && <p className={t.signature}>— {brand}</p>}
              </div>
            </div>
          </section>
        )}

        {/* ---- series (albums) ---- */}
        {hasSeries && (
          <section id="series" className={`${t.section} ${t.wrap}`}>
            {head(L.series, L.series, <span className={t.label}>{pad2(groups.length)}</span>)}
            <TyshaAlbums
              groups={leanGroups}
              covers={covers}
              labels={{
                portfolio: labels.portfolio,
                photos: labels.photos,
                viewSeries: labels.viewSeries,
                close: labels.close,
              }}
            />
          </section>
        )}

        {/* ---- how we work ---- */}
        {steps.length > 0 && (
          <section id="process" className={`${t.section} ${t.wrap}`}>
            {head(L.process, L.process)}
            <ol className={t.steps}>
              {steps.map((step, i) => (
                <Reveal key={i} as="li" className={t.step} delay={i * 0.1}>
                  <span className={t.stepNo} aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  {step.title && <h3 className={t.stepTitle}>{step.title}</h3>}
                  {step.text && <p className={t.stepText}>{step.text}</p>}
                </Reveal>
              ))}
            </ol>
          </section>
        )}

        {/* ---- testimonials ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${t.section} ${t.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={t.reviews}>
              {reviews.map((review, i) => {
                const photo = byId(review.photoId)
                return (
                  <Reveal key={i} as="figure" className={t.review}>
                    <span className={t.reviewMark} aria-hidden="true">
                      “
                    </span>
                    <div>
                      <blockquote className={t.reviewText}>{review.text}</blockquote>
                      {(review.names || photo) && (
                        <figcaption className={t.reviewWho}>
                          {photo && (
                            <span className={t.reviewPhoto}>
                              <Picture src={photo.previewUrl} srcSet={photo.srcSet} alt="" sizes="52px" />
                            </span>
                          )}
                          {review.names && <span className={t.label}>{review.names}</span>}
                        </figcaption>
                      )}
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- pricing ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${t.section} ${t.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={t.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.1}>
                  <article className={`${t.pack} ${pack.featured ? t.packFeatured : ''}`}>
                    {pack.featured && <span className={t.packBadge}>{L.popular}</span>}
                    <h3 className={t.packName}>{pack.name}</h3>
                    {pack.price && <p className={t.packPrice}>{pack.price}</p>}
                    {pack.includes.length > 0 && (
                      <ul className={t.packList}>
                        {pack.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <div className={t.packCta}>
                      <PackCta pack={pack.name} href={bookHref} className={pack.featured ? t.ctaDark : t.ctaLine}>
                        {L.choose} <span className={t.arrow}>→</span>
                      </PackCta>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ---- contact + enquiry form ---- */}
        <section id="contact" className={`${t.section} ${t.wrap}`}>
          <div className={t.contact}>
            <div className={t.contactSide}>
              <span className={t.label}>{labels.contacts}</span>
              <RevealText
                as="h2"
                text={leadForm ? leadForm.labels.title : labels.contacts}
                className={t.contactTitle}
              />
              {(contact.email || contact.phone || instagram) && (
                <dl className={t.contactList}>
                  {contact.phone && (
                    <div>
                      <dt className={t.label}>{leadForm?.labels.phone ?? 'Телефон'}</dt>
                      <dd>
                        <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
                      </dd>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <dt className={t.label}>Email</dt>
                      <dd>
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </dd>
                    </div>
                  )}
                  {instagram && (
                    <div>
                      <dt className={t.label}>Instagram</dt>
                      <dd>
                        <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer">
                          @{instagram}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {contact.bookingUrl && (
                <div className={t.contactBook}>
                  <a href={contact.bookingUrl} className={t.ctaLine}>
                    {labels.book} <span className={t.arrow}>→</span>
                  </a>
                </div>
              )}
            </div>
            {leadForm && (
              <div className={t.contactForm}>
                <TyshaLeadForm handle={leadForm.handle} labels={leadForm.labels} shootTypes={packs.map((p) => p.name)} />
              </div>
            )}
          </div>
        </section>

        {/* ---- footer: the name, big ---- */}
        <footer className={`${t.footer} ${t.wrap}`}>
          <a href="#top" className={t.footName} style={{ textDecoration: 'none' }}>
            {brand}
          </a>
          <div className={`${t.footRow} ${t.label}`}>
            <div className={t.footLinks}>
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
