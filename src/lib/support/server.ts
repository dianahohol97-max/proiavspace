import { sendEmail } from '@/lib/email'
import { getDictionary } from '@/lib/i18n'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { reportServerError } from '@/lib/sentry/report'
import { getStorage } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SUPPORT_LINK_TTL_SECONDS } from './config'
import type { SupportCopy, SupportDeps, SupportSender, UploadDeps } from './handler'
import { supportLimiter } from './rate-limit'

/**
 * Real dependencies of the support routes. Signed in → the account is the
 * sender (email, user_id and plan come from the session, never the form);
 * otherwise it is the public contact form.
 */
export async function currentSender(): Promise<SupportSender> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user?.email) return { kind: 'public' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, site_plan')
    .eq('user_id', user.id)
    .maybeSingle<{ plan: string | null; site_plan: string | null }>()
  const plan = profile ? `галереї: ${profile.plan ?? '—'}, сайт: ${profile.site_plan ?? '—'}` : null
  return { kind: 'account', userId: user.id, email: user.email, plan }
}

export function supportLocale(value: unknown): Locale {
  return typeof value === 'string' && isLocale(value) ? value : 'uk'
}

export async function supportCopy(locale: Locale): Promise<SupportCopy> {
  const t = (await getDictionary(locale)).support
  return {
    copySubject: t.copySubject,
    copyGreeting: t.copyGreeting,
    copyLead: t.copyLead,
    copyTopic: t.copyTopic,
    copyMessage: t.copyMessage,
    copyAfter: t.copyAfter,
    topics: { bug: t.topicBug, question: t.topicQuestion, billing: t.topicBilling, idea: t.topicIdea },
  }
}

export function uploadDeps(): UploadDeps {
  return {
    limiter: supportLimiter,
    getUploadUrl: async (key, contentType, sizeBytes) =>
      (await getStorage().getUploadUrl({ key, contentType, sizeBytes })).url,
  }
}

export function submitDeps(): SupportDeps {
  const admin = createSupabaseAdminClient()
  return {
    limiter: supportLimiter,
    now: () => new Date(),
    countRecent: async (who, sinceIso) => {
      if (!admin) return null
      let query = admin
        .from('support_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso)
      query = 'userId' in who ? query.eq('user_id', who.userId) : query.eq('context->>ipHash', who.ipHash)
      const { count, error } = await query
      return error ? null : count ?? 0
    },
    head: (key) => getStorage().head(key),
    signReadUrl: (key) =>
      getStorage().getSignedReadUrl(key, { expiresInSeconds: SUPPORT_LINK_TTL_SECONDS, signFromNow: true }),
    sendEmail,
    insert: async (row) => {
      if (!admin) return { error: new Error('SUPABASE_SERVICE_ROLE_KEY not set') }
      const { error } = await admin.from('support_requests').insert(row)
      return { error: error ?? null }
    },
    reportError: async (error, context) => {
      console.error('support:', context, error)
      await reportServerError(error, context)
    },
  }
}
