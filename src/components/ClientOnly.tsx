'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders children only after mount: the server HTML contains just the
 * fallback, so browser extensions/translators that rewrite the SSR DOM
 * before hydration have nothing to corrupt — React builds this subtree
 * from scratch in DOM it fully owns. Used on pages that repeatedly died
 * with hydration-reconciliation crashes (removeChild/appendChild) in
 * extension-heavy browsers. Children may come from a Server Component:
 * they ride the RSC payload and mount client-side unchanged.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <>{mounted ? children : fallback}</>
}
