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
import { SHEET_FONT_URL } from './fonts'
import s from './Sheet.module.css'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * «Контакт» — documentary, street, reportage: the portfolio is a contact
 * sheet. Frames sit in black film rows with edge codes («▸ 12A»), and the
 * best frame of each direction gets a red grease-pencil circle that draws
 * itself as the sheet scrolls by. The first screen is an enlargement with red
 * crop marks.
 *
 * Effects: crop marks drawn on the first paint (CSS); grease-pencil circles
 * drawn on scroll (scroll-driven SVG stroke); a loupe on hover — the frame
 * lifts and enlarges; lab-sleeve labels for the packages.
 */
export function ThemeKontakt({
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
  const card = buildCard({ content, displayName, portfolio, labels, leadForm: !!leadForm, bookingNav, gridMax: 12 })
  const { brand, title, lead, portrait, bookHref, reviews, packs, L } = card
  const skin = mergeSkin(chrome, s)
  const book = L.bookDate

  // The circled frames: the first one of each direction on the sheet.
  const circled = new Set<string>()
  const seen = new Set<string>()
  for (const p of card.grid) {
    const c = p.category?.trim() ?? ''
    if (!seen.has(c)) {
      seen.add(c)
      circled.add(p.id)
    }
  }

  const head = (code: string, heading: string) => (
    <div className={s.sectionHead}>
      <span className={s.code}>{code}</span>
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )

  return (
    <MotionRoot>
      <link rel="preload" href={SHEET_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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

        {/* ---- 1. first screen: the enlargement ---- */}
        <header id="top" className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroCopy}>
            <p className={s.heroRole} data-card="role">
              {card.role}
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
            {card.directions.length > 0 && (
              <ul className={s.rolls} data-card="directions">
                {card.directions.map((d, i) => (
                  <li key={d}>
                    <span>ROLL {pad2(i + 1)}</span> {d}
                  </li>
                ))}
              </ul>
            )}
            {card.city && (
              <p className={s.heroCity} data-card="city">
                ⌖ {card.city}
              </p>
            )}
            <a href={bookHref} className={s.btn} data-card="book">
              {book} →
            </a>
          </div>
          {lead && (
            <div className={s.print} style={{ '--r': ratioOf(lead, '3 / 2') } as React.CSSProperties}>
              <div className={s.printImg}>
                <Picture
                  src={lead.previewUrl}
                  srcSet={lead.srcSet}
                  avifSrcSet={lead.avifSrcSet}
                  sizes="(max-width: 760px) 92vw, 50vw"
                  alt={lead.caption || lead.category || title}
                  priority
                />
              </div>
              <span className={s.crop} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              {content.hero.subtitle && <p className={s.printNote}>{content.hero.subtitle}</p>}
            </div>
          )}
        </header>

        {/* ---- 2. portfolio: the contact sheet ---- */}
        {card.grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head('01', labels.portfolio)}
            <FilterBar card={card} gridId="contact-sheet" s={s} />
            <ol id="contact-sheet" className={s.sheet}>
              {card.grid.map((p, i) => (
                <li key={p.id} className={s.frame} data-cat={p.category ?? ''}>
                  <span className={s.edge} aria-hidden="true">
                    ▸ {i + 1}
                    <b>{i + 1}A</b>
                  </span>
                  <span className={s.frameImg}>
                    <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 46vw, 24vw" />
                    {circled.has(p.id) && (
                      <svg className={s.circle} viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M50 4 C 82 3, 97 18, 96 36 C 95 56, 74 67, 47 66 C 20 65, 3 53, 4 34 C 5 16, 22 6, 55 5" pathLength={1} />
                      </svg>
                    )}
                  </span>
                  <span className={s.edge} aria-hidden="true">
                    {p.category ?? ''}
                    <b>{p.caption ?? ''}</b>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---- 3. packages + terms ---- */}
        {packs.length > 0 && (
          <section id="pricing" className={`${s.section} ${s.wrap}`}>
            {head('02', labels.pricing)}
            <div className={s.packs}>
              {packs.map((pack, i) => (
                <Reveal key={pack.name} delay={i * 0.06} y={14} pack={pack.name}>
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    <p className={s.sleeve}>
                      <span>№ {pad2(i + 1)}</span>
                      {pack.featured && <span>{L.popular}</span>}
                    </p>
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
        <GiftsBlock card={card} s={{ ...s, gifts: `${s.section} ${s.wrap}` }} heading={head('02+', L.giftsTitle)} />

        {/* ---- 4. about ---- */}
        {content.about.text && (
          <section id="about" className={`${s.section} ${s.wrap}`}>
            {head('03', labels.about)}
            <div className={`${s.about} ${portrait ? '' : s.aboutSolo}`}>
              {portrait && (
                <div className={s.aboutImg}>
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="(max-width: 760px) 40vw, 22vw" />
                </div>
              )}
              <p className={s.aboutText}>{content.about.text}</p>
            </div>
          </section>
        )}

        {/* ---- 5. reviews (optional) ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${s.section} ${s.wrap}`}>
            {head('04', L.testimonials)}
            <div className={s.reviews}>
              {reviews.map((r, i) => (
                <figure key={i} className={s.review}>
                  <blockquote className={s.reviewText}>{r.text}</blockquote>
                  <figcaption className={s.reviewWho}>— {r.names}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---- 6. booking & contacts ---- */}
        <section id="contact" className={`${s.section} ${s.wrap}`}>
          {head('05', leadForm ? leadForm.labels.title : labels.contacts)}
          <div className={s.contact}>
            <div>
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
