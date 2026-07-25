import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { jsonLdScript } from '@/lib/jsonld'
import { getLandingCopy } from '@/lib/landing/copy'
import { GALLERY_PLANS, type GalleryPlanId } from '@/lib/plans'
import { LangPicker } from '@/components/LangPicker'
import { Logo } from '@/components/Logo'
import { AuthNav } from '@/components/landing/AuthNav'
import { Reveal } from '@/components/landing/Reveal'
import s from './landing.module.css'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** Structured data: product with real plan prices + the FAQ — rich results. */
function buildJsonLd(locale: string, t: ReturnType<typeof getLandingCopy>) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}/#org`,
        name: 'проЯв',
        url: BASE_URL,
        logo: `${BASE_URL}/icon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#site`,
        name: 'проЯв',
        url: BASE_URL,
        inLanguage: ['uk', 'en'],
        publisher: { '@id': `${BASE_URL}/#org` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'проЯв',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: `${BASE_URL}/${locale}`,
        description: t.hero.lede,
        offers: (Object.keys(GALLERY_PLANS) as GalleryPlanId[]).map((id) => ({
          '@type': 'Offer',
          name: t.pricing.plans[id].name,
          price: GALLERY_PLANS[id].priceUahMonth,
          priceCurrency: 'UAH',
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.faq.items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  }
}

export default function LandingPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const t = getLandingCopy(locale)
  const login = `/${locale}/login`
  const jsonLd = buildJsonLd(locale, t)

  const marqueeTiles = ['p01 t34', 'p08 t43', 'p07 t11', 'p14 t34', 'p15 t43', 'p16 t11', 'p12 t34', 'p03 t43']
  const tile = (spec: string, key: number) => {
    const [g, t_] = spec.split(' ')
    return <div key={key} className={`${s.ph} ${s[g]} ${s[t_]}`} />
  }

  return (
    <main className={s.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <div className={s.wrap}>
        {/* ---------- nav ---------- */}
        <nav className={s.nav}>
          <Link href={`/${locale}`} className="text-fg no-underline">
            <Logo />
          </Link>
          <span className={s.navLinks}>
            <a href="#galleries">{t.nav.galleries}</a>
            <a href="#pricing">{t.nav.pricing}</a>
            <Link href={`/${locale}/blog`}>{t.nav.blog}</Link>
            <AuthNav
              locale={locale}
              labels={{ signIn: t.nav.signIn, ctaShort: t.nav.ctaShort, dashboard: t.nav.dashboard }}
            />
            <LangPicker current={locale} />
          </span>
        </nav>

        {/* ---------- hero ---------- */}
        <header className={s.hero}>
          <div>
            <div className={s.chips}>
              {t.hero.chips.map((chip, index) => (
                <span key={chip} className={index === 0 ? s.chipOn : s.chip}>
                  {chip}
                </span>
              ))}
            </div>
            <h1 className={s.h1}>
              {t.hero.titleBefore}
              <em>{t.hero.titleAccent}</em>
              {t.hero.titleAfter}
            </h1>
            <p className={s.lede}>{t.hero.lede}</p>
            <div className={s.ctaRow}>
              <Link href={login} className={s.pillHot}>
                {t.hero.cta} <span>→</span>
              </Link>
              <span className={s.ctaNote}>{t.hero.ctaNote}</span>
            </div>
          </div>
          <div className={s.stage} aria-hidden="true">
            <div className={s.mockGallery}>
              <div className={s.mockGrid}>
                <div className={`${s.ph} ${s.p01}`} />
                <div className={`${s.ph} ${s.p05}`} />
                <div className={`${s.ph} ${s.p03}`} />
                <div className={`${s.ph} ${s.p11}`} />
              </div>
              <span className={s.heart}>♥</span>
            </div>
            <div className={s.statCard}>
              <span className={s.statNum}>
                {t.hero.statNumber}
                <i>+</i>
              </span>
              <p>{t.hero.statText}</p>
            </div>
            <div className={s.mockBooking}>
              <div className={s.slot}>
                <span>Сб, 14:00</span>
                <span>2 000 ₴</span>
              </div>
              <div className={s.slotOn}>
                <span>Сб, 17:00</span>
                <span>2 000 ₴</span>
              </div>
              <div className={s.pay}>{t.hero.slotPay}</div>
            </div>
            <div className={s.themeChip}>
              <div className={s.wm}>{t.hero.mockName}</div>
              <div className={s.hl}>{t.hero.mockTitle}</div>
              <div className={s.themeRow}>
                <div className={`${s.ph} ${s.p02}`} />
                <div className={`${s.ph} ${s.p13}`} />
                <div className={`${s.ph} ${s.p10}`} />
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* ---------- marquee ---------- */}
      <div className={s.stripZone} aria-hidden="true">
        <div className={s.marquee}>
          {marqueeTiles.map(tile)}
          {marqueeTiles.map((spec, index) => tile(spec, index + 100))}
        </div>
      </div>

      <div className={s.wrap}>
        {/* ---------- products ---------- */}
        <section className={s.products} id="products">
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{t.products.label}</span>
              <h2 className={s.h2}>
                {t.products.titleBefore}
                <span className={s.accentWord}>{t.products.titleAccent}</span>
              </h2>
              <p>{t.products.lede}</p>
            </div>
          </Reveal>
          <div className={s.prodGrid}>
            <Reveal>
              <div className={s.prod}>
                <span className={s.prodNo}>{t.products.items[0].no}</span>
                <div className={s.pGal}>
                  <div className={`${s.ph} ${s.p15}`} />
                  <div className={`${s.ph} ${s.p06}`} />
                  <div className={`${s.ph} ${s.p08}`} />
                  <div className={`${s.ph} ${s.p12}`} />
                </div>
                <h3>{t.products.items[0].title}</h3>
                <p>{t.products.items[0].text}</p>
                <p className={s.tag}>
                  <b>{t.products.items[0].tagStrong}</b>
                  {t.products.items[0].tagRest}
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className={`${s.prod} ${s.prodSoon}`}>
                <span className={s.prodNo}>{t.products.items[1].no}</span>
                <span className={s.soonBadge}>{t.products.soon}</span>
                <div className={s.pSite}>
                  <div className={s.wm}>{t.hero.mockName}</div>
                  <div className={s.hl}>{t.hero.mockTitle}</div>
                  <div className={s.themeRow}>
                    <div className={`${s.ph} ${s.p09}`} />
                    <div className={`${s.ph} ${s.p14}`} />
                    <div className={`${s.ph} ${s.p04}`} />
                  </div>
                </div>
                <h3>{t.products.items[1].title}</h3>
                <p>{t.products.items[1].text}</p>
                <p className={s.tag}>
                  <b>{t.products.items[1].tagStrong}</b>
                  {t.products.items[1].tagRest}
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className={s.prod}>
                <span className={s.prodNo}>{t.products.items[2].no}</span>
                <div className={s.pBook}>
                  <div className={s.slot}>
                    <span>Сб, 14:00 · 60 хв</span>
                    <span>2 000 ₴</span>
                  </div>
                  <div className={s.slotOn}>
                    <span>Сб, 17:00 · 60 хв</span>
                    <span>2 000 ₴</span>
                  </div>
                  <div className={s.ok}>✓</div>
                </div>
                <h3>{t.products.items[2].title}</h3>
                <p>{t.products.items[2].text}</p>
                <p className={s.tag}>
                  <b>{t.products.items[2].tagStrong}</b>
                  {t.products.items[2].tagRest}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- bento ---------- */}
        <section className={s.bento}>
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{t.bento.label}</span>
              <h2 className={s.h2}>
                {t.bento.titleBefore}
                <span className={s.accentWord}>{t.bento.titleAccent}</span>
              </h2>
            </div>
          </Reveal>
          <div className={s.bentoGrid}>
            <div className={s.bTall}>
              <span className={s.lbl}>{t.bento.cards.selection.label}</span>
              <h4>{t.bento.cards.selection.text}</h4>
            </div>
            <div className={s.b}>
              <div className={`${s.ph} ${s.p06} ${s.bPhoto}`} />
              <div className={s.over}>
                <span className={s.lbl}>{t.bento.cards.galleryPhoto}</span>
              </div>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.protection.label}</span>
              <h4>{t.bento.cards.protection.text}</h4>
            </div>
            <div className={s.bCoal}>
              <span className={s.lbl}>{t.bento.cards.archive.label}</span>
              <h4>{t.bento.cards.archive.text}</h4>
            </div>
            <div className={s.bHot}>
              <span className={s.lbl}>{t.bento.cards.payments.label}</span>
              <h4>{t.bento.cards.payments.text}</h4>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.stats.label}</span>
              <span className={s.big}>{t.bento.cards.stats.number}</span>
              <h4 className={s.bMutedText}>{t.bento.cards.stats.text}</h4>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.themes.label}</span>
              <h4>{t.bento.cards.themes.text}</h4>
              <div className={s.chipsMini}>
                {t.bento.cards.themes.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
            <div className={s.b}>
              <div className={`${s.ph} ${s.p11} ${s.bPhoto}`} />
              <div className={s.over}>
                <span className={s.lbl}>{t.bento.cards.previewPhoto}</span>
              </div>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.autoRelease.label}</span>
              <h4>{t.bento.cards.autoRelease.text}</h4>
            </div>
            <div className={s.bWide}>
              <span className={s.lbl}>{t.bento.cards.video.label}</span>
              <h4>{t.bento.cards.video.text}</h4>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.email.label}</span>
              <h4>{t.bento.cards.email.text}</h4>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- principles ---------- */}
      <section className={s.principles}>
        <div className={s.wrap}>
          <h2 className={s.huge} aria-hidden="true">
            {t.principles.huge}
          </h2>
          <Reveal>
            <div className={s.secHead}>
              <h2 className={s.h2}>{t.principles.title}</h2>
              <p>{t.principles.lede}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className={s.prGrid}>
              {t.principles.items.map((item) => (
                <div key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <div className={s.wrap}>
        {/* ---------- pricing ---------- */}
        <section className={s.pricing} id="pricing">
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{t.pricing.label}</span>
              <h2 className={s.h2}>
                {t.pricing.titleBefore}
                <span className={s.accentWord}>{t.pricing.titleAccent}</span>
              </h2>
              <p>{t.pricing.lede}</p>
            </div>
          </Reveal>
          <div id="galleries" className={`${s.plans} ${s.plansFour}`} style={{ scrollMarginTop: 90 }}>
            {(Object.keys(GALLERY_PLANS) as GalleryPlanId[]).map((id) => {
              const plan = GALLERY_PLANS[id]
              const copy = t.pricing.plans[id]
              const highlight = id === 'plus'
              return (
                <div key={id} className={highlight ? s.planHot : s.plan}>
                  {highlight && <span className={s.popular}>{t.pricing.popular}</span>}
                  <h3>{copy.name}</h3>
                  <p className={s.gb}>{t.pricing.storage(plan.storageGb)}</p>
                  <p className={s.price}>
                    {plan.priceUahMonth} ₴
                    <small> {plan.priceUahMonth === 0 ? t.pricing.freeLabel : t.pricing.perMonth}</small>
                  </p>
                  <p className={s.yr}>
                    {plan.priceUahMonth === 0
                      ? copy.note
                      : t.pricing.yearHint(String(plan.priceUahYear))}
                  </p>
                  <ul>
                    {copy.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link
                    href={login}
                    className={`${highlight ? s.pillHot : s.pillGhost} ${s.planCta}`}
                  >
                    {t.pricing.planCta} {copy.name} {highlight && <span>→</span>}
                  </Link>
                </div>
              )
            })}
          </div>

          <Reveal>
            <div id="sites" className={s.secHead} style={{ marginTop: 64, scrollMarginTop: 90 }}>
              <h2 className={s.h2}>
                {t.pricing.siteTitle} <span className={s.soonBadge}>{t.pricing.soonBadge}</span>
              </h2>
            </div>
          </Reveal>
          <Reveal>
            <div className={s.comingSoon}>
              <p>{t.pricing.siteComingSoon}</p>
              <Link href={login} className={s.pillGhost}>
                {t.hero.cta}
              </Link>
            </div>
          </Reveal>
          <p className={s.fineprint}>{t.pricing.fineprint}</p>
        </section>

        {/* ---------- referral ---------- */}
        <section className={s.referral}>
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{t.referral.label}</span>
              <h2 className={s.h2}>{t.referral.title}</h2>
              <p>{t.referral.lede}</p>
            </div>
          </Reveal>
          <ol className={s.refSteps}>
            {t.referral.steps.map((step, index) => (
              <li key={index}>
                <span className={s.refNo}>{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link href={login} className={s.pillHot}>
            {t.referral.cta} <span>→</span>
          </Link>
        </section>

        {/* ---------- faq ---------- */}
        <section className={s.faq}>
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{t.faq.label}</span>
              <h2 className={s.h2}>{t.faq.title}</h2>
            </div>
          </Reveal>
          <div className={s.faqList}>
            {t.faq.items.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* ---------- final ---------- */}
      <section className={s.final}>
        <span className={s.lbl}>{t.final.label}</span>
        <h2 className={s.finalH2}>
          {t.final.titleBefore}
          <span className={s.accentWord}>{t.final.titleAccent}</span>
        </h2>
        <Link href={login} className={s.pillHot}>
          {t.final.cta} <span>→</span>
        </Link>
        <div className={s.giant} aria-hidden="true">
          про<i>Я</i>в<i>.</i>
        </div>
      </section>

      <div className={s.wrap}>
        <footer className={s.footer}>
          <Logo size={17} textSize={13} />
          <span>{t.footer.tagline}</span>
          <span style={{ display: 'inline-flex', gap: 16, flexWrap: 'wrap' }}>
            <Link href={`/${locale}/blog`} style={{ color: 'inherit' }}>
              {t.footer.blog}
            </Link>
            <Link href={`/${locale}/oferta`} style={{ color: 'inherit' }}>
              {t.footer.terms}
            </Link>
            <Link href={`/${locale}/privacy`} style={{ color: 'inherit' }}>
              {t.footer.privacy}
            </Link>
          </span>
        </footer>
      </div>
    </main>
  )
}
