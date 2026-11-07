import Image from 'next/image'
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
import { DevelopImage, MotionRoot, Reveal, RevealText } from '../motion/lazy'
import { ParallaxImage } from '../motion/ParallaxImage'
import { ScrollLitText } from '../motion/ScrollLitText'
import { PackCta, TyshaAlbums, TyshaHero, TyshaLeadForm, TyshaNav } from './islands'
import type { HeroSlide } from './TyshaHero'
import type { NavLink } from './TyshaNav'
import t from './Tysha.module.css'

/** Frames shown in the editorial grid before the series take over. */
const GRID_LIMIT_WITH_SERIES = 12
const HERO_FRAMES = 4

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * «Тиша» — the flagship, rebuilt as a premium wedding-photographer site:
 * full-screen cross-fading hero, editorial asymmetric portfolio whose frames
 * «develop» in, a scroll-lit about quote beside a parallax portrait, numbered
 * series, «Як ми працюємо», reviews, pricing cards, a hairline enquiry form
 * and a big-name footer. Blocks with no data are simply not rendered.
 *
 * Server component: only the pieces that move (nav, hero, reveals, albums,
 * form) are client islands; parallax and the lit quote are pure CSS.
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
}: {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  bookingNav?: BookingNav
}) {
  const brand = displayName || content.hero.title || ''
  const title = content.hero.title || brand
  const photos = portfolio.filter((p): p is PortfolioItem & { previewUrl: string } => !!p.previewUrl)
  const byId = (id: string) => (id ? photos.find((p) => p.id === id) : undefined)

  // Hero: the chosen photo first, then the next frames of the portfolio.
  const heroFirst = byId(content.hero.imageId) ?? photos[0]
  const heroSlides: HeroSlide[] = heroFirst
    ? [heroFirst, ...photos.filter((p) => p.id !== heroFirst.id)]
        .slice(0, HERO_FRAMES)
        .map((p) => ({ id: p.id, src: p.previewUrl, alt: p.caption || p.category || title }))
    : []

  const groups = groupPortfolio(photos)
  const hasSeries = groups.some((g) => g.category !== null)
  // With a big enough portfolio the grid continues where the hero stopped
  // instead of repeating its frames.
  const heroIds = new Set(heroSlides.map((s) => s.id))
  const pool = photos.length >= heroSlides.length + 6 ? photos.filter((p) => !heroIds.has(p.id)) : photos
  const gridItems = hasSeries ? pool.slice(0, GRID_LIMIT_WITH_SERIES) : pool
  const portrait = byId(content.about.imageId)
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

  return (
    <MotionRoot>
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

        <TyshaHero
          slides={heroSlides}
          title={title}
          subtitle={content.hero.subtitle}
          cta={{ href: bookHref, label: L.bookDate }}
          scrollHint={L.scroll}
          scrollTarget={photos.length > 0 ? '#portfolio' : '#contact'}
        />

        {/* ---- portfolio: asymmetric editorial grid ---- */}
        {gridItems.length > 0 && (
          <section id="portfolio" className={`${t.section} ${t.wrap}`}>
            {head(
              labels.portfolio,
              L.selected,
              <span className={t.label}>{pad2(photos.length)}</span>
            )}
            <div className={t.grid}>
              {gridItems.map((item, i) => (
                <Reveal key={item.id} as="figure" className={t.work} delay={(i % 2) * 0.1} y={36}>
                  <div className={t.workFrame}>
                    <DevelopImage
                      src={item.previewUrl}
                      alt={item.caption || item.category || title}
                      sizes="(max-width: 760px) 100vw, 58vw"
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
              groups={groups}
              covers={content.albumCovers}
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
                              <Image src={photo.previewUrl} alt="" fill sizes="52px" />
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
                      <PackCta
                        pack={pack.name}
                        href={bookHref}
                        className={pack.featured ? t.ctaDark : t.ctaLine}
                      >
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
                <TyshaLeadForm
                  handle={leadForm.handle}
                  labels={leadForm.labels}
                  shootTypes={packs.map((p) => p.name)}
                />
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
            <a href={BASE_URL} target="_blank" rel="noopener">
              {L.madeOn}
            </a>
          </div>
        </footer>
      </div>
    </MotionRoot>
  )
}
