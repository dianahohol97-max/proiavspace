import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createGalleryFromForm } from '@/lib/actions/galleries'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NewGalleryForm } from '@/components/dashboard/GalleryForms'

export const dynamic = 'force-dynamic'

/**
 * «Нова галерея» — one short form (name + shoot date). Password, access period
 * and design live in the gallery's own tabs; creating goes straight to the
 * upload tab, so the photographer never hunts for the next step.
 */
export default async function NewGalleryPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const form = dict.galleryForm
  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-14">
      <Link href={`/${locale}/dashboard`} className="inline-flex min-h-[44px] items-center text-sm font-bold text-muted no-underline hover:text-fg">
        ← {dict.galleryManage.back}
      </Link>
      <div className="mt-2 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-8">
        <h1 className="font-brand text-3xl">{form.createTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{form.createLede}</p>
        <div className="mt-6">
          <NewGalleryForm
            action={createGalleryFromForm.bind(null, locale)}
            labels={{
              titleLabel: form.titleLabel,
              titlePlaceholder: form.titlePlaceholder,
              eventDateLabel: form.eventDateLabel,
              eventDateHint: form.eventDateHint,
              create: form.createAndUpload,
              creating: form.creating,
              errorTitle: form.errorTitle,
              errorGeneric: form.errorGeneric,
            }}
          />
        </div>
      </div>
    </main>
  )
}
