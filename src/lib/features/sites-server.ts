import { isAdminEmail } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sitesEnabled } from './sites'

/**
 * The same for whoever is viewing a public page or calling an API: the flag,
 * or the owner's own session. Anonymous visitors (and a broken/absent auth
 * backend) count as «not the owner».
 */
export async function viewerCanSeeSites(): Promise<boolean> {
  if (sitesEnabled()) return true
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return isAdminEmail(user?.email)
  } catch {
    return false
  }
}
