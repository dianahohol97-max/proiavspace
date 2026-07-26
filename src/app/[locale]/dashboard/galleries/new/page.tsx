import { notFound, redirect } from 'next/navigation'
import { createGallery } from '@/lib/actions/galleries'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewGalleryPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const createWithLocale = createGallery.bind(null, locale)

  const inputClass =
    'border border-line bg-transparent px-4 py-3 outline-none focus:border-fg'
  const labelClass = 'mt-6 text-sm text-muted'

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-4xl">{dict.galleryForm.createTitle}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        {locale === 'uk'
          ? 'Це лише перший крок. Після створення відкриється конструктор галереї — там ви завантажите фото й налаштуєте дизайн: тему, акцент, колонки, шрифт і обкладинку.'
          : 'This is just the first step. After creating, the gallery builder opens — upload photos and tune the design: theme, accent, columns, font and cover.'}
      </p>

      <form action={createWithLocale} className="mt-10 flex flex-col">
        <label className={labelClass} htmlFor="title">
          {dict.galleryForm.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder={dict.galleryForm.titlePlaceholder}
          className={inputClass}
        />

        <label className={labelClass} htmlFor="description">
          {dict.galleryForm.descriptionLabel}
        </label>
        <textarea id="description" name="description" rows={3} className={inputClass} />

        <label className={labelClass} htmlFor="event_date">
          {dict.galleryForm.eventDateLabel}
        </label>
        <input id="event_date" name="event_date" type="date" className={inputClass} />

        <label className={labelClass} htmlFor="password">
          {dict.galleryForm.passwordLabel}
        </label>
        <input id="password" name="password" type="text" className={inputClass} />
        <p className="mt-2 text-xs text-muted">{dict.galleryForm.passwordHint}</p>

        <label className={labelClass} htmlFor="expires_at">
          {dict.galleryForm.expiresLabel}
        </label>
        <input id="expires_at" name="expires_at" type="date" className={inputClass} />

        <button
          type="submit"
          className="mt-10 border border-fg px-8 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
        >
          {dict.galleryForm.create}
        </button>
      </form>
    </main>
  )
}
