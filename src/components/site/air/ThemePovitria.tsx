import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import { type BookingNav, type LangSwitch, type PortfolioItem, type SiteLabels } from '../SiteRenderer'
import { MagneticButton, MotionRoot, Reveal, RevealText } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import type { NavLink } from '../tysha/TyshaNav'
import { ContactLinks, FilterBar, GiftsBlock, HeroFacts, TermsBlock } from '../card/blocks'
import { buildCard, type Photo } from '../card/data'
import { AIR_FONT_URL } from './fonts'
import { AirFloat, AirLeadForm, AirNav, AirPackCta } from './islands'
import { dayMoments, layoutAir } from './layout'
import a from './Air.module.css'

const GRID_MAX = 12
const pad2 = (n: number) => String(n).padStart(2, '0')
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
  const card = buildCard({
    content,
    displayName,
    portfolio,
    labels,
    leadForm: !!leadForm,
    bookingNav,
    gridMax: GRID_MAX,
  })
  const { brand, title, photos, lead, portrait, bookHref, reviews, packs } = card
  const gridItems = card.grid
  const clusters = layoutAir(gridItems)

  // «День у світлі», now a light detail of the collage: a frame whose caption
  // starts with a time («08:40 · Ранок») gets a stamp coloured by the hour.
  const moments = dayMoments(gridItems)
  const stamp = new Map(
    moments.map((m, i) => [
      m.item.id,
      {
        time: m.time,
        label: m.label,
        ink: DAY_INK[
          Math.min(DAY_INK.length - 1, Math.round((i / Math.max(moments.length - 1, 1)) * (DAY_INK.length - 1)))
        ],
      },
    ]),
  )

  // Two prints float over the hero: unseen portrait frames if there are any.
  const shown = new Set([lead?.id, portrait?.id, ...gridItems.map((p) => p.id)])
  const spare = photos.filter((p) => !shown.has(p.id))
  const floats = [...spare.filter(isPortrait), ...spare.filter((p) => !isPortrait(p)), ...gridItems.slice(-2)].slice(
    0,
    2,
  )

  const L = {
    ...card.L,
    book: card.L.bookDate,
    scroll: labels.scrollHint ?? 'Гортайте',
    selected: labels.selectedWork ?? labels.portfolio,
    choose: card.L.choosePack,
    day: labels.dayInLight ?? 'День у світлі',
  }
  const navLinks: NavLink[] = card.navLinks
  const contactLinks: NavLink[] = card.contactLinks

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
              <h1 className={a.heroTitle} data-card="name">
                {title}
              </h1>
              <HeroFacts card={card} s={a} />
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
              <div
                className={a.floatInner}
                style={
                  {
                    '--r': p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5',
                  } as React.CSSProperties
                }
              >
                <Picture src={p.previewUrl} srcSet={p.srcSet} alt="" sizes="(max-width: 760px) 34vw, 18vw" />
              </div>
            </div>
          ))}
          <div className={a.heroBar}>
            <span data-card="book">
              <MagneticButton href={bookHref} className={a.ctaSky}>
                {L.book} <span className={a.arrow}>→</span>
              </MagneticButton>
            </span>
            <a href={photos.length > 0 ? '#portfolio' : '#contact'} className={`${a.label} ${a.scrollHint}`}>
              {L.scroll} ↓
            </a>
          </div>
          <AirFloat heroId="top" />
        </header>

        {/* ---- portfolio: prints on a table ---- */}
        {clusters.length > 0 && (
          <section id="portfolio" className={`${a.section} ${a.portfolio}`}>
            <div className={a.wrap}>
              {head(
                labels.portfolio,
                L.selected,
                <span className={a.label}>{moments.length >= 3 ? L.day : pad2(gridItems.length)}</span>,
              )}
              <FilterBar card={card} gridId="air-collage" s={a} />
              <div className={a.collage} id="air-collage">
                {clusters.map((cluster, ci) => (
                  <div key={ci} className={`${a.cluster} ${cluster[0]?.mirror ? a.mirror : ''}`}>
                    {cluster.map(({ item, role, tilt, ratio }) => (
                      <figure
                        key={item.id}
                        data-cat={item.category ?? ''}
                        className={`${a.print} ${[a.big, a.mid, a.small][role]}`}
                        style={
                          {
                            '--tilt': `${tilt}deg`,
                            '--r': ratio,
                          } as React.CSSProperties
                        }
                      >
                        <div className={a.printImg}>
                          <Picture
                            src={item.previewUrl!}
                            srcSet={item.srcSet}
                            alt={item.caption || item.category || title}
                            sizes={role === 0 ? '(max-width: 760px) 360px, 48vw' : '(max-width: 760px) 50vw, 32vw'}
                          />
                        </div>
                        {stamp.has(item.id) ? (
                          <figcaption className={a.printCap}>
                            <span className={a.time} style={{ color: stamp.get(item.id)!.ink }}>
                              {stamp.get(item.id)!.time}
                            </span>{' '}
                            {stamp.get(item.id)!.label}
                          </figcaption>
                        ) : (
                          item.caption && <figcaption className={a.printCap}>{item.caption}</figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
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
                  <article className={`${a.pack} ${pack.featured ? a.packFeatured : ''}`} data-pack={pack.name}>
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
            <TermsBlock card={card} s={a} />
          </section>
        )}

        {/* ---- gifts & prints (optional) ---- */}
        <GiftsBlock
          card={card}
          s={{ ...a, gifts: `${a.section} ${a.wrap} ${a.gifts}` }}
          heading={head(L.giftsTitle, L.giftsTitle)}
        />

        {/* ---- about ---- */}
        {content.about.text && (
          <section id="about" className={`${a.section} ${a.wrap}`}>
            <div className={a.about}>
              {portrait && (
                <Reveal className={a.aboutPortrait} y={30}>
                  <div
                    className={a.printImg}
                    style={
                      {
                        '--r': portrait.width && portrait.height ? `${portrait.width} / ${portrait.height}` : '4 / 5',
                      } as React.CSSProperties
                    }
                  >
                    <Picture
                      src={portrait.previewUrl}
                      srcSet={portrait.srcSet}
                      alt={brand}
                      sizes="(max-width: 860px) 60vw, 30vw"
                    />
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

        {/* ---- reviews ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${a.section} ${a.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={a.reviews}>
              {reviews.map((review, i) => {
                const photo = review.photo
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

        {/* ---- contact ---- */}
        <section id="contact" className={`${a.section} ${a.wrap}`}>
          <div className={a.contact}>
            <div className={a.contactSide}>
              <span className={a.label}>{labels.contacts}</span>
              <RevealText
                as="h2"
                text={leadForm ? leadForm.labels.title : labels.contacts}
                className={a.contactTitle}
              />
              <ContactLinks card={card} s={a} />
              {content.contact.bookingUrl && (
                <a href={content.contact.bookingUrl} className={`${a.ctaSoft} ${a.contactBook}`}>
                  {labels.book} <span className={a.arrow}>→</span>
                </a>
              )}
            </div>
            {leadForm && (
              <div className={a.contactForm}>
                <AirLeadForm
                  skin={a}
                  handle={leadForm.handle}
                  labels={leadForm.labels}
                  shootTypes={card.topics}
                  certificateTopic={card.certificateTopic}
                />
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
