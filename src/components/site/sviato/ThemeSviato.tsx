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
import { FreeCalendar } from './Calendar'
import { PARTY_FONT_URL } from './fonts'
import s from './Party.module.css'

const STRIP = 4
const TONES = ['var(--v-sun)', 'var(--v-teal)', 'var(--v-violet)', 'var(--v-tomato)']
const CONFETTI = 16

/**
 * «Свято» — birthdays, christenings, corporate parties: party cream, deep
 * violet ink, tomato and confetti colours, a round cheerful sans.
 *
 * Effects: a photo-booth strip «prints» out of the machine slot on the first
 * screen (CSS, first paint); confetti drifts down behind the name (CSS, off
 * under reduced motion); portfolio frames in coloured mats that wiggle on
 * hover; the free-dates calendar — free days pulse, and a click fills the
 * form's date.
 */
export function ThemeSviato({
  content,
  displayName,
  logoUrl,
  portfolio,
  labels,
  langSwitch,
  leadForm,
  bookingNav,
  platformCredit = false,
  freeDates = [],
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
  freeDates?: string[]
}) {
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 12 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate
  const strip = lead ? [lead, ...card.grid].slice(0, STRIP) : []
  const inStrip = new Set(strip.map((p) => p.id))
  const rest = card.grid.filter((p) => !inStrip.has(p.id))
  const grid = rest.length >= 6 ? rest : card.grid
  const stamp = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const calendarHref = bookingNav ? bookingNav.href : bookHref

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={PARTY_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: confetti + the photo-booth strip ---- */}
        <header id="top" className={s.hero}>
          <div className={s.confetti} aria-hidden="true">
            {Array.from({ length: CONFETTI }, (_, i) => (
              <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.9}s`, '--t': TONES[i % 4], '--w': `${6 + (i % 3) * 3}px` } as React.CSSProperties} />
            ))}
          </div>
          <div className={`${s.wrap} ${s.heroInner}`}>
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
                <ul className={s.heroTags} data-card="directions">
                  {card.directions.map((d, i) => (
                    <li key={d} style={{ background: TONES[i % 4] }}>
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
              <a href={bookHref} className={s.btn} data-card="book">
                {book} <span aria-hidden="true">✦</span>
              </a>
            </div>
            {strip.length > 0 && (
              <div className={s.booth}>
                <span className={s.slot} aria-hidden="true" />
                <div className={s.strip}>
                  {strip.map((p, i) => (
                    <span key={p.id} className={s.shot}>
                      <Picture
                        src={p.previewUrl}
                        srcSet={p.srcSet}
                        avifSrcSet={p.avifSrcSet}
                        sizes="(max-width: 760px) 120px, 200px"
                        alt={p.caption || p.category || title}
                        priority={i === 0}
                        low={i > 0}
                      />
                    </span>
                  ))}
                  <span className={s.stripFoot}>
                    {brand} · {stamp}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ---- 2. portfolio ---- */}
        {grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="party-grid" s={s} />
            <div id="party-grid" className={s.grid}>
              {grid.map((p, i) => (
                <figure key={p.id} className={s.work} data-cat={p.category ?? ''} style={{ '--mat': TONES[i % 4], '--r': ratioOf(p) } as React.CSSProperties}>
                  <div className={s.workImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 30vw" />
                  </div>
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
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`} style={{ '--tone': TONES[i % 4] } as React.CSSProperties}>
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
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
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
                <figure key={i} className={s.review} style={{ '--tone': TONES[(i + 1) % 4] } as React.CSSProperties}>
                  <blockquote className={s.reviewText}>{r.text}</blockquote>
                  <figcaption className={s.reviewWho}>{r.names}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 6. booking & contacts (+ free dates) ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          <div className={s.contact}>
            <div>
              <span className={s.label}>{labels.contacts}</span>
              <h2 className={s.sectionTitle}>{leadForm ? leadForm.labels.title : labels.contacts}</h2>
              <ContactLinks card={card} s={s} />
              {freeDates.length > 0 && (
                <FreeCalendar
                  dates={freeDates}
                  href={calendarHref}
                  title={L.freeDates}
                  freeWord={L.freeShort}
                  s={s}
                />
              )}
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
