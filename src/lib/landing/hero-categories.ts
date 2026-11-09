/**
 * Hero category switcher: which showcase frames each category shows in the
 * first-screen gallery mock (4 frames) and in the gallery card under it (3).
 *
 * Every frame in public/landing/img/ was looked at and filed by what is
 * actually in it. A category is shown only when it has enough real frames
 * (4 + 3, at least 4 distinct). Today that is:
 *  - weddings  — showcase 01, 03, 05, 11; themes 07, 13, 16, 18 (+ 01, 15, 21)
 *  - portraits — showcase 02, 06, 08, 10, 12, 13, 16 (+ 15)
 *  - families  — only showcase 07 and 14: hidden until there are more
 *  - studios   — only showcase 13 is clearly a studio frame: hidden
 *
 * `index` is the position in `t.hero.chips` / `t.hero.galleryTitles`.
 */

export interface HeroFrame {
  /** File stem in public/landing/img/. */
  name: string
  kind: 'showcase' | 'themes'
  /** Shot in landscape (3:2); the rest are 2:3 portraits. */
  wide?: boolean
}

export interface HeroCategory {
  key: 'weddings' | 'families' | 'portraits' | 'studios'
  index: 0 | 1 | 2 | 3
  /** Slots of the gallery mock: tall, wide, wide, tall. */
  grid: [HeroFrame, HeroFrame, HeroFrame, HeroFrame]
  /** The gallery card's strip, 3:4 crops. */
  row: [HeroFrame, HeroFrame, HeroFrame]
}

const sc = (n: string, wide = false): HeroFrame => ({ name: `showcase-${n}`, kind: 'showcase', wide })
const th = (n: string, wide = true): HeroFrame => ({ name: `themes-${n}`, kind: 'themes', wide })

export const HERO_CATEGORIES: HeroCategory[] = [
  {
    key: 'weddings',
    index: 0,
    grid: [sc('01'), sc('05', true), sc('03'), sc('11')],
    row: [th('13', false), th('18', false), th('16')],
  },
  {
    key: 'portraits',
    index: 2,
    grid: [sc('02'), sc('16', true), sc('12'), sc('13')],
    row: [sc('06'), sc('08'), sc('10')],
  },
]
