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
import { Logo } from '@/components/Logo'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { marketingHeaderLabels } from '@/components/marketing/SiteHeader'
import { HeroCategoryProvider, HeroGalleryTitle, HeroSlot, HeroStage, HeroTabs } from '@/components/landing/HeroCategories'
import { HERO_CATEGORIES } from '@/lib/landing/hero-categories'
import { primaryNav } from '@/lib/seo/nav'
import { GalleryShowcase } from '@/components/landing/GalleryShowcase'
import { showcaseLabels } from '@/lib/landing/showcase-labels'
import { Reveal } from '@/components/landing/Reveal'
import { LandingPhoto } from '@/components/landing/LandingPhoto'
import s from './landing.module.css'

/** Showcase frames shot in landscape (the rest are 2:3 portraits). */
const LANDSCAPE = new Set(['05', '16'])

/**
 * A photo tile: the `.ph` frame (radius, placeholder colour, grain) with a
 * responsive <picture> inside. Only the hero's lead frame gets `priority`;
 * the rest of the hero is eager, everything below the fold lazy.
 */
function Ph({
  n,
  sizes,
  className,
  priority,
  eager,
  children,
}: {
  n: string
  sizes: string
  className?: string
  priority?: boolean
  eager?: boolean
  children?: React.ReactNode
}) {
  const wide = LANDSCAPE.has(n)
  return (
    <div className={`${s.ph} ${className ?? ''}`}>
      <LandingPhoto
        name={`showcase-${n}`}
        kind="showcase"
        sizes={sizes}
        width={wide ? 3 : 2}
        height={wide ? 2 : 3}
        priority={priority}
        eager={eager}
      />
      {children}
    </div>
  )
}

/** Slot widths (CSS px) for `sizes`, per placement. */
const SIZES = {
  heroGrid: '(max-width: 520px) 28vw, (max-width: 880px) 140px, 160px',
  heroTheme: '(max-width: 520px) 14vw, 80px',
  marquee: '150px',
  pGal: '(max-width: 880px) 44vw, 270px',
  bentoPhoto: '(max-width: 880px) 48vw, 280px',
  bSel: '(max-width: 880px) 22vw, 90px',
}

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
  const headerLabels = await marketingHeaderLabels(locale)
  preloadBrandFonts(locale)

  // Screenshots exist in uk and en; other locales get the English landing copy.
  const shotLocale = locale === 'uk' ? 'uk' : 'en'

  const marqueeTiles = ['01 t34', '08 t43', '07 t11', '14 t34', '15 t43', '16 t11', '12 t34', '03 t43']
  const tile = (spec: string, key: number) => {
    const [n, t_] = spec.split(' ')
    return <Ph key={key} n={n} className={s[t_]} sizes={SIZES.marquee} />
  }

  return (
    <main className={s.page}>
      <JsonLd data={jsonLd} />
      {/* ---------- nav (sticky, shared with the inner pages) ---------- */}
      <MarketingHeader locale={locale} links={primaryNav(locale)} labels={headerLabels} onLanding />
      <div className={s.wrap}>
        {/* ---------- hero ---------- */}
        <HeroCategoryProvider className={s.hero}>
          <div>
            <HeroTabs labels={HERO_CATEGORIES.map((category) => t.hero.chips[category.index])} />
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
          <HeroStage className={s.stage}>
            <div className={s.mockGallery}>
              <div className={s.mockGrid}>
                {[0, 1, 2, 3].map((slot) => (
                  <HeroSlot
                    key={slot}
                    categories={HERO_CATEGORIES}
                    part="grid"
                    slot={slot}
                    sizes={SIZES.heroGrid}
                    priority={slot === 0}
                  />
                ))}
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
            {/* A client gallery's look: its title in the chosen font, a few
                frames, and the theme it uses. */}
            <div className={s.galleryCard} data-testid="hero-gallery-card">
              <HeroGalleryTitle
                className={s.gcTitle}
                titles={HERO_CATEGORIES.map((category) => t.hero.galleryTitles[category.index])}
              />
              <div className={s.themeRow}>
                {[0, 1, 2].map((slot) => (
                  <HeroSlot key={slot} categories={HERO_CATEGORIES} part="row" slot={slot} sizes={SIZES.heroTheme} />
                ))}
              </div>
              <div className={s.gcMeta}>
                {dict.designer.theme}: {dict.designer.themeCream} · {dict.designer.fontSerif}
              </div>
            </div>
          </HeroStage>
        </HeroCategoryProvider>
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
                  <Ph n="15" sizes={SIZES.pGal} />
                  <Ph n="06" sizes={SIZES.pGal} />
                  <Ph n="08" sizes={SIZES.pGal} />
                  <Ph n="12" sizes={SIZES.pGal} />
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
        <section id="galleries" className={s.products}>
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
        <section className={`${s.bento} ${s.lazyBento}`}>
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
                <Ph n="08" sizes={SIZES.bSel}><i>♥</i></Ph>
                <Ph n="12" sizes={SIZES.bSel} />
                <Ph n="15" sizes={SIZES.bSel}><i>♥</i></Ph>
              </div>
              <h4>{t.bento.cards.selection.text}</h4>
            </div>
            <div className={s.b}>
              <Ph n="06" className={s.bPhoto} sizes={SIZES.bentoPhoto} />
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
              <Ph n="11" className={s.bPhoto} sizes={SIZES.bentoPhoto} />
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
      <section className={`${s.principles} ${s.lazyPrinciples}`}>
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
        <section className={`${s.pricing} ${s.lazyPricing}`} id="pricing">
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
        <section className={`${s.referral} ${s.lazyReferral}`}>
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
        <section className={`${s.faq} ${s.lazyFaq}`}>
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
      <section className={`${s.final} ${s.lazyFinal}`}>
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

      <div className={`${s.wrap} ${s.lazyFoot}`}>
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
            <Link href={`/${locale}/contact`} style={{ color: 'inherit' }}>
              {t.footer.support}
            </Link>
          </span>
        </footer>
      </div>
    </main>
  )
}
