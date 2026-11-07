'use client'

import dynamic from 'next/dynamic'

/** «Повітря»'s client islands (server-rendered; code loads only where the theme renders). */
export const AirFloat = dynamic(() => import('./AirFloat').then((m) => m.AirFloat))
export const AirNav = dynamic(() => import('../tysha/TyshaNav').then((m) => m.TyshaNav))
export const AirAlbums = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.TyshaAlbums))
export const AirAllPortfolio = dynamic(() => import('../tysha/TyshaAlbums').then((m) => m.AllPortfolio))
export const AirLeadForm = dynamic(() => import('../tysha/TyshaLeadForm').then((m) => m.TyshaLeadForm))
export const AirPackCta = dynamic(() => import('../tysha/PackCta').then((m) => m.PackCta))
