import type { SiteContent } from '@/lib/site/content'
import { BASE_URL } from '@/lib/seo/site'
import type { LeadFormLabels } from '../LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from '../SiteRenderer'
import { MotionRoot, Reveal } from '../motion/lazy'
import { Picture } from '../motion/Picture'
import { ContactLinks, FilterBar, GiftsBlock, TermsBlock } from '../card/blocks'
import { buildCard, mergeSkin, type Photo } from '../card/data'
import { CardLeadForm, CardNav } from '../card/islands'
import chrome from '../card/Chrome.module.css'
import { PackCta } from '../tysha/PackCta'
import { FEED_FONT_URL } from './fonts'
import s from './Feed.module.css'

const REEL_MAX = 4
const isPortrait = (p: Photo) => !p.width || !p.height || p.height > p.width

/**
 * «Контент» — content for brands and social media. The page reads like a
 * creator's profile: a phone-sized vertical reel that plays by itself on the
 * first screen (frames — or short muted clips when the item has a video —
 * with story progress bars, CSS-only), directions as hashtags, the portfolio
 * as a square profile grid with «highlights» as filters, packages as post
 * cards and reviews as DM bubbles.
 *
 * Effects: the autoplaying reel with progress bars (CSS keyframes, no JS);
 * highlight rings on the filters; grid tiles that pop in on scroll
 * (scroll-driven) with a caption overlay on hover; reviews that arrive like
 * chat messages.
 */
export function ThemeKontent({
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
  const handle = content.contact.instagram.replace(/^@/, '') || content.contact.telegram || ''

  // The reel: the first-screen frame, then vertical frames of the best ones.
  const reel = lead ? [lead, ...card.grid.filter(isPortrait).filter((p) => p.id !== lead.id)].slice(0, REEL_MAX) : []
  // The profile grid holds every best frame — reels included, as on a real profile.
  const grid = card.grid
  const step = 3 // seconds per reel frame

  const head = (label: string, heading: string) => (
    <div className={s.sectionHead}>
      {label !== heading && <span className={s.label}>{label}</span>}
      <h2 className={s.sectionTitle}>{heading}</h2>
    </div>
  )
  const initials = brand
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

  return (
    <MotionRoot>
      <link rel="preload" href={FEED_FONT_URL} as="font" type="font/woff2" crossOrigin="anonymous" />
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
            <p className={s.heroRole}>
              <span className={s.dot} aria-hidden="true" />
              <span data-card="role">{card.role}</span>
            </p>
            <h1 className={s.heroTitle} data-card="name">
              {title}
            </h1>
            {card.directions.length > 0 && (
              <p className={s.tags} data-card="directions">
                {card.directions.map((d) => (
                  <span key={d}>#{d.toLowerCase().replace(/\s+/g, '')}</span>
                ))}
              </p>
            )}
            {card.city && (
              <p className={s.city} data-card="city">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {card.city}
              </p>
            )}
            {content.hero.subtitle && <p className={s.heroSub}>{content.hero.subtitle}</p>}
            <a href={bookHref} className={s.btn} data-card="book">
              {book} <span aria-hidden="true">↗</span>
            </a>
          </div>
          {reel.length > 0 && (
            <div className={s.phone} data-n={reel.length} style={{ '--n': reel.length, '--step': `${step}s` } as React.CSSProperties}>
              <div className={s.bars} aria-hidden="true">
                {reel.map((p, i) => (
                  <span key={p.id}>
                    <i data-i={i} />
                  </span>
                ))}
              </div>
              {handle && (
                <p className={s.phoneHandle} aria-hidden="true">
                  <span>{initials}</span>@{handle}
                </p>
              )}
              {reel.map((p, i) => (
                <div key={p.id} className={s.frame} data-i={i}>
                  {p.videoUrl ? (
                    <video src={p.videoUrl} poster={p.previewUrl} muted autoPlay loop playsInline preload="metadata" aria-label={p.caption || title} />
                  ) : (
                    <Picture
                      src={p.previewUrl}
                      srcSet={p.srcSet}
                      avifSrcSet={p.avifSrcSet}
                      sizes="(max-width: 760px) 150px, 340px"
                      alt={p.caption || p.category || title}
                      priority={i === 0}
                      low={i > 0}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </header>

        {/* ---- 2. portfolio: the profile grid ---- */}
        {grid.length > 0 && (
          <section id="portfolio" className={`${s.section} ${s.wrap}`}>
            {head(labels.portfolio, labels.selectedWork ?? labels.portfolio)}
            <FilterBar card={card} gridId="feed-grid" s={s} />
            <div id="feed-grid" className={s.grid}>
              {grid.map((p) => (
                <figure key={p.id} className={s.tile} data-cat={p.category ?? ''}>
                  <Picture src={p.previewUrl} srcSet={p.srcSet} alt={p.caption || p.category || title} sizes="(max-width: 760px) 33vw, 300px" />
                  {(p.caption || p.category) && (
                    <figcaption className={s.tileCap}>
                      {p.caption}
                      {p.category && <span>#{p.category.toLowerCase().replace(/\s+/g, '')}</span>}
                    </figcaption>
                  )}
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
                  <article className={`${s.pack} ${pack.featured ? s.packFeatured : ''}`}>
                    <header className={s.packTop}>
                      <span className={s.avatar} aria-hidden="true">
                        {initials}
                      </span>
                      <span className={s.packName}>{pack.name}</span>
                      {pack.featured && <span className={s.packBadge}>{L.popular}</span>}
                    </header>
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

        {/* ---- 4. about: a profile header ---- */}
        {content.about.text && (
          <section id="about" className={`${s.section} ${s.wrap}`}>
            <div className={s.profile}>
              <span className={s.profileAvatar}>
                {portrait ? (
                  <Picture src={portrait.previewUrl} srcSet={portrait.srcSet} alt={brand} sizes="120px" />
                ) : (
                  <span aria-hidden="true">{initials}</span>
                )}
              </span>
              <div>
                <p className={s.profileName}>
                  {brand} {handle && <span>@{handle}</span>}
                </p>
                <p className={s.profileRole}>{card.role}</p>
                <p className={s.profileBio}>{content.about.text}</p>
              </div>
            </div>
          </section>
        )}

        {/* ---- 5. reviews as messages ---- */}
        {reviews.length > 0 && (
          <section id="reviews" className={`${s.section} ${s.wrap}`}>
            {head(L.testimonials, L.testimonials)}
            <div className={s.chat}>
              {reviews.map((r, i) => (
                <figure key={i} className={s.msg} style={{ '--i': i } as React.CSSProperties}>
                  <figcaption className={s.msgWho}>{r.names}</figcaption>
                  <blockquote className={s.bubble}>{r.text}</blockquote>
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
