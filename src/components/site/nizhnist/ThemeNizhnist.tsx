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
import { TENDER_FONT_URL } from './fonts'
import { milestones } from './milestones'
import s from './Tender.module.css'

const PASTELS = ['var(--n-blush)', 'var(--n-mint)', 'var(--n-butter)', 'var(--n-sky)']

/**
 * «Ніжність» — newborns, pregnancy, a baby's first year: milk-white paper,
 * pastel blush / mint / butter, a rounded type and arches. The structure is
 * the same visiting card as every theme.
 *
 * Effects: the pastel clouds behind the first screen breathe (CSS); the
 * «рік малюка» ribbon — frames captioned «3 міс · …» sit on a dotted line
 * that draws itself as it scrolls by (scroll-driven); frames come into focus
 * from a soft blur (scroll-driven); a «Безпека на зйомці» card next to the
 * prices (the theme's reading of the «фірмовий кадр» field).
 */
export function ThemeNizhnist({
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
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 9 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate

  // The ribbon: age-captioned frames among the best ones; the rest is the grid.
  const ages = milestones(card.grid)
  const ribbon = ages.length >= 3 ? ages : []
  const inRibbon = new Set(ribbon.map((m) => m.item.id))
  const rest = card.grid.filter((p) => !inRibbon.has(p.id))
  const safety = content.moment.text.trim()
  const safetyPhoto = card.byId(content.moment.imageId)

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={TENDER_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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
        <header id="top" className={s.hero}>
          <div className={s.clouds} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={`${s.wrap} ${s.heroInner}`}>
            {lead && (
              <div className={s.arch}>
                <Picture
                  src={lead.previewUrl}
                  srcSet={lead.srcSet}
                  avifSrcSet={lead.avifSrcSet}
                  sizes="(max-width: 760px) 200px, 34vw"
                  alt={lead.caption || lead.category || title}
                  priority
                />
              </div>
            )}
            <div className={s.heroCopy}>
              <p className={s.heroRole}>
                <span data-card="role">{card.role}</span>
                {card.city && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span data-card="city">{card.city}</span>
                  </>
                )}
              </p>
              <h1 className={s.heroTitle} data-card="name">
                {title}
              </h1>
              {card.directions.length > 0 && (
                <ul className={s.heroDirections} data-card="directions">
                  {card.directions.map((d, i) => (
                    <li key={d} style={{ background: PASTELS[i % PASTELS.length] }}>
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
              <a href={bookHref} className={s.btn} data-card="book">
                {book}
              </a>
            </div>
          </div>
        </header>

        {/* ---- 2. portfolio: the year ribbon + soft grid ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="tender-works" s={s} />
            <div id="tender-works">
              {ribbon.length > 0 && (
                <ol className={s.ribbon}>
                  {ribbon.map((m, i) => (
                    <li key={m.item.id} className={s.step} data-cat={m.item.category ?? ''} style={{ '--i': i } as React.CSSProperties}>
                      <span className={s.stepImg} style={{ background: PASTELS[i % PASTELS.length] }}>
                        <Picture src={m.item.previewUrl!} srcSet={m.item.srcSet} alt={`${m.age} — ${m.label}`} sizes="(max-width: 760px) 30vw, 160px" />
                      </span>
                      <span className={s.stepAge}>{m.age}</span>
                      <span className={s.stepLabel}>{m.label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className={s.grid}>
                {rest.map((p) => (
                  <figure key={p.id} className={s.work} data-cat={p.category ?? ''} style={{ '--r': ratioOf(p) } as React.CSSProperties}>
                    <div className={s.workImg}>
                      <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 50vw, 31vw" />
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---- 3. packages + terms + safety ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${s.section} ${s.wrap}`}>
            {head(labels.pricing, labels.pricing)}
            <div className={s.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.08} y={20} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`} style={{ '--tone': PASTELS[i % 3] } as React.CSSProperties}>
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
                    <PackCta pack={pack.name} href={bookHref} className={pack.featured ? s.btn : s.btnSoft}>
                      {L.choosePack}
                    </PackCta>
                  </article>
                </Reveal>
              ))}
            </div>
            <div className={s.below}>
              <TermsBlock card={card} s={s} />
              {safety && (
                <aside className={s.safety}>
                  {safetyPhoto && (
                    <span className={s.safetyImg}>
                      <Picture src={safetyPhoto.previewUrl} srcSet={safetyPhoto.srcSet} alt="" sizes="96px" />
                    </span>
                  )}
                  <p className={s.safetyText}>{safety}</p>
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
                <div className={s.aboutArch}>
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
                <figure key={i} className={s.review} style={{ background: PASTELS[(i + 1) % PASTELS.length] }}>
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
                <a href={content.contact.bookingUrl} className={s.btnSoft}>
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
