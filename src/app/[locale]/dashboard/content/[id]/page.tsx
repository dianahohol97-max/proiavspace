import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { publishPostNow, setPostStatus } from '@/lib/actions/social'
import { getAdminPost } from '@/lib/social/posts'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ReelUpload } from './ReelUpload'

export const dynamic = 'force-dynamic'

const RUBRIC: Record<string, string> = { edu: 'Освіта', product: 'Продукт', brand: 'Бренд' }
const KIND: Record<string, string> = { carousel: 'Карусель', reel: 'Рілс', story: 'Сторіс', single: 'Пост' }
const CHANNELS: Record<string, string> = {
  carousel: 'Instagram · Pinterest · TikTok',
  reel: 'Instagram · TikTok',
  story: 'Instagram',
  single: 'Instagram',
}

/** Full preview of a post before approving — every slide / the reel script. */
export default async function ContentPreviewPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const post = await getAdminPost(params.id)
  if (!post) notFound()

  // «Затвердити (у чергу)» is the pre-approval step; «Опублікувати зараз» works
  // for anything not yet posted/archived (incl. already-approved queue items).
  const canApprove = post.status === 'draft' || post.status === 'ready'
  const publishable = ['draft', 'ready', 'approved', 'scheduled'].includes(post.status)
  // A reel needs its video uploaded before it can go out; everything else is ready.
  const canPublish = publishable && (post.kind !== 'reel' || !!post.media?.video)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/${locale}/dashboard/content`} className="text-sm text-muted hover:text-fg">
        ← Назад до контенту
      </Link>

      <h1 className="mt-4 font-brand text-2xl">{post.hook}</h1>
      <p className="mt-1 text-xs text-muted">
        {KIND[post.kind] ?? post.kind} · {RUBRIC[post.rubric] ?? post.rubric} ·{' '}
        {CHANNELS[post.kind] ?? 'Instagram'} · статус: {post.status}
      </p>

      {/* --- carousel: every slide --- */}
      {post.kind === 'carousel' && post.slides.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {post.slides.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`Слайд ${i + 1}`}
              className="w-full rounded-xl border border-line"
            />
          ))}
        </div>
      )}

      {/* --- reel: script + video prompt --- */}
      {post.kind === 'reel' && (
        <div className="mt-6 space-y-4">
          {post.video_prompt && (
            <div className="rounded-2xl border border-line p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Промт для відео · Gemini omni · 9:16
              </p>
              <p className="mt-1 text-sm text-fg">{post.video_prompt}</p>
            </div>
          )}
          {post.body?.scenes && (
            <ol className="space-y-2">
              {post.body.scenes.map((s, i) => (
                <li key={i} className="rounded-xl border border-line p-3 text-sm">
                  <span className="font-semibold text-fg">{i + 1}. {s.text}</span>
                  {s.broll && <span className="mt-0.5 block text-xs text-muted">🎬 {s.broll}</span>}
                </li>
              ))}
            </ol>
          )}

          {/* uploaded video preview + uploader */}
          {post.media?.video && (
            <video
              src={post.media.video}
              controls
              className="w-full max-w-xs rounded-xl border border-line"
            />
          )}
          <ReelUpload postId={post.id} />
        </div>
      )}

      {/* --- caption + hashtags --- */}
      <div className="mt-6 rounded-2xl bg-bg p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Підпис</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{post.resolvedCaption || '—'}</p>
        {post.resolvedHashtags && (
          <p className="mt-3 text-sm text-accent">{post.resolvedHashtags}</p>
        )}
      </div>

      {/* --- actions --- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canPublish && (
          <form action={publishPostNow.bind(null, locale, post.id)}>
            <button className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white">
              Опублікувати зараз
            </button>
          </form>
        )}
        {canApprove && (
          <form action={setPostStatus.bind(null, locale, post.id, 'approved')}>
            <button className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-fg hover:bg-bg">
              Затвердити (у чергу)
            </button>
          </form>
        )}
        <form action={setPostStatus.bind(null, locale, post.id, 'archived')}>
          <button className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-muted hover:text-fg">
            У беклог
          </button>
        </form>
      </div>
      {canPublish && (
        <p className="mt-2 text-xs text-muted">
          «Опублікувати зараз» одразу запускає постинг через Make.
          {canApprove && ' «Затвердити» ставить у чергу — Make опублікує за розкладом.'}
        </p>
      )}
    </main>
  )
}
