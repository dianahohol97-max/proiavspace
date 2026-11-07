'use client'

import dynamic from 'next/dynamic'

/**
 * The kit's client components behind `next/dynamic` (still server-rendered).
 * Every site page bundles all themes, and the App Router ships each client
 * component a route *imports* — importing these wrappers instead means the
 * `motion` chunk downloads only on pages that actually render one of them.
 * Themes should import the kit from here.
 */
export const MotionRoot = dynamic(() => import('./MotionRoot').then((m) => m.MotionRoot))
export const RevealText = dynamic(() => import('./RevealText').then((m) => m.RevealText))
export const Reveal = dynamic(() => import('./Reveal').then((m) => m.Reveal))
export const DevelopImage = dynamic(() => import('./DevelopImage').then((m) => m.DevelopImage))
export const MagneticButton = dynamic(() => import('./MagneticButton').then((m) => m.MagneticButton))
