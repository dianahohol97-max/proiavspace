import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { setPostStatus } from '@/lib/actions/social'
import { getAdminPosts, getSocialTopicStats, type SocialPost } from '@/lib/social/posts'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const RUBRIC: Record<string, string> = { edu: 'Освіта', product: 'Продукт', brand: 'Бренд' }
const KIND: Record<string, string> = {
  carousel: 'Карусель',
  reel: 'Рілс',
  story: 'Сторіс',
  single: 'Пост',
}
const CHANNELS: Record<string, string> = {
  carousel: 'Instagram · Pinterest · TikTok',
  reel: 'Instagram · TikTok',
  story: 'Instagram',
  single: 'Instagram',
}

function PostRow({ post, locale }: { post: SocialPost; locale: Locale }) {
  const cover = post.media?.cover
  const canApprove = post.status === 'draft' || post.status === 'ready'
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="h-20 w-16 flex-none overflow-hidden rounded-lg bg-bg">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
            {post.kind === 'reel' ? '🎬' : '—'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fg">{post.hook}</p>
        <p className="mt-0.5 text-xs text-muted">
          {KIND[post.kind] ?? post.kind} · {RUBRIC[post.rubric] ?? post.rubric} ·{' '}
          {CHANNELS[post.kind] ?? 'Instagram'}
        </p>
        {post.status === 'needs_video' && post.video_prompt && (
          <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-xs text-muted">
            <b>Промт для відео (Gemini omni, 9:16):</b> {post.video_prompt}
          </p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-2">
        {canApprove ? (
          <form action={setPostStatus.bind(null, locale, post.id, 'approved')}>
            <button className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white">
              Затвердити
            </button>
          </form>
        ) : post.status === 'approved' ? (
          <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            Затверджено
          </span>
        ) : post.status === 'posted' ? (
          <span className="rounded-full bg-fg/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-fg">
            Опубліковано
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  title,
  posts,
  locale,
  empty,
}: {
  title: string
  posts: SocialPost[]
  locale: Locale
  empty?: string
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-brand text-xl">
        {title} · {posts.length}
      </h2>
      {posts.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? 'Порожньо.'}</p>
      ) : (
        <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {posts.map((p) => (
            <PostRow key={p.id} post={p} locale={locale} />
          ))}
        </div>
      )}
    </section>
  )
}

/** Founder-only social content pipeline: review, approve, and Make publishes. */
export default async function ContentAdminPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const [posts, topics] = await Promise.all([getAdminPosts(), getSocialTopicStats()])
  const needsVideo = posts.filter((p) => p.status === 'needs_video')
  const review = posts.filter((p) => p.status === 'draft' || p.status === 'ready')
  const approved = posts.filter((p) => p.status === 'approved' || p.status === 'scheduled')
  const posted = posts.filter((p) => p.status === 'posted')

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-brand text-3xl">Контент</h1>
      <p className="mt-2 text-sm text-muted">
        Каруселі та рілси. Переглянь, за потреби зніми відео за промтом і тисни «Затвердити» —
        Make публікує у канали автоматично.
      </p>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <span className="rounded-full border border-line px-4 py-1.5">
          Черга тем: <b>{topics.todo}</b> у роботі · {topics.done} готово
        </span>
        <span className="rounded-full border border-line px-4 py-1.5">
          Опубліковано: <b>{posted.length}</b>
        </span>
      </div>

      <Section
        title="Потрібне відео"
        posts={needsVideo}
        locale={locale}
        empty="Немає рілсів, що чекають відео."
      />
      <Section
        title="На затвердження"
        posts={review}
        locale={locale}
        empty="Немає чернеток на перегляд."
      />
      <Section
        title="Затверджено (у черзі на постинг)"
        posts={approved}
        locale={locale}
        empty="Нічого не затверджено."
      />
      <Section title="Опубліковано" posts={posted} locale={locale} empty="Ще нічого не опубліковано." />
    </main>
  )
}
