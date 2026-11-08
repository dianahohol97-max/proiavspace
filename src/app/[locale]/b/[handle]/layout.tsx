import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { sitesEnabled } from '@/lib/features/sites'
import { viewerCanSeeSites } from '@/lib/features/sites-server'

/**
 * Shelved until sites and booking ship (src/lib/features/sites.ts): 404 for
 * everyone unless NEXT_PUBLIC_SITES_ENABLED=1; the platform owner's own
 * session still opens it (to work on themes), never indexed meanwhile.
 */
export function generateMetadata(): Metadata {
  return sitesEnabled() ? {} : { robots: { index: false, follow: false } }
}

export default async function ShelvedSitesLayout({ children }: { children: ReactNode }) {
  if (!(await viewerCanSeeSites())) notFound()
  return <>{children}</>
}
