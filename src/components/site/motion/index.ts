/**
 * Motion kit — shared building blocks for site themes (first used by «Тиша»).
 * Library: `motion` (MIT), loaded via LazyMotion + domAnimation only inside
 * client components that actually animate. ParallaxImage and ScrollLitText
 * are pure CSS (scroll-driven animations) and stay server components.
 */
// Lazy (next/dynamic) wrappers — import these from server components so the
// motion chunk only ships with pages that render them.
export { MotionRoot, RevealText, Reveal, DevelopImage, MagneticButton } from './lazy'
export { ParallaxImage } from './ParallaxImage'
export { ScrollLitText } from './ScrollLitText'
export { useStill, EASE_OUT } from './useStill'
