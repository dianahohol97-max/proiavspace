'use client'

import dynamic from 'next/dynamic'

/**
 * «Опівніч»'s client islands behind `next/dynamic` (still server-rendered):
 * their code — and motion — downloads only on pages that render «Опівніч».
 * Shared pieces (nav, albums, form) are «Тиша»'s components with an
 * «Опівніч» skin.
 */
export const SpotlightFollow = dynamic(() => import('./Spotlight').then((m) => m.SpotlightFollow))
export const StripControls = dynamic(() => import('./StripControls').then((m) => m.StripControls))
export const MidnightNav = dynamic(() => import('../tysha/TyshaNav').then((m) => m.TyshaNav))
export const MidnightAlbums = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.TyshaAlbums))
export const MidnightAllPortfolio = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.AllPortfolio))
export const MidnightLeadForm = dynamic(() => import('../tysha/TyshaLeadForm').then((m) => m.TyshaLeadForm))
export const MidnightPackCta = dynamic(() => import('../tysha/PackCta').then((m) => m.PackCta))
