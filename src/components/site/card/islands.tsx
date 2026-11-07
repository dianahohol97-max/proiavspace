'use client'

import dynamic from 'next/dynamic'

/** Shared visiting-card islands; their code loads only where a theme renders them. */
export const CardFilterIsland = dynamic(() => import('./CardFilterBar').then((m) => m.CardFilterBar))
