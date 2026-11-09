import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { canSeeSites } from '@/lib/features/sites'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Sites and booking are shelved (src/lib/features/sites.ts): this section and
 * everything under it sends photographers back to the dashboard unless
 * NEXT_PUBLIC_SITES_ENABLED=1; the platform owner always gets in.
 */
export default async function SitesSectionLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { locale: string }
}) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!canSeeSites(user?.email)) redirect(`/${params.locale}/dashboard`)
  return <>{children}</>
}
