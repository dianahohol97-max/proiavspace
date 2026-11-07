import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { getLandingCopy } from '@/lib/landing/copy'
import { getDictionary } from '@/lib/i18n'
import { formatDate, formatNumber, formatUah } from '@/lib/i18n/format'
import { GALLERY_PLANS, type GalleryPlanId } from '@/lib/plans'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { brandOgImage } from '@/lib/seo/pages'
import { faqNode, graph, softwareApplicationNode } from '@/lib/seo/structured-data'
import { JsonLd } from '@/components/seo/JsonLd'
import { LangPicker } from '@/components/LangPicker'
import { Logo } from '@/components/Logo'
import { AuthNav } from '@/components/landing/AuthNav'
import { primaryNav } from '@/lib/seo/nav'
import { GalleryShowcase } from '@/components/landing/GalleryShowcase'
import { showcaseLabels } from '@/lib/landing/showcase-labels'
import { Reveal } from '@/components/landing/Reveal'
import s from './landing.module.css'

/** Screenshot per «new in galleries» card, in the order of t.products.features. */
const FEATURE_SHOTS = ['culling', 'status', 'upload'] as const

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const { pages } = await getDictionary(locale)
  return buildMetadata({
    locale,
    path: '',
    languages: ['uk', 'en'],
    absoluteTitle: true,
    title: pages.homeTitle,
    description: pages.homeDescription,
    image: {
      url: brandOgImage(locale),
      alt: pages.ogAlt,
    },
  })
}

/** Structured data: Organization + WebSite + product with real plan prices + the FAQ. */
function buildJsonLd(locale: Locale, t: ReturnType<typeof getLandingCopy>) {
  return graph(
    softwareApplicationNode({
      description: t.hero.lede,
      url: `/${locale}`,
      planNames: {
        free: t.pricing.plans.free.name,
        basic: t.pricing.plans.basic.name,
        plus: t.pricing.plans.plus.name,
        pro: t.pricing.plans.pro.name,
      },
    }),
    faqNode(t.faq.items)
  )
}

export default async function LandingPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const t = getLandingCopy(locale)
  const dict = await getDictionary(locale)
  const { pages } = dict
  const login = `/${locale}/login`
  const jsonLd = buildJsonLd(locale, t)
  preloadBrandFonts(locale)

  // Screenshots exist in uk and en; other locales get the English landing copy.
  const shotLocale = locale === 'uk' ? 'uk' : 'en'

  const marqueeTiles = ['p01 t34', 'p08 t43', 'p07 t11', 'p14 t34', 'p15 t43', 'p16 t11', 'p12 t34', 'p03 t43']
  const tile = (spec: string, key: number) => {
    const [g, t_] = spec.split(' ')
    return <div key={key} className={`${s.ph} ${s[g]} ${s[t_]}`} />
  }

  return (
    <main className={s.page}>
      <JsonLd data={jsonLd} />
      <div className={s.wrap}>
        {/* ---------- nav ---------- */}
        <nav className={s.nav}>
          <Link href={`/${locale}`} className="text-fg no-underline">
            <Logo />
          </Link>
          <span className={s.navLinks}>
            {primaryNav(locale).map((link) =>
              link.href.includes('#') ? (
                <a key={link.href} href={link.href.slice(link.href.indexOf('#'))}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              )
            )}
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
            <p className={s.subtitle}>{t.hero.subtitle}</p>
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
            {/* The client's shoot status (see the «Статус зйомки» card below) */}
            <div className={s.mockStatus}>
              <div className={s.slot}>
                <span>{t.hero.status.steps[0]}</span>
                <span>✓</span>
              </div>
              <div className={s.slotOn}>
                <span>{t.hero.status.steps[1]}</span>
                <span>{t.hero.status.now}</span>
              </div>
              <div className={s.slot}>
                <span>{t.hero.status.steps[2]}</span>
                <span />
              </div>
              <div className={s.pay}>{t.hero.status.eta}</div>
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
          <div className={`${s.prodGrid} ${s.prodGridTwo}`}>
            <Reveal>
              <div className={s.prod}>
                <span className={s.prodNo}>{t.products.gallery.no}</span>
                <div className={s.pGal}>
                  <div className={`${s.ph} ${s.p15}`} />
                  <div className={`${s.ph} ${s.p06}`} />
                  <div className={`${s.ph} ${s.p08}`} />
                  <div className={`${s.ph} ${s.p12}`} />
                </div>
                <h3>{t.products.gallery.title}</h3>
                <p>{t.products.gallery.text}</p>
                <p className={s.tag}>
                  <b>{t.products.gallery.tagStrong}</b>
                  {t.products.gallery.tagRest}
                </p>
              </div>
            </Reveal>
            {t.products.features.map((feature, index) => (
              <Reveal key={feature.no}>
                <div className={s.prod}>
                  <span className={s.prodNo}>{feature.no}</span>
                  {/* Real screenshots of the interface (e2e demo pages), 960×640 WebP per language */}
                  <div className={s.pShot}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/landing/${FEATURE_SHOTS[index]}-${shotLocale}.webp`}
                      alt={feature.alt}
                      width={960}
                      height={640}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  <p className={s.tag}>
                    <b>{feature.tagStrong}</b>
                    {feature.tagRest}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- gallery design studio showcase ---------- */}
        {/* Header uses the landing's own secHead/h2 styles so typography
            matches the rest of the page; the interactive mock keeps the
            gallery's serif INSIDE the phone-style preview only. */}
        <section id="galleries" className={s.products} style={{ scrollMarginTop: 90 }}>
          <Reveal>
            <div className={s.secHead}>
              <span className={s.lbl}>{pages.studioLabel}</span>
              <h2 className={s.h2}>
                {pages.studioTitleBefore}
                <span className={s.accentWord}>
                  {pages.studioTitleAccent}
                </span>
              </h2>
              <p>
                {pages.studioLede}
              </p>
            </div>
          </Reveal>
          <GalleryShowcase locale={locale} labels={showcaseLabels(pages, dict.publicGallery, dict.designer)} ctaPrimary={s.pillHot} ctaGhost={s.pillGhost} />
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
              {/* A tiny «picked with hearts» strip, so the tall card is not empty */}
              <div className={s.bSel} aria-hidden="true">
                <div className={`${s.ph} ${s.p08}`}><i>♥</i></div>
                <div className={`${s.ph} ${s.p12}`} />
                <div className={`${s.ph} ${s.p15}`}><i>♥</i></div>
              </div>
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
              <span className={s.lbl}>{t.bento.cards.watermark.label}</span>
              <h4>{t.bento.cards.watermark.text}</h4>
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
                {/* The card is one 132px row tall — three chips fit, five were clipped */}
                {t.bento.cards.themes.chips.slice(0, 3).map((chip) => (
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
              <span className={s.lbl}>{t.bento.cards.slideshow.label}</span>
              <h4>{t.bento.cards.slideshow.text}</h4>
            </div>
            <div className={s.bWide}>
              <span className={s.lbl}>{t.bento.cards.video.label}</span>
              <h4>{t.bento.cards.video.text}</h4>
            </div>
            <div className={s.b}>
              <span className={s.lbl}>{t.bento.cards.languages.label}</span>
              <h4>{t.bento.cards.languages.text}</h4>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- principles ---------- */}
      <section className={s.principles}>
        <div className={s.wrap}>
          <p className={s.huge} aria-hidden="true">
            {t.principles.huge}
          </p>
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
          {/* #galleries now points at the design-studio showcase above */}
          <div className={`${s.plans} ${s.plansFour}`}>
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
                    {formatUah(plan.priceUahMonth, locale)}
                    <small> {plan.priceUahMonth === 0 ? t.pricing.freeLabel : t.pricing.perMonth}</small>
                  </p>
                  <p className={s.yr}>
                    {plan.priceUahMonth === 0
                      ? copy.note
                      : t.pricing.yearHint(formatNumber(plan.priceUahYear, locale))}
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
          <span>
            {t.footer.tagline} · © {new Date().getFullYear()} проЯв
          </span>
          <span style={{ display: 'inline-flex', gap: 16, flexWrap: 'wrap' }}>
            {locale === 'uk' && (
              <>
                <Link href="/uk/halerei" style={{ color: 'inherit' }}>
                  Онлайн-галерея
                </Link>
                <Link href="/uk/tsiny" style={{ color: 'inherit' }}>
                  Тарифи
                </Link>
              </>
            )}
            <Link href="/uk/blog" style={{ color: 'inherit' }}>
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
