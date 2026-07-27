import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { updateDisplayName } from '@/lib/actions/profile'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoUploader } from '@/components/LogoUploader'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { saved?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const justSaved = searchParams.saved === '1'

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single<Profile>()
  if (!profile) notFound()

  const logoUrl = profile.logo_url
    ? await getStorage().getSignedReadUrl(profile.logo_url, { expiresInSeconds: 60 * 60 })
    : null

  const saveAction = updateDisplayName.bind(null, locale)

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>

      <h1 className="mt-6 font-display text-4xl">{dict.settings.title}</h1>

      <form action={saveAction} className="mt-10 flex flex-col">
        <label className="text-sm text-muted" htmlFor="display_name">
          {dict.settings.displayNameLabel}
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={profile.display_name ?? ''}
          className="mt-2 border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
        />
        <p className="mt-2 text-xs text-muted">{dict.settings.displayNameHint}</p>

        <label className="mt-6 text-sm text-muted" htmlFor="display_name_en">
          {locale === 'uk' ? 'Імʼя латиницею' : 'Name in Latin script'}
        </label>
        <input
          id="display_name_en"
          name="display_name_en"
          defaultValue={profile.display_name_en ?? ''}
          placeholder="Diana Hohol"
          className="mt-2 border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
        />
        <p className="mt-2 text-xs text-muted">
          {locale === 'uk'
            ? 'Показується замість основного імені, коли клієнт відкриває галерею англійською.'
            : 'Shown instead of the main name when a client views the gallery in English.'}
        </p>

        <label className="mt-6 text-sm text-muted" htmlFor="contact_url">
          {locale === 'uk' ? 'Контакт для клієнтів' : 'Client contact link'}
        </label>
        <input
          id="contact_url"
          name="contact_url"
          defaultValue={profile.contact_url ?? ''}
          placeholder="instagram.com/proyav.space"
          className="mt-2 border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
        />
        <p className="mt-2 text-xs text-muted">
          {locale === 'uk'
            ? 'Одне посилання — Instagram, сайт, mailto: чи tel:. У галереї зʼявиться кнопка «Звʼязатися з фотографом».'
            : 'One link — Instagram, site, mailto: or tel:. The gallery gets a “Contact the photographer” button.'}
        </p>

        <label className="mt-6 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="watermark_enabled"
            defaultChecked={profile.watermark_enabled}
          />
          {dict.settings.watermarkLabel}
        </label>
        <p className="mt-1 text-xs text-muted">{dict.settings.watermarkHint}</p>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            className="self-start border border-fg px-8 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.settings.save}
          </button>
          {justSaved && (
            <span className="text-sm font-medium text-emerald-700">
              {locale === 'uk' ? '✓ Збережено' : '✓ Saved'}
            </span>
          )}
        </div>
      </form>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="text-sm text-muted">{dict.settings.logoLabel}</h2>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mt-4 max-h-16 w-auto" />
        )}
        <div className="mt-4">
          <LogoUploader
            locale={locale}
            buttonLabel={dict.settings.uploadLogo}
            errorLabel={dict.settings.uploadError}
          />
        </div>
        <p className="mt-2 max-w-md text-xs text-muted">{dict.settings.logoHint}</p>
      </section>
    </main>
  )
}
