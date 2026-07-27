'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deletePortfolioAsset,
  reorderPortfolio,
  setPortfolioCaption,
  setPortfolioCategory,
  setPortfolioVisibility,
} from '@/lib/actions/portfolio'
import { generateImageVariants } from '@/lib/images/variants'
import type { SiteContent } from '@/lib/site/content'
import { THEME_CATALOG } from '@/lib/site/themes'
import {
  groupPortfolio,
  SiteRenderer,
  type PortfolioItem,
  type SiteLabels,
} from '@/components/site/SiteRenderer'
import type { LeadFormLabels } from '@/components/site/LeadForm'
import { locales, localeLabels, localeNames, type Locale } from '@/lib/i18n/config'

/** Languages a site can be offered in besides the Ukrainian base. */
const EXTRA_LOCALES = locales.filter((l): l is Locale => l !== 'uk')

export interface EditorLabels {
  publish: string
  handleLabel: string
  handleHint: string
  themeLabel: string
  themeNames: Record<string, string>
  heroLegend: string
  heroTitle: string
  heroSubtitle: string
  portfolioLegend: string
  portfolioHint: string
  portfolioUpload: string
  portfolioUploading: string
  portfolioManageHint: string
  portfolioDragHint: string
  portfolioHiddenBadge: string
  portfolioShow: string
  portfolioHide: string
  portfolioCategory: string
  portfolioCaption: string
  portfolioUploadTo: string
  portfolioCategoryEg: string
  portfolioUncategorized: string
  aboutLegend: string
  aboutPlaceholder: string
  pricingLegend: string
  priceName: string
  priceAmount: string
  priceIncludes: string
  contactLegend: string
  contactEmail: string
  contactPhone: string
  contactInstagram: string
  contactBooking: string
  contactBookingHint: string
  optionsLegend: string
  optLeadForm: string
  optLeadFormHint: string
  langLegend: string
  langHint: string
  translateLegend: string
  translateHint: string
  translateHeroTitle: string
  translateHeroSubtitle: string
  translateAbout: string
  save: string
  previewLabel: string
  delete: string
}

interface Pack {
  name: string
  price: string
  includes: string
}

const inputClass =
  'w-full border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg'

/**
 * Site editor with a LIVE preview: the right pane renders the same
 * SiteRenderer the public page uses, repainted on every keystroke and theme
 * switch. Inputs stay uncontrolled (named) so the plain <form action>
 * submit posts everything to the server action.
 */
export function SiteEditor({
  locale,
  action,
  initialHandle,
  initialCatalogValue,
  initialPublished,
  initialDomain,
  initialDomainStatus,
  content,
  displayName,
  logoUrl,
  portfolio,
  siteLabels,
  leadFormLabels,
  labels,
}: {
  locale: Locale
  action: (formData: FormData) => Promise<void>
  initialHandle: string
  initialCatalogValue: string
  initialPublished: boolean
  initialDomain: string
  initialDomainStatus: string
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  siteLabels: SiteLabels
  leadFormLabels: LeadFormLabels
  labels: EditorLabels
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [themeValue, setThemeValue] = useState(initialCatalogValue)
  const [heroTitle, setHeroTitle] = useState(content.hero.title)
  const [heroSubtitle, setHeroSubtitle] = useState(content.hero.subtitle)
  const [heroImageId, setHeroImageId] = useState(content.hero.imageId)
  const [albumCovers, setAlbumCovers] = useState<Record<string, string>>(content.albumCovers)

  function setAlbumCover(category: string | null | undefined, assetId: string) {
    const cat = category?.trim()
    if (!cat) return
    setAlbumCovers((prev) => ({ ...prev, [cat]: assetId }))
  }
  const [aboutText, setAboutText] = useState(content.about.text)
  const [packs, setPacks] = useState<Pack[]>(
    content.pricing.items.length > 0
      ? content.pricing.items.map((item) => ({
          name: item.name,
          price: item.price,
          includes: item.includes.join('\n'),
        }))
      : [{ name: '', price: '', includes: '' }]
  )
  const [contact, setContact] = useState(content.contact)
  const [languages, setLanguages] = useState<string[]>(content.settings.languages)
  const [leadForm, setLeadForm] = useState(content.settings.leadForm)
  const [booking, setBooking] = useState(content.settings.booking)

  function toggleLanguage(loc: string, on: boolean) {
    setLanguages((prev) =>
      on ? [...prev.filter((l) => l !== loc), loc] : prev.filter((l) => l !== loc)
    )
  }
  const [uploading, setUploading] = useState(0)
  // Category new uploads are dropped into (photographers add a shoot at a time).
  const [uploadCategory, setUploadCategory] = useState('')

  // Local, reorderable copy of the portfolio. Re-syncs when the server sends a
  // fresh list (after upload/delete refresh); local edits below are optimistic.
  const [items, setItems] = useState<PortfolioItem[]>(portfolio)
  useEffect(() => {
    setItems(portfolio)
  }, [portfolio])
  const dragIndex = useRef<number | null>(null)

  const visiblePortfolio = useMemo(
    () => items.filter((item) => item.visible !== false),
    [items]
  )

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    startTransition(async () => {
      await reorderPortfolio(locale, next.map((item) => item.id))
    })
  }

  function toggleVisible(id: string) {
    const target = items.find((item) => item.id === id)
    if (!target) return
    const nextVisible = target.visible === false
    setItems(items.map((item) => (item.id === id ? { ...item, visible: nextVisible } : item)))
    startTransition(async () => {
      await setPortfolioVisibility(locale, id, nextVisible)
    })
  }

  function updateCategory(id: string, category: string) {
    setItems(items.map((item) => (item.id === id ? { ...item, category } : item)))
  }
  function persistCategory(id: string, category: string) {
    startTransition(async () => {
      await setPortfolioCategory(locale, id, category)
    })
  }

  function updateCaption(id: string, caption: string) {
    setItems(items.map((item) => (item.id === id ? { ...item, caption } : item)))
  }
  function persistCaption(id: string, caption: string) {
    startTransition(async () => {
      await setPortfolioCaption(locale, id, caption)
    })
  }

  // Existing category names, for the quick-pick datalist.
  const categoryOptions = Array.from(
    new Set(
      items
        .map((item) => item.category?.trim())
        .filter((value): value is string => !!value)
    )
  )

  const catalogEntry =
    THEME_CATALOG.find((entry) => entry.value === themeValue) ?? THEME_CATALOG[0]

  const previewContent: SiteContent = useMemo(
    () => ({
      hero: { title: heroTitle, subtitle: heroSubtitle, imageId: heroImageId },
      albumCovers,
      about: { text: aboutText },
      pricing: {
        items: packs
          .map((pack) => ({
            name: pack.name.trim(),
            price: pack.price.trim(),
            includes: pack.includes.split('\n').map((s) => s.trim()).filter(Boolean),
          }))
          .filter((pack) => pack.name),
      },
      contact,
      translations: content.translations,
      settings: { languages, leadForm, booking },
    }),
    [heroTitle, heroSubtitle, heroImageId, albumCovers, aboutText, packs, contact, content.translations, languages, leadForm, booking]
  )

  function setPack(index: number, patch: Partial<Pack>) {
    setPacks((prev) => prev.map((pack, i) => (i === index ? { ...pack, ...patch } : pack)))
  }
  function addPack() {
    setPacks((prev) => [...prev, { name: '', price: '', includes: '' }])
  }
  function removePack(index: number) {
    setPacks((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  async function uploadPortfolio(files: File[]) {
    setUploading(files.length)
    for (const file of files) {
      try {
        const presign = async (variant?: string, blob?: Blob) => {
          const response = await fetch('/api/portfolio/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: variant ? `${variant}.jpg` : file.name,
              contentType: variant ? 'image/jpeg' : file.type,
              sizeBytes: blob ? blob.size : file.size,
              variant,
            }),
          })
          if (!response.ok) throw new Error(`presign ${response.status}`)
          return (await response.json()) as { uploadUrl: string; key: string }
        }

        const original = await presign()
        const put = await fetch(original.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!put.ok) throw new Error('put failed')

        const variants: Record<string, string> = {}
        // One decode yields renditions AND the pixel size.
        const rendered = await generateImageVariants(file)
        for (const rendition of rendered.variants) {
          const target = await presign(rendition.name, rendition.blob)
          const putVariant = await fetch(target.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: rendition.blob,
          })
          if (putVariant.ok) variants[rendition.name] = target.key
        }

        const { width, height } = rendered

        await fetch('/api/portfolio/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: original.key,
            contentType: file.type,
            sizeBytes: file.size,
            width,
            height,
            variants,
            category: uploadCategory.trim() || undefined,
          }),
        })
      } catch {
        /* one failed file must not stop the rest */
      }
      setUploading((n) => n - 1)
    }
    router.refresh()
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,420px)_1fr]">
      {/* ---------------- form ---------------- */}
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded border border-line p-5">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_published" defaultChecked={initialPublished} />
            {labels.publish}
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted" htmlFor="se-handle">{labels.handleLabel}</label>
            <input id="se-handle" name="handle" defaultValue={initialHandle} className={inputClass} />
            <p className="text-xs text-muted">{labels.handleHint}</p>
          </div>

          {/* ---------- custom domain ---------- */}
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold" htmlFor="se-domain">
                {locale === 'uk' ? 'Власний домен' : 'Custom domain'}
              </label>
              {initialDomain &&
                (initialDomainStatus === 'active' ? (
                  <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    {locale === 'uk' ? '● Підключено' : '● Connected'}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    {locale === 'uk' ? '● Очікує підключення' : '● Pending'}
                  </span>
                ))}
            </div>
            <input
              id="se-domain"
              name="custom_domain"
              defaultValue={initialDomain}
              placeholder="studio.com"
              className={inputClass}
            />
            <p className="text-xs leading-relaxed text-muted">
              {locale === 'uk'
                ? 'Щоб сайт відкривався на вашому домені, додайте в панелі свого реєстратора домену такі DNS-записи:'
                : 'To serve your site on your own domain, add these DNS records in your registrar:'}
            </p>
            <div className="rounded-md bg-fg/[0.04] p-3 font-mono text-xs leading-relaxed">
              <div>
                <span className="text-muted">CNAME</span>{'  '}www{'  →  '}cname.vercel-dns.com
              </div>
              <div>
                <span className="text-muted">A</span>{'      '}@{'    →  '}76.76.21.21
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {locale === 'uk'
                ? 'Далі впишіть домен вище й збережіть. Ми підключимо його до 24 годин — SSL-сертифікат випуститься автоматично. Статус зміниться на «Підключено».'
                : 'Then enter the domain above and save. We connect it within 24 hours — the SSL certificate is issued automatically. The status flips to “Connected”.'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted" htmlFor="se-theme">{labels.themeLabel}</label>
            <select
              id="se-theme"
              name="theme"
              value={themeValue}
              onChange={(event) => setThemeValue(event.target.value)}
              className={inputClass}
            >
              {THEME_CATALOG.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {labels.themeNames[entry.value] ?? entry.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-3 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.heroLegend}</legend>
          <input
            name="hero_title"
            defaultValue={content.hero.title}
            placeholder={labels.heroTitle}
            onChange={(event) => setHeroTitle(event.target.value)}
            className={inputClass}
          />
          <input
            name="hero_subtitle"
            defaultValue={content.hero.subtitle}
            placeholder={labels.heroSubtitle}
            onChange={(event) => setHeroSubtitle(event.target.value)}
            className={inputClass}
          />

          {/* Hero photo picker — choose which portfolio photo fills the hero. */}
          <input type="hidden" name="hero_image_id" value={heroImageId} />
          {/* Album covers map {category: assetId}, set via ★ on portfolio photos. */}
          <input type="hidden" name="album_covers" value={JSON.stringify(albumCovers)} />
          <p className="text-xs text-muted">
            {locale === 'uk' ? 'Фото для головного екрана' : 'Hero photo'}
          </p>
          {visiblePortfolio.length === 0 ? (
            <p className="text-xs text-muted">
              {locale === 'uk'
                ? 'Спершу завантажте фото в портфоліо нижче.'
                : 'Upload portfolio photos below first.'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setHeroImageId('')}
                className={`flex aspect-[4/5] items-center justify-center rounded border-2 p-1 text-center text-[10px] leading-tight ${
                  heroImageId === '' ? 'border-accent text-accent' : 'border-line text-muted'
                }`}
              >
                {locale === 'uk' ? 'Авто (перше)' : 'Auto (first)'}
              </button>
              {visiblePortfolio.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHeroImageId(item.id)}
                  aria-label={locale === 'uk' ? 'Обрати для hero' : 'Use as hero'}
                  className={`aspect-[4/5] rounded border-2 transition-colors ${
                    heroImageId === item.id ? 'border-accent' : 'border-transparent hover:border-line'
                  }`}
                  style={
                    item.previewUrl
                      ? { background: `center / cover no-repeat url("${item.previewUrl}")` }
                      : { background: 'var(--color-border)' }
                  }
                />
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.portfolioLegend}</legend>
          <p className="text-xs leading-relaxed text-muted">{labels.portfolioHint}</p>
          {/* Upload a shoot straight into a category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="se-upload-cat">
              {labels.portfolioUploadTo}
            </label>
            <input
              id="se-upload-cat"
              list="portfolio-cats"
              value={uploadCategory}
              placeholder={labels.portfolioCategoryEg}
              onChange={(event) => setUploadCategory(event.target.value)}
              className={inputClass}
            />
          </div>
          <label className="cursor-pointer rounded border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted transition-colors hover:border-accent hover:text-accent">
            {uploading > 0
              ? `${labels.portfolioUploading} ${uploading}…`
              : uploadCategory.trim()
                ? `${labels.portfolioUpload} → ${uploadCategory.trim()}`
                : labels.portfolioUpload}
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ''
                if (files.length > 0) void uploadPortfolio(files)
              }}
            />
          </label>
          {items.length > 0 && (
            <>
              <p className="text-xs leading-relaxed text-muted">{labels.portfolioManageHint}</p>
              {groupPortfolio(items).map((group) => (
                <div key={group.category ?? '_'} className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {group.category ?? labels.portfolioUncategorized} · {group.items.length}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const index = items.findIndex((i) => i.id === item.id)
                      const hidden = item.visible === false
                      return (
                        <div key={item.id} className="flex flex-col gap-1">
                          <span
                            draggable
                            onDragStart={() => {
                              dragIndex.current = index
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault()
                              if (dragIndex.current !== null) moveItem(dragIndex.current, index)
                              dragIndex.current = null
                            }}
                            className="group relative block cursor-grab active:cursor-grabbing"
                            title={labels.portfolioDragHint}
                          >
                            <span
                              className={`block aspect-[4/5] rounded bg-line transition-opacity ${
                                hidden ? 'opacity-30' : ''
                              }`}
                              style={
                                item.previewUrl
                                  ? {
                                      background: `center / cover no-repeat url("${item.previewUrl}")`,
                                    }
                                  : undefined
                              }
                            />
                            {hidden && (
                              <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-bold uppercase tracking-wide text-fg">
                                {labels.portfolioHiddenBadge}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={hidden ? labels.portfolioShow : labels.portfolioHide}
                              title={hidden ? labels.portfolioShow : labels.portfolioHide}
                              onClick={() => toggleVisible(item.id)}
                              disabled={pending}
                              className="absolute left-1 top-1 hidden h-6 w-6 place-items-center rounded-full bg-white text-xs shadow group-hover:grid"
                            >
                              {hidden ? '🚫' : '👁'}
                            </button>
                            {item.category?.trim() &&
                              (() => {
                                const isCover = albumCovers[item.category.trim()] === item.id
                                return (
                                  <button
                                    type="button"
                                    aria-label={locale === 'uk' ? 'Зробити обкладинкою' : 'Set as cover'}
                                    title={
                                      isCover
                                        ? locale === 'uk'
                                          ? 'Обкладинка альбому'
                                          : 'Album cover'
                                        : locale === 'uk'
                                          ? 'Зробити обкладинкою'
                                          : 'Set as cover'
                                    }
                                    onClick={() => setAlbumCover(item.category, item.id)}
                                    className={`absolute left-1 top-8 h-6 w-6 place-items-center rounded-full bg-white text-xs shadow ${
                                      isCover ? 'grid' : 'hidden group-hover:grid'
                                    }`}
                                  >
                                    {isCover ? '★' : '☆'}
                                  </button>
                                )
                              })()}
                            <button
                              type="button"
                              aria-label={labels.delete}
                              onClick={() => {
                                setItems((prev) => prev.filter((i) => i.id !== item.id))
                                startTransition(async () => {
                                  await deletePortfolioAsset(locale, item.id)
                                  router.refresh()
                                })
                              }}
                              disabled={pending}
                              className="absolute right-1 top-1 hidden h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold shadow group-hover:grid"
                            >
                              ✕
                            </button>
                          </span>
                          <input
                            list="portfolio-cats"
                            value={item.category ?? ''}
                            placeholder={labels.portfolioCategory}
                            onChange={(event) => updateCategory(item.id, event.target.value)}
                            onBlur={(event) => persistCategory(item.id, event.target.value)}
                            className="w-full border border-line bg-transparent px-2 py-1 text-[11px] outline-none focus:border-fg"
                          />
                          <input
                            value={item.caption ?? ''}
                            placeholder={labels.portfolioCaption}
                            onChange={(event) => updateCaption(item.id, event.target.value)}
                            onBlur={(event) => persistCaption(item.id, event.target.value)}
                            className="w-full border border-line bg-transparent px-2 py-1 text-[11px] outline-none focus:border-fg"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <datalist id="portfolio-cats">
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.aboutLegend}</legend>
          <textarea
            name="about_text"
            rows={5}
            defaultValue={content.about.text}
            placeholder={labels.aboutPlaceholder}
            onChange={(event) => setAboutText(event.target.value)}
            className={inputClass}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.optionsLegend}</legend>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="opt_lead_form"
                checked={leadForm}
                onChange={(event) => setLeadForm(event.target.checked)}
              />
              {labels.optLeadForm}
            </label>
            <p className="pl-7 text-xs text-muted">{labels.optLeadFormHint}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="opt_booking"
                checked={booking}
                onChange={(event) => setBooking(event.target.checked)}
              />
              {locale === 'uk' ? 'Бронювання на сайті' : 'Booking on the site'}
            </label>
            <p className="pl-7 text-xs text-muted">
              {locale === 'uk'
                ? 'Показати секцію бронювання, зв’язану з вашою сторінкою бронювання (вільні дати, оплата напряму). Керуйте датами у вкладці «Бронювання».'
                : 'Show a booking section wired to your own booking page (open dates, direct payment). Manage dates in the “Booking” tab.'}
            </p>
          </div>
        </fieldset>

        {/* ---- languages the site is offered in ---- */}
        <fieldset className="flex flex-col gap-3 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.langLegend}</legend>
          <p className="text-xs leading-relaxed text-muted">{labels.langHint}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked disabled />
              {localeNames.uk}
            </span>
            {EXTRA_LOCALES.map((loc) => (
              <label key={loc} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`lang_${loc}`}
                  checked={languages.includes(loc)}
                  onChange={(event) => toggleLanguage(loc, event.target.checked)}
                />
                {localeNames[loc]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* ---- per-language translations ---- */}
        {/* Blocks stay mounted for every language (hidden when off) so toggling a
            language never discards text already typed. */}
        <fieldset
          className={`flex-col gap-4 rounded border border-line p-5 ${
            languages.length > 0 ? 'flex' : 'hidden'
          }`}
        >
          <legend className="px-2 text-sm text-muted">{labels.translateLegend}</legend>
          <p className="text-xs leading-relaxed text-muted">{labels.translateHint}</p>
          {EXTRA_LOCALES.map((loc) => {
            const block = content.translations[loc]
            return (
              <div
                key={loc}
                className={`flex-col gap-2 rounded border border-line p-3 ${
                  languages.includes(loc) ? 'flex' : 'hidden'
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {localeNames[loc]} · {localeLabels[loc]}
                </p>
                <input
                  name={`t_${loc}_hero_title`}
                  defaultValue={block?.hero.title ?? ''}
                  placeholder={labels.translateHeroTitle}
                  className={inputClass}
                />
                <input
                  name={`t_${loc}_hero_subtitle`}
                  defaultValue={block?.hero.subtitle ?? ''}
                  placeholder={labels.translateHeroSubtitle}
                  className={inputClass}
                />
                <textarea
                  name={`t_${loc}_about_text`}
                  rows={4}
                  defaultValue={block?.about.text ?? ''}
                  placeholder={labels.translateAbout}
                  className={inputClass}
                />
              </div>
            )
          })}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.pricingLegend}</legend>
          {/* Unbounded number of packages; posted as JSON. */}
          <input
            type="hidden"
            name="pricing_json"
            value={JSON.stringify(
              packs
                .map((p) => ({
                  name: p.name.trim(),
                  price: p.price.trim(),
                  includes: p.includes.split('\n').map((s) => s.trim()).filter(Boolean),
                }))
                .filter((p) => p.name)
            )}
          />
          {packs.map((pack, index) => (
            <div key={index} className="relative flex flex-col gap-2 rounded border border-line p-3">
              {packs.length > 1 && (
                <button
                  type="button"
                  aria-label={locale === 'uk' ? 'Видалити пакет' : 'Remove package'}
                  title={locale === 'uk' ? 'Видалити пакет' : 'Remove package'}
                  onClick={() => removePack(index)}
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-line bg-bg text-xs hover:border-fg"
                >
                  ✕
                </button>
              )}
              <input
                value={pack.name}
                placeholder={labels.priceName}
                onChange={(event) => setPack(index, { name: event.target.value })}
                className={inputClass}
              />
              <input
                value={pack.price}
                placeholder={labels.priceAmount}
                onChange={(event) => setPack(index, { price: event.target.value })}
                className={inputClass}
              />
              <textarea
                rows={3}
                value={pack.includes}
                placeholder={labels.priceIncludes}
                onChange={(event) => setPack(index, { includes: event.target.value })}
                className={inputClass}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addPack}
            className="self-start rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-fg"
          >
            + {locale === 'uk' ? 'Додати пакет' : 'Add package'}
          </button>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-line p-5">
          <legend className="px-2 text-sm text-muted">{labels.contactLegend}</legend>
          <input
            name="contact_email"
            type="email"
            defaultValue={content.contact.email}
            placeholder={labels.contactEmail}
            onChange={(event) => setContact((c) => ({ ...c, email: event.target.value }))}
            className={inputClass}
          />
          <input
            name="contact_phone"
            defaultValue={content.contact.phone}
            placeholder={labels.contactPhone}
            onChange={(event) => setContact((c) => ({ ...c, phone: event.target.value }))}
            className={inputClass}
          />
          <input
            name="contact_instagram"
            defaultValue={content.contact.instagram}
            placeholder={labels.contactInstagram}
            onChange={(event) => setContact((c) => ({ ...c, instagram: event.target.value }))}
            className={inputClass}
          />
          <input
            name="contact_booking_url"
            defaultValue={content.contact.bookingUrl}
            placeholder={labels.contactBooking}
            onChange={(event) => setContact((c) => ({ ...c, bookingUrl: event.target.value }))}
            className={inputClass}
          />
          <p className="text-xs text-muted">{labels.contactBookingHint}</p>
        </fieldset>

        <button
          type="submit"
          className="self-start rounded-full border border-fg px-8 py-3 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
        >
          {labels.save}
        </button>
      </form>

      {/* ---------------- live preview ---------------- */}
      <div className="min-w-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
          {labels.previewLabel}
        </p>
        <div className="sticky top-4 overflow-hidden rounded-2xl border border-line shadow-sm">
          <div style={{ zoom: 0.62 }}>
            <SiteRenderer
              theme={catalogEntry.theme}
              mode={catalogEntry.mode}
              content={previewContent}
              displayName={displayName}
              logoUrl={logoUrl}
              portfolio={visiblePortfolio}
              labels={siteLabels}
              langSwitch={
                languages.length > 0
                  ? {
                      options: ['uk', ...languages].map((l) => ({
                        locale: l,
                        href: '#',
                        label: localeLabels[l as Locale] ?? l.toUpperCase(),
                        current: l === 'uk',
                      })),
                    }
                  : undefined
              }
              leadForm={leadForm ? { handle: null, labels: leadFormLabels } : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
