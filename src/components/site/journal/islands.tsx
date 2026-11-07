'use client'

import dynamic from 'next/dynamic'

/**
 * «Журнал»'s client islands behind `next/dynamic` (still server-rendered):
 * the shared nav, albums, «Усе портфоліо», enquiry form and pricing CTA, each
 * with the «Журнал» skin. The cover and the spread are pure CSS.
 */
export const JournalNav = dynamic(() => import('../tysha/TyshaNav').then((m) => m.TyshaNav))
export const JournalAlbums = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.TyshaAlbums))
export const JournalAllPortfolio = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.AllPortfolio))
export const JournalLeadForm = dynamic(() => import('../tysha/TyshaLeadForm').then((m) => m.TyshaLeadForm))
export const JournalPackCta = dynamic(() => import('../tysha/PackCta').then((m) => m.PackCta))
