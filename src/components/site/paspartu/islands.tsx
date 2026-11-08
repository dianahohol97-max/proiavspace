'use client'

import dynamic from 'next/dynamic'

/** «Паспарту» reuses the strip controls of «Опівніч» (‹ › and drag) for its viewer. */
export const ViewerControls = dynamic(() => import('../midnight/StripControls').then((m) => m.StripControls))
