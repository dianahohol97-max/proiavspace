'use client'

import dynamic from 'next/dynamic'

/** Shared visiting-card islands; their code loads only where a theme renders them. */
export const CardFilterIsland = dynamic(() => import('./CardFilterBar').then((m) => m.CardFilterBar))
export const CardNav = dynamic(() => import('../tysha/TyshaNav').then((m) => m.TyshaNav))
export const CardLeadForm = dynamic(() => import('../tysha/TyshaLeadForm').then((m) => m.TyshaLeadForm))
