'use client'

import dynamic from 'next/dynamic'

/**
 * «Тиша»'s client islands behind `next/dynamic` (server-rendered as usual), so
 * their code — and `motion` — is only fetched on pages that render «Тиша»,
 * not on every site that merely bundles the theme. See ../motion/lazy.tsx.
 */
export const TyshaNav = dynamic(() => import('./TyshaNav').then((m) => m.TyshaNav))
export const TyshaHero = dynamic(() => import('./TyshaHero').then((m) => m.TyshaHero))
export const TyshaAlbums = dynamic(() => import('./TyshaAlbums').then((m) => m.TyshaAlbums))
export const TyshaLeadForm = dynamic(() => import('./TyshaLeadForm').then((m) => m.TyshaLeadForm))
export const PackCta = dynamic(() => import('./PackCta').then((m) => m.PackCta))
