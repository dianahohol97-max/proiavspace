'use client'

import dynamic from 'next/dynamic'

/** «Портрет»'s island; its code loads only where the theme renders. */
export const BeforeAfterIsland = dynamic(() => import('./BeforeAfter').then((m) => m.BeforeAfter))
