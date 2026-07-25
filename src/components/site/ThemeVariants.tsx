import type { SiteContent } from '@/lib/site/content'
import { LeadForm, type LeadFormLabels } from './LeadForm'
import { SiteLangSwitch } from './SiteLangSwitch'
import {
  groupPortfolio,
  type BookingNav,
  type LangSwitch,
  type PortfolioItem,
  type SiteLabels,
} from './SiteRenderer'
import s from './SiteThemes.module.css'

export interface ThemeProps {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  /** Present only when the booking section is on: a nav link to `#booking`. */
  bookingNav?: BookingNav
}

function bg(url: string | null | undefined): React.CSSProperties | undefined {
  return url ? { backgroundImage: `url("${url}")` } : undefined
}

function Lang({ langSwitch }: { langSwitch?: LangSwitch }) {
  if (!langSwitch) return null
  return (
    <span className={s.tLang}>
      <SiteLangSwitch langSwitch={langSwitch} />
    </span>
  )
}

/** Shared, lightly-styled pricing + contact used by the simpler variants. */
function Tail({ content, labels, leadForm }: ThemeProps) {
  return (
    <>
      {content.pricing.items.length > 0 && (
        <section
          id="pricing"
          style={{
            marginTop: 48,
            borderTop: '1px solid var(--site-line)',
            paddingTop: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 24,
          }}
        >
          {content.pricing.items.map((item) => (
            <div key={item.name}>
              <h3
                style={{
                  fontFamily: 'var(--site-font-display)',
                  fontSize: 18,
                  margin: '0 0 6px',
                }}
              >
                {item.name}
              </h3>
              {item.price && <p style={{ margin: '0 0 8px', fontSize: 14 }}>{item.price}</p>}
              {item.includes.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    fontSize: 13,
                    color: 'var(--site-muted)',
                    lineHeight: 1.8,
                  }}
                >
                  {item.includes.map((line) => (
                    <li key={line}>— {line}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <section
        id="contact"
        style={{
          marginTop: 48,
          borderTop: '1px solid var(--site-line)',
          paddingTop: 28,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 28px',
          alignItems: 'baseline',
          fontSize: 14,
        }}
      >
        {content.contact.email && (
          <a href={`mailto:${content.contact.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {content.contact.email}
          </a>
        )}
        {content.contact.phone && (
          <a href={`tel:${content.contact.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {content.contact.phone}
          </a>
        )}
        {content.contact.instagram && (
          <a
            href={`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--site-accent)', textDecoration: 'none' }}
          >
            @{content.contact.instagram.replace(/^@/, '')}
          </a>
        )}
        {content.contact.bookingUrl && (
          <a
            href={content.contact.bookingUrl}
            style={{
              marginLeft: 'auto',
              border: '1px solid var(--site-fg)',
              padding: '11px 26px',
              fontFamily: 'var(--site-font-label)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'inherit',
              textDecoration: 'none',
              borderRadius: 'var(--site-radius)',
            }}
          >
            {labels.book}
          </a>
        )}
      </section>
      {leadForm && (
        <div style={{ marginTop: 8 }}>
          <LeadForm handle={leadForm.handle} labels={leadForm.labels} />
        </div>
      )}
    </>
  )
}

/* ===================== «Повітря» ===================== */
export function ThemeAir(props: ThemeProps) {
  const { content, displayName, portfolio, labels, langSwitch, bookingNav } = props
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)
  const hasCategories = groups.some((g) => g.category !== null)
  const heroPics = portfolio.slice(0, 3)

  return (
    <div className={s.tWrap}>
      <div className={s.tInner}>
        <nav className={s.airNav}>
          <span>{brand}</span>
          <span className="lnk">
            <a href="#portfolio">{labels.portfolio}</a>
            {content.about.text && <a href="#about">{labels.about}</a>}
            {content.pricing.items.length > 0 && <a href="#pricing">{labels.pricing}</a>}
            <a href="#contact">{labels.contacts}</a>
            {bookingNav && <a href={bookingNav.href}>{bookingNav.label}</a>}
            <Lang langSwitch={langSwitch} />
          </span>
        </nav>

        <header className={s.airHero}>
          <h1>{content.hero.title || brand}</h1>
          {content.hero.subtitle && <p className={s.airSub}>{content.hero.subtitle}</p>}
          {heroPics.length > 0 && (
            <div className={s.airGrid}>
              <div className={`${s.tImg} big`} style={bg(heroPics[0]?.previewUrl)} />
              <div className="col">
                {heroPics.slice(1, 3).map((p) => (
                  <div key={p.id} className={s.tImg} style={bg(p.previewUrl)} />
                ))}
              </div>
            </div>
          )}
          <div className={s.airCta}>
            <a className={s.airBtn} href={content.contact.bookingUrl || '#contact'}>
              {labels.book}
            </a>
          </div>
        </header>

        {portfolio.length > 3 && (
          <div id="portfolio" style={{ marginTop: 40 }}>
            {groups.map((group) => (
              <section key={group.category ?? '_'}>
                {hasCategories && <h2 className={s.tCatHead}>{group.category ?? labels.portfolio}</h2>}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 18,
                  }}
                >
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={s.tImg}
                      style={{ aspectRatio: '4 / 5', ...bg(item.previewUrl) }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {content.about.text && (
          <p id="about" className={s.airQuote}>
            {content.about.text}
            {brand && <small>{brand}</small>}
          </p>
        )}
        <Tail {...props} />
      </div>
    </div>
  )
}

/* ===================== «Плівка» ===================== */
export function ThemeFilm(props: ThemeProps) {
  const { content, displayName, portfolio, labels, langSwitch, bookingNav } = props
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)
  const hasCategories = groups.some((g) => g.category !== null)
  const stack = portfolio.slice(0, 2)
  const rest = portfolio.slice(2)

  return (
    <div className={s.tWrap}>
      <div className={s.tInner}>
        <nav className={s.filmNav}>
          <span className={s.filmMono}>{brand}</span>
          <span className={s.filmMono}>
            {content.hero.subtitle}
            {bookingNav && <> · <a href={bookingNav.href}>{bookingNav.label}</a></>}
            {langSwitch && <> · <Lang langSwitch={langSwitch} /></>}
          </span>
        </nav>

        <header className={s.filmHero}>
          <div>
            <h1>{content.hero.title || brand}</h1>
            {content.about.text && <p>{content.about.text}</p>}
            {content.contact.bookingUrl && (
              <a className={s.filmBtn} href={content.contact.bookingUrl}>
                {labels.book}
              </a>
            )}
          </div>
          {stack.length > 0 && (
            <div className={s.filmStack}>
              {stack.map((p, i) => (
                <figure key={p.id} className={s.filmShot}>
                  <div className={s.tImg} style={bg(p.previewUrl)} />
                  <figcaption className={`${s.filmMono} ${s.filmShotCap}`}>
                    {p.caption?.trim() || `кадр ${String(i + 1).padStart(2, '0')}`}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </header>

        {rest.length > 0 && (
          <div id="portfolio" className={s.filmStrip}>
            {groups.map((group) => {
              const items = group.items.filter((it) => rest.some((r) => r.id === it.id))
              if (items.length === 0) return null
              return (
                <section key={group.category ?? '_'} style={{ marginBottom: 20 }}>
                  <span className={s.filmMono}>{group.category ?? labels.portfolio}</span>
                  <div className={s.filmRow}>
                    {items.map((item, i) => (
                      <figure key={item.id}>
                        <div className={s.tImg} style={bg(item.previewUrl)} />
                        <figcaption className={s.filmMono}>
                          <span>{item.caption?.trim() || (group.category ?? labels.portfolio)}</span>
                          <em>{String(i + 1).padStart(2, '0')}</em>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <Tail {...props} />
      </div>
    </div>
  )
}

/* ===================== «Журнал» ===================== */
export function ThemeJournal(props: ThemeProps) {
  const { content, displayName, portfolio, labels, langSwitch, bookingNav } = props
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)

  return (
    <div className={s.tWrap}>
      <div className={s.tInner}>
        <nav className={s.jrNav}>
          <span className={s.jrBrand}>{brand}</span>
          <span className="meta">
            {labels.portfolio} · {labels.contacts}
            {bookingNav && <> · <a href={bookingNav.href}>{bookingNav.label}</a></>}
            {langSwitch && <> · <Lang langSwitch={langSwitch} /></>}
          </span>
        </nav>

        <div className={s.jrBody}>
          <aside className={s.jrSide}>
            {groups.map((group, i) => (
              <a key={group.category ?? '_'} href="#portfolio" className={i === 0 ? 'on' : undefined}>
                {group.category ?? labels.portfolio}
              </a>
            ))}
          </aside>
          <div id="portfolio">
            <p className={s.jrEyebrow}>{content.hero.subtitle || labels.portfolio}</p>
            <h1 className={s.jrH1}>{content.hero.title || brand}</h1>
            {content.about.text && <p className={s.jrIntro}>{content.about.text}</p>}
            {groups.map((group, gi) => {
              const credits = group.items.filter((it) => it.caption?.trim())
              const prev = groups[gi - 1]
              const next = groups[gi + 1]
              const showPager = groups.length > 1 && (group.category !== null || gi > 0)
              const name = (g: (typeof groups)[number]) => g.category ?? labels.portfolio
              return (
                <section id={`jr-${gi}`} key={group.category ?? '_'} style={{ marginBottom: 28, scrollMarginTop: 24 }}>
                  {group.category && <p className={s.jrEyebrow}>{group.category}</p>}
                  {credits.length > 0 && (
                    <p className={s.jrCredits}>
                      {credits.map((it, i) => (
                        <span key={it.id}>
                          {i > 0 && ' / '}
                          <u>{it.caption!.trim()}</u>
                        </span>
                      ))}
                    </p>
                  )}
                  <div className={s.jrCollage}>
                    {group.items.map((item) => (
                      <figure key={item.id}>
                        <div className={s.tImg} style={bg(item.previewUrl)} />
                      </figure>
                    ))}
                  </div>
                  {showPager && (
                    <div className={s.jrPager}>
                      {prev ? <a href={`#jr-${gi - 1}`}>← {name(prev)}</a> : <span />}
                      {next ? <a href={`#jr-${gi + 1}`}>{name(next)} →</a> : <span />}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
        <Tail {...props} />
      </div>
    </div>
  )
}

/* ===================== «Архів» ===================== */
export function ThemeArchive(props: ThemeProps) {
  const { content, displayName, portfolio, labels, langSwitch, bookingNav } = props
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)
  const hasCategories = groups.some((g) => g.category !== null)

  return (
    <div className={`${s.tWrap} ${s.ar}`}>
      <div className={s.arCanvas}>
        <div className={s.arTop}>
          <span className={s.arBrand}>{brand}</span>
          <div>
            <h5>{labels.portfolio}</h5>
            <ul>
              {groups.slice(0, 4).map((group) => (
                <li key={group.category ?? '_'}>{group.category ?? labels.portfolio}</li>
              ))}
            </ul>
          </div>
          <div>
            <h5>{labels.contacts}</h5>
            <ul>
              {content.contact.email && (
                <li>
                  <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
                </li>
              )}
              {content.contact.instagram && <li>@{content.contact.instagram.replace(/^@/, '')}</li>}
              {bookingNav && (
                <li>
                  <a href={bookingNav.href}>{bookingNav.label}</a>
                </li>
              )}
              {langSwitch && (
                <li>
                  <Lang langSwitch={langSwitch} />
                </li>
              )}
            </ul>
          </div>
        </div>
        <p className={s.arMeta}>
          {content.hero.title || brand}
          {content.hero.subtitle ? ` · ${content.hero.subtitle}` : ''}
          {content.about.text ? `\n${content.about.text}` : ''}
        </p>

        <div id="portfolio">
          {groups.map((group) => (
            <section key={group.category ?? '_'}>
              {hasCategories && <h2 className={s.tCatHead}>{group.category ?? labels.portfolio}</h2>}
              <div className={s.arGrid}>
                {group.items.map((item, index) => (
                  <figure key={item.id}>
                    <div className={s.tImg} style={bg(item.previewUrl)} />
                    <figcaption>
                      <span className="no">{String(index + 1).padStart(3, '0')}</span>
                      {item.caption || group.category || labels.portfolio}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
        <Tail {...props} />
      </div>
    </div>
  )
}

/* ===================== «Продакшн» ===================== */
export function ThemeProduction(props: ThemeProps) {
  const { content, displayName, portfolio, labels, langSwitch, bookingNav } = props
  const brand = displayName ?? ''
  const groups = groupPortfolio(portfolio)
  const categories = groups.map((g) => g.category).filter((c): c is string => !!c)

  return (
    <div className={s.tWrap}>
      <div className={s.tInner}>
        <nav className={s.prNav}>
          <span>{brand}</span>
          <span>
            <a href="#portfolio">{labels.portfolio}</a>
            {'  '}
            <a href="#contact">{labels.contacts}</a>
            {bookingNav && <>{'  '}<a href={bookingNav.href}>{bookingNav.label}</a></>}
            {langSwitch && <> <Lang langSwitch={langSwitch} /></>}
          </span>
        </nav>

        <h1 className={s.prHero}>{content.hero.title || brand}</h1>
        {content.hero.subtitle && <p className={s.prHeroSub}>{content.hero.subtitle}</p>}

        {portfolio.length > 0 && (
          <div id="portfolio" className={s.prRows}>
            {groups.flatMap((group) =>
              group.items.map((item, index) => (
                <div key={item.id} className={s.prRow}>
                  <div className={s.tImg} style={bg(item.previewUrl)} />
                  <span className="ttl">{item.caption || group.category || labels.portfolio}</span>
                  <span className="yr">{String(index + 1).padStart(3, '0')}</span>
                </div>
              ))
            )}
          </div>
        )}

        {(content.about.text ||
          content.contact.email ||
          content.contact.phone ||
          content.pricing.items.length > 0 ||
          content.contact.instagram) && (
          <div id="contact" className={s.prPanel}>
            {content.about.text && <p>{content.about.text}</p>}
            <div className="cols">
              {(content.contact.email || content.contact.phone) && (
                <div>
                  <h5>{labels.contacts}</h5>
                  <ul>
                    {content.contact.email && (
                      <li>
                        <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
                      </li>
                    )}
                    {content.contact.phone && (
                      <li>
                        <a href={`tel:${content.contact.phone}`}>{content.contact.phone}</a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {content.pricing.items.length > 0 && (
                <div>
                  <h5>{labels.pricing}</h5>
                  <ul>
                    {content.pricing.items.map((item) => (
                      <li key={item.name}>{item.price ? `${item.name} — ${item.price}` : item.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {categories.length > 0 && (
                <div>
                  <h5>{labels.portfolio}</h5>
                  <ul>
                    {categories.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(content.contact.instagram || content.contact.bookingUrl) && (
                <div>
                  <h5>Instagram</h5>
                  <ul>
                    {content.contact.instagram && (
                      <li>
                        <a
                          href={`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          @{content.contact.instagram.replace(/^@/, '')}
                        </a>
                      </li>
                    )}
                    {content.contact.bookingUrl && (
                      <li>
                        <a href={content.contact.bookingUrl}>{labels.book}</a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {props.leadForm && (
          <div style={{ marginTop: 32 }}>
            <LeadForm handle={props.leadForm.handle} labels={props.leadForm.labels} />
          </div>
        )}
      </div>
    </div>
  )
}
