import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupportStatus } from '@/lib/actions/support'
import { SUPPORT_STATUSES, SUPPORT_TOPIC_UK, isSupportTopic, type SupportStatus } from '@/lib/support/config'

interface Row {
  id: string
  user_id: string | null
  email: string
  topic: string
  message: string
  context: Record<string, unknown> | null
  attachments: unknown[] | null
  status: SupportStatus
  created_at: string
}

const STATUS_UK: Record<SupportStatus, string> = { new: 'Нове', answered: 'Відповіли', closed: 'Закрите' }

/**
 * Admin block on /dashboard/stats: the latest support requests with their
 * status. Reads through the service role (the page has checked the
 * allowlist). Before migration 0068 the table is missing — the block says so
 * instead of breaking the page; letters still reach hello@proiav.space.
 */
export async function SupportRequestsAdmin({ admin, locale }: { admin: SupabaseClient; locale: string }) {
  const { data, error } = await admin
    .from('support_requests')
    .select('id, user_id, email, topic, message, context, attachments, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<Row[]>()

  const rows = data ?? []
  const open = rows.filter((r) => r.status === 'new').length

  return (
    <section className="mt-12" data-testid="support-admin">
      <h2 className="mb-4 font-brand text-xl">
        Звернення в підтримку{rows.length ? ` · нових ${open}` : ''}
      </h2>
      {error ? (
        <p className="text-sm text-muted">
          Таблиці звернень ще немає (міграція 0068). Звернення приходять листом на hello@proiav.space.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Звернень поки немає.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {rows.map((r, i) => {
            const url = typeof r.context?.url === 'string' ? r.context.url : null
            return (
              <article key={r.id} className={`flex flex-col gap-2 px-5 py-4 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      r.status === 'new' ? 'bg-accent text-white' : 'bg-bg text-muted'
                    }`}
                  >
                    {STATUS_UK[r.status] ?? r.status}
                  </span>
                  <span className="font-semibold">{isSupportTopic(r.topic) ? SUPPORT_TOPIC_UK[r.topic] : r.topic}</span>
                  <a href={`mailto:${r.email}`} className="text-accent underline">
                    {r.email}
                  </a>
                  <span className="text-muted">{r.user_id ? 'кабінет' : 'публічна форма'}</span>
                  <span className="ml-auto text-muted">
                    {new Date(r.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                  </span>
                </div>
                <p className="line-clamp-4 whitespace-pre-line text-fg">{r.message}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {url && <span className="max-w-full truncate">{url}</span>}
                  {(r.attachments?.length ?? 0) > 0 && <span>скриншотів: {r.attachments!.length}</span>}
                  <span className="ml-auto flex gap-1.5">
                    {SUPPORT_STATUSES.filter((s) => s !== r.status).map((s) => (
                      <form key={s} action={setSupportStatus.bind(null, locale, r.id, s)}>
                        <button
                          type="submit"
                          className="rounded-full border border-line px-3 py-1 font-semibold hover:border-fg hover:text-fg"
                        >
                          {STATUS_UK[s]}
                        </button>
                      </form>
                    ))}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
