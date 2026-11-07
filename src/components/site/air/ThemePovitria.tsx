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
import { AIR_FONT_URL } from './fonts'
import { AirAlbums, AirAllPortfolio, AirFloat, AirLeadForm, AirNav, AirPackCta } from './islands'
import { dayMoments, layoutAir } from './layout'
import a from './Air.module.css'

const GRID_MAX = 9
const pad2 = (n: number) => String(n).padStart(2, '0')
type Photo = PortfolioItem & { previewUrl: string }
const lean = (p: Photo): PortfolioItem => ({ id: p.id, previewUrl: p.previewUrl, caption: p.caption ?? null, category: p.category ?? null })
const isPortrait = (p: Photo) => !!p.width && !!p.height && p.height > p.width

/** Daylight from morning to golden hour, for the time stamps (all ≥ 3:1 on the paper, used large). */
const DAY_INK = ['#3f6a92', '#4a6f8a', '#5d7277', '#7d6c4f', '#9a6a33', '#a85f22']

/**
 * «Повітря» — family & lifestyle: daylight, space, a day outdoors. A rounded
 * hero frame with two prints floating at different depths; a collage of
 * prints laid on a table; the signature «День у світлі» — the frames of a
 * day in order of the clock while the sky behind them warms from cool
 * morning white to golden hour; then about, series, how it goes, reviews,
 * prices, the form and the footer.
 *
 * Server component; the hero frame and the name are plain HTML. The sky is
 * CSS scroll-driven (opacity layers + a sun moved by transform).
 */
export function ThemePovitria({
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

  const moments = dayMoments(photos.filter((p) => !shown.has(p.id)))
  const day = moments.length >= 3 ? moments.slice(0, 8) : []
  day.forEach((m) => shown.add(m.item.id))

  const pool = photos.length >= 8 ? photos.filter((p) => !shown.has(p.id)) : photos
  const gridItems = pool.slice(0, GRID_MAX)
  gridItems.forEach((p) => shown.add(p.id))
  const clusters = layoutAir(gridItems)

  // Two prints float over the hero: unseen portrait frames if there are any.
  const spare = photos.filter((p) => !shown.has(p.id))
  const floats = [...spare.filter(isPortrait), ...spare.filter((p) => !isPortrait(p)), ...gridItems.slice(-2)].slice(0, 2)

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

  const steps = content.process.steps
  const reviews = content.testimonials.items
  const packs = content.pricing.items
  const contact = content.contact
  const instagram = contact.instagram.replace(/^@/, '')

  const L = {
    book: labels.bookDate ?? labels.book,
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
    day: labels.dayInLight ?? 'День у світлі',
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

  const head = (label: string, heading: string, extra?: React.ReactNode) => (
    <div className={a.sectionHead}>
      <div>
        <span className={a.label}>{label}</span>
        <RevealText as="h2" text={heading} className={a.sectionTitle} />
      </div>
      {extra}
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={AIR_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className={a.root}>
        <AirNav
          skin={a}
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

        {/* ---- hero: lightness ---- */}
        <header id="top" className={`${a.wrap} ${a.hero}`}>
          <div className={a.heroCard}>
            {lead && (
              <Picture
                src={lead.previewUrl}
                srcSet={lead.srcSet}
                avifSrcSet={lead.avifSrcSet}
                sizes="(max-width: 760px) 360px, 92vw"
                alt={lead.caption || lead.category || title}
                priority
                objectPosition="50% 60%"
              />
            )}
            <div className={a.heroShade} aria-hidden="true" />
            <div className={a.heroCopy}>
              <h1 className={a.heroTitle}>{title}</h1>
              {content.hero.subtitle && <p className={a.heroSub}>{content.hero.subtitle}</p>}
            </div>
          </div>
          {floats.map((p, i) => (
            <div
              key={p.id}
              className={`${a.float} ${i === 0 ? a.floatA : a.floatB}`}
              data-depth={i === 0 ? '1.6' : '0.8'}
              aria-hidden="true"
            >
              <div className={a.floatInner} style={{ '--r': p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5' } as React.CSSProperties}>
                <Picture src={p.previewUrl} srcSet={p.srcSet} alt="" sizes="(max-width: 760px) 34vw, 18vw" />
              </div>
            </div>
          ))}
          <div className={a.heroBar}>
            <MagneticButton href={bookHref} className={a.ctaSky}>
              {L.book} <span className={a.arrow}>→</span>
            </MagneticButton>
            <a href={photos.length > 0 ? '#portfolio' : '#contact'} className={`${a.label} ${a.scrollHint}`}>
              {L.scroll} ↓
            </a>
          </div>
          <AirFloat heroId="top" />
        </header>

        {/* ---- portfolio: prints on a table ---- */}
        {clusters.length > 0 && (
          <section id="portfolio" className={`${a.section} ${a.wrap}`}>
            {head(labels.portfolio, L.selected, <span className={a.label}>{pad2(photos.length)}</span>)}
            <div className={a.collage}>
              {clusters.map((cluster, ci) => (
                <div key={ci} className={`${a.cluster} ${cluster[0]?.mirror ? a.mirror : ''}`}>
                  {cluster.map(({ item, role, tilt, ratio }) => (
                    <figure
                      key={item.id}
                      className={`${a.print} ${[a.big, a.mid, a.small][role]}`}
                      style={{ '--tilt': `${tilt}deg`, '--r': ratio } as React.CSSProperties}
                    >
                      <div className={a.printImg}>
                        <Picture
                          src={item.previewUrl!}
                          srcSet={item.srcSet}
                          alt={item.caption || item.category || title}
                          sizes={role === 0 ? '(max-width: 760px) 360px, 48vw' : '(max-width: 760px) 50vw, 32vw'}
                        />
                      </div>
                      {item.caption && <figcaption className={a.printCap}>{item.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              ))}
            </div>
            {photos.length > gridItems.length && (
              <div className={a.allRow}>
                <AirAllPortfolio
                  skin={a}
                  items={photos.map(lean)}
                  label={L.all}
                  labels={{ portfolio: L.all, photos: labels.photos, locale: labels.locale, close: labels.close }}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- signature: a day in the light ---- */}
        {day.length > 0 && (
          <section id="day" className={a.day} aria-labelledby="air-day-title">
            <div className={a.sky} aria-hidden="true">
              {day.map((m, i) => (
                <div
                  key={m.item.id}
                  className={`${a.skyLayer} ${a[`sky${Math.min(5, Math.round((i / Math.max(day.length - 1, 1)) * 5))}`]}`}
                  style={{ '--a': `${((i / day.length) * 100).toFixed(1)}%`, '--b': `${(((i + 1) / day.length) * 100).toFixed(1)}%` } as React.CSSProperties}
                />
              ))}
              <div className={a.sunPath}>
                <div className={a.sun} />
              </div>
            </div>
            <div className={`${a.wrap} ${a.dayInner}`}>
              <div className={a.dayHead}>
                <span className={a.label}>{L.day}</span>
                <RevealText as="h2" id="air-day-title" text={content.moment.text || L.day} className={a.dayTitle} />
              </div>
              <ol className={a.moments}>
                {day.map((m, i) => {
                  const p = m.item as Photo
                  const ink = DAY_INK[Math.min(DAY_INK.length - 1, Math.round((i / Math.max(day.length - 1, 1)) * (DAY_INK.length - 1)))]
                  return (
                    <li key={p.id} className={`${a.moment} ${i % 2 ? a.momentRight : ''}`}>
                      <Reveal className={a.momentInner} y={40}>
                        <div className={a.momentText}>
                          <span className={a.time} style={{ color: ink }}>
                            {m.time}
                          </span>
                          <p className={a.momentLabel}>{m.label}</p>
                        </div>
                        <div className={a.momentImg} style={{ '--r': p.width && p.height ? `${p.width} / ${p.height}` : '3 / 2' } as React.CSSProperties}>
                          <Picture src={p.previewUrl} srcSet={p.srcSet} alt={m.label} sizes="(max-width: 760px) 360px, 52vw" />
                        </div>
                      </Reveal>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>
        )}

        {/* ---- about ---- */}
        {content.about.text && (
          <section id="about" className={`${a.section} ${a.wrap}`}>
            <div className={a.about}>
              {portrait && (
                <Reveal className={a.aboutPortrait} y={30}>
                  <div className={a.printImg} style={{ '--r': portrait.width && portrait.height ? `${portrait.width} / ${portrait.height}` : '4 / 5' } as React.CSSProperties}>
                    <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 860px) 60vw, 30vw" />
                  </div>
                </Reveal>
              )}
              <div className={portrait ? a.aboutBody : a.aboutBodyWide}>
                <span className={a.label}>{labels.about}</span>
                <Reveal y={20}>
                  <p className={a.aboutText}>{content.about.text}</p>
                </Reveal>
                {brand && <p className={a.signature}>{brand}</p>}
              </div>
            </div>
          </section>
        )}

        {/* ---- series ---- */}
        {hasSeries && (
          <section id="series" className={`${a.section} ${a.wrap}`}>
            {head(L.series, L.series, <span className={a.label}>{pad2(groups.length)}</span>)}
            <AirAlbums
              skin={a}
              groups={leanGroups}
              covers={covers}
              labels={{ portfolio: labels.portfolio, photos: labels.photos, locale: labels.locale, viewSeries: labels.viewSeries, close: labels.close }}
            />
          </section>
        )}

        {/* ---- how it goes ---- */}
        {steps.length > 0 && (
          <section id="process" className={`${a.section} ${a.wrap}`}>
            {head(L.process, L.process)}
            <ol className={a.steps}>
              {steps.map((step, i) => (
                <Reveal key={i} as="li" className={a.step} delay={i * 0.08}>
                  <span className={a.stepNo}>{i + 1}</span>
                  {step.title && <h3 className={a.stepTitle}>{step.title}</h3>}
                  {step.text && <p className={a.stepText}>{step.text}</p>}
                </Reveal>
              ))}
            </ol>
          </section>
        )}

        {/* ---- reviews ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${a.section} ${a.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={a.reviews}>
              {reviews.map((review, i) => {
                const photo = byId(review.photoId)
                return (
                  <Reveal key={i} as="figure" className={a.review} delay={i * 0.08}>
                    <blockquote className={a.reviewText}>{review.text}</blockquote>
                    {(review.names || photo) && (
                      <figcaption className={a.reviewWho}>
                        {photo && (
                          <span className={a.reviewPhoto}>
                            <Picture src={photo.previewUrl} srcSet={photo.srcSet} alt="" sizes="48px" />
                          </span>
                        )}
                        {review.names && <span className={a.reviewName}>{review.names}</span>}
                      </figcaption>
                    )}
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- prices ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${a.section} ${a.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={a.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.08}>
                  <article className={`${a.pack} ${pack.featured ? a.packFeatured : ''}`}>
                    {pack.featured && <span className={a.packBadge}>{L.popular}</span>}
                    <h3 className={a.packName}>{pack.name}</h3>
                    {pack.price && <p className={a.packPrice}>{pack.price}</p>}
                    {pack.includes.length > 0 && (
                      <ul className={a.packList}>
                        {pack.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <div className={a.packCta}>
                      <AirPackCta pack={pack.name} href={bookHref} className={pack.featured ? a.ctaSkyFull : a.ctaSoft}>
                        {L.choose} <span className={a.arrow}>→</span>
                      </AirPackCta>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ---- contact ---- */}
        <section id="contact" className={`${a.section} ${a.wrap}`}>
          <div className={a.contact}>
            <div className={a.contactSide}>
              <span className={a.label}>{labels.contacts}</span>
              <RevealText as="h2" text={leadForm ? leadForm.labels.title : labels.contacts} className={a.contactTitle} />
              {contactLinks.length > 0 && (
                <ul className={a.contactList}>
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
                <a href={contact.bookingUrl} className={`${a.ctaSoft} ${a.contactBook}`}>
                  {labels.book} <span className={a.arrow}>→</span>
                </a>
              )}
            </div>
            {leadForm && (
              <div className={a.contactForm}>
                <AirLeadForm skin={a} handle={leadForm.handle} labels={leadForm.labels} shootTypes={packs.map((p) => p.name)} />
              </div>
            )}
          </div>
        </section>

        <footer className={`${a.footer} ${a.wrap}`}>
          <a href="#top" className={a.footName}>
            {brand}
          </a>
          <div className={a.footRow}>
            <div className={a.footLinks}>
              {contactLinks.map((link) => (
                <a key={link.href} href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {link.label}
                </a>
              ))}
            </div>
            {platformCredit && (
              <a href={BASE_URL} target="_blank" rel="noopener" className={a.credit}>
                {L.madeOn}
              </a>
            )}
          </div>
        </footer>
      </div>
    </MotionRoot>
  )
}
