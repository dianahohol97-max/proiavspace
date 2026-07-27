import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { getStorySets } from '@/lib/social/stories'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Founder-only «Сторіс»: ready-made story sets rendered by the content
 * factory. The founder previews frames and downloads them one by one (or all)
 * to publish as an Instagram highlight.
 */
export default async function StoriesPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const sets = await getStorySets()

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-brand text-3xl">Сторіс</h1>
      <p className="mt-2 text-sm text-muted">
        Готові набори сторіс із контент-фабрики (9:16). Натисни «Завантажити» під кадром — і
        залий у Instagram. Порядок кадрів = порядок публікації; перший кадр став обкладинкою
        highlight-а.
      </p>

      {sets.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          Наборів поки немає. Щойно фабрика опублікує нові — вони з&apos;являться тут.
        </p>
      ) : (
        sets.map((set) => (
          <section key={set.id} className="mt-10">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-brand text-xl">{set.title}</h2>
              <span className="text-xs text-muted">{set.frames.length} кадрів</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {set.frames.map((url, i) => (
                <figure key={url} className="group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${set.title} — кадр ${i + 1}`}
                    loading="lazy"
                    className="w-full rounded-xl border border-line"
                  />
                  <figcaption className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted">
                      {String(i).padStart(2, '0')}
                      {i === 0 ? ' · обкладинка' : ''}
                    </span>
                    <a
                      href={`/api/stories/download?u=${encodeURIComponent(url)}`}
                      className="font-bold text-accent hover:underline"
                    >
                      Завантажити ↓
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
