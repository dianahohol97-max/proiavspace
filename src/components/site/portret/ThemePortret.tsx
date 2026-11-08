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
import { STUDIO_FONT_URL } from './fonts'
import { BeforeAfterIsland } from './islands'
import s from './Studio.module.css'

/**
 * «Портрет» — business portraits, personal brand, actors' portfolios:
 * studio grey-white, graphite, a deep bottle green, a calm grotesk.
 *
 * Effects: the first-screen portrait develops from grey to colour (CSS, first
 * paint); a «до / після ретуші» slider in the portfolio — the «фірмовий кадр»
 * photo is the «до», the first-screen frame the «після» (native range input:
 * drag, tap, arrow keys); grid frames turn from monochrome to colour on hover;
 * «Як підготуватися» — the «що взяти» line as a checklist whose ticks draw
 * themselves (scroll-driven).
 */
export function ThemePortret({
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
  // The «до» frame is shown only inside the slider, never in the grid.
  const beforeId = content.moment.imageId
  const card = buildCard({
    content,
    displayName,
    portfolio: portfolio.filter((p) => p.id !== beforeId || !beforeId),
    labels,
    leadForm: !!leadForm,
    bookingNav,
    gridMax: 9,
  })
  const before = portfolio.find((p) => beforeId && p.id === beforeId && p.previewUrl)
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate
  const prepare = content.terms.bring
    .split(/[;\n]|,\s(?=[^,]{12,})/)
    .map((x) => x.trim())
    .filter(Boolean)
  const card2 = { ...card, terms: card.terms.filter((t) => t.key !== 'bring' || prepare.length < 2) }

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={STUDIO_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroRole} data-card="role">
              {card.role}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
            {card.directions.length > 0 && (
              <ul className={s.heroList} data-card="directions">
                {card.directions.map((d, i) => (
                  <li key={d}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {d}
                  </li>
                ))}
              </ul>
            )}
            {card.city && (
              <p className={s.heroCity} data-card="city">
                {card.city}
              </p>
            )}
            <a href={bookHref} className={s.btn} data-card="book">
              {book} <span aria-hidden="true">→</span>
            </a>
          </div>
          {lead && (
            <div className={s.heroImg} style={{ '--r': ratioOf(lead, '4 / 5') } as React.CSSProperties}>
              <Picture
                src={lead.previewUrl}
                srcSet={lead.srcSet}
                avifSrcSet={lead.avifSrcSet}
                sizes="(max-width: 760px) 150px, 34vw"
                alt={lead.caption || lead.category || title}
                priority
              />
              {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
            </div>
          )}
        </header>

        {/* ---- 2. portfolio: retouch slider + grid ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            {before && lead && (
              <div className={s.retouch}>
                <BeforeAfterIsland
                  skin={s}
                  before={{ src: before.previewUrl!, srcSet: before.srcSet }}
                  after={{ src: lead.previewUrl, srcSet: lead.srcSet, avifSrcSet: lead.avifSrcSet }}
                  ratio={ratioOf(lead, '4 / 5')}
                  labels={{ before: L.before, after: L.after, compare: L.compareRetouch }}
                />
                {content.moment.text && <p className={s.retouchNote}>{content.moment.text}</p>}
              </div>
            )}
            <FilterBar card={card} gridId="studio-grid" s={s} />
            <div id="studio-grid" className={s.grid}>
              {card.grid.map((p) => (
                <figure key={p.id} className={s.work} data-cat={p.category ?? ''}>
                  <div className={s.workImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 30vw" />
                  </div>
                  <figcaption className={s.workCap}>
                    {p.category && <span>{p.category}</span>}
                    {p.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 3. packages + terms + how to prepare ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${s.section} ${s.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={s.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.08} y={18} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    <h3 className={s.packName}>{pack.name}</h3>
                    {pack.price && <p className={s.packPrice}>{pack.price}</p>}
                    {pack.featured && <p className={s.packBadge}>{L.popular}</p>}
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
            <div className={s.below}>
              <TermsBlock card={card2} s={s} />
              {prepare.length >= 2 && (
                <aside className={s.prepare}>
                  <p className={s.prepareTitle}>{L.howToPrepare}</p>
                  <ul className={s.prepareList}>
                    {prepare.map((item) => (
                      <li key={item}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
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
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 24vw" />
                </div>
              )}
              <div>
                <span className={s.label}>{labels.about}</span>
                <p className={s.aboutText}>{content.about.text}</p>
                {brand && <p className={s.sign}>{brand}</p>}
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
                  <blockquote className={s.reviewText}>{r.text}</blockquote>
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
