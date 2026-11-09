'use server'

import { revalidatePath } from 'next/cache'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSupportStatus } from '@/lib/support/config'

/** Admin: mark a support request new / answered / closed (service role, after the allowlist). */
export async function setSupportStatus(locale: string, id: string, status: string): Promise<void> {
  if (!isSupportStatus(status)) throw new Error('bad status')
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) throw new Error('forbidden')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('no service role')
  const { error } = await admin.from('support_requests').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/${locale}/dashboard/stats`)
}
