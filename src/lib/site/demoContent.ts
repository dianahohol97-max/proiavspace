import type { SiteContent } from './content'
import type { ThemeId, SiteMode } from './themes'
import type { PortfolioItem } from '@/components/site/SiteRenderer'

/**
 * Filled demo content for the public «Теми» showcase — one realistic sample
 * site per theme, with photos in /public/themes (plus a few landing
 * /public/showcase shots). Ukrainian copy;
 * the point is to show how each theme looks, not to be a real business.
 */
export interface ThemeDemo {
  /** THEME_CATALOG value (e.g. 'opivnich' maps to theme tysha + night). */
  value: string
  theme: ThemeId
  mode: SiteMode
  name: string
  /** Who the theme suits, shown as a subtitle. */
  suits: string
  displayName: string
  content: SiteContent
  portfolio: PortfolioItem[]
  /** Sample free dates for themes with a calendar (real sites: booking slots). */
  freeDates?: string[]
}

/** A few weekend dates over the next six weeks, for calendar demos. */
function sampleFreeDates(): string[] {
  const out: string[] = []
  const day = new Date()
  day.setHours(12, 0, 0, 0)
  for (let i = 3; i < 45 && out.length < 7; i++) {
    const d = new Date(day.getTime() + i * 86_400_000)
    const wd = d.getDay()
    if ((wd === 5 && i % 2 === 0) || wd === 6 || (wd === 0 && i % 3 === 0)) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** A /themes photo by number, or any other public path as-is. */
function img(n: number | string): string {
  return typeof n === 'string' ? n : `/themes/${String(n).padStart(2, '0')}.jpg`
}
function ph(id: string, n: number | string, category: string, caption = ''): PortfolioItem {
  return { id, previewUrl: img(n), visible: true, category, caption }
}

/**
 * «Тиша» demo photos: WebP with a 828w copy for phones (public/themes/tysha),
 * real pixel sizes (portrait frames go to portrait slots), and for the four
 * hero frames AVIF/WebP at 828/1280/1920w.
 */
const HERO_FRAMES = new Set(['/themes/07', '/themes/15', '/themes/12', '/themes/04'])
function phw(
  id: string,
  path: string,
  category: string,
  caption: string,
  [width, height]: [number, number]
): PortfolioItem {
  const small = `/themes/tysha/${path.slice(1).replace('/', '-')}`
  const hero = HERO_FRAMES.has(path)
  return {
    id,
    previewUrl: `${path}.webp`,
    visible: true,
    category,
    caption,
    width,
    height,
    srcSet: hero
      ? `${small}-828.webp 828w, ${small}-1280.webp 1280w, ${small}-1920.webp 1920w`
      : `${small}-828.webp 828w, ${path}.webp ${width}w`,
    ...(hero ? { avifSrcSet: `${small}-828.avif 828w, ${small}-1280.avif 1280w, ${small}-1920.avif 1920w` } : {}),
  }
}

/**
 * «Опівніч» demo photos: evening / candle / sparkler frames, WebP 828w for
 * phones (public/themes/opivnich), real sizes; the hero frame also in
 * AVIF/WebP 828/1280/1920w.
 */
function phn(
  id: string,
  path: string,
  category: string,
  caption: string,
  [width, height]: [number, number],
  hero = false
): PortfolioItem {
  const small = `/themes/opivnich/${path.slice(1).replace('/', '-')}`
  return {
    id,
    previewUrl: `${path}.webp`,
    visible: true,
    category,
    caption,
    width,
    height,
    srcSet: hero
      ? `${small}-828.webp 828w, ${small}-1280.webp 1280w, ${small}-1920.webp 1920w`
      : `${small}-828.webp 828w, ${path}.webp ${width}w`,
    ...(hero ? { avifSrcSet: `${small}-828.avif 828w, ${small}-1280.avif 1280w, ${small}-1920.avif 1920w` } : {}),
  }
}

/** «Журнал» demo photos: WebP 828w copies in public/themes/zhurnal; the cover also AVIF/WebP 828/1280/1920. */
function phj(id: string, n: number, category: string, caption: string, hero = false): PortfolioItem {
  const small = `/themes/zhurnal/themes-${n}`
  const width = n === 40 ? 1500 : 1333
  return {
    id,
    previewUrl: `/themes/${n}.webp`,
    visible: true,
    category,
    caption,
    width,
    height: 2000,
    srcSet: hero
      ? `${small}-828.webp 828w, ${small}-1280.webp 1280w, ${small}-1920.webp 1920w`
      : `${small}-828.webp 828w, /themes/${n}.webp ${width}w`,
    ...(hero ? { avifSrcSet: `${small}-828.avif 828w, ${small}-1280.avif 1280w, ${small}-1920.avif 1920w` } : {}),
  }
}

/**
 * «Повітря» demo photos (public/themes/povitria, Unsplash — see CREDITS.md):
 * WebP 2000w as the preview, WebP 828w for phones; the hero also AVIF/WebP
 * 828/1280/1920. Different families by different photographers — captions
 * never pretend it is one family.
 */
function pha(id: string, n: string, category: string, caption: string, [width, height]: [number, number]): PortfolioItem {
  const base = `/themes/povitria/web/${n}`
  const hero = n === '01'
  const w2000 = 2000
  return {
    id,
    previewUrl: `${base}-2000.webp`,
    visible: true,
    category,
    caption,
    width,
    height,
    srcSet: hero
      ? `${base}-828.webp 828w, ${base}-1280.webp 1280w, ${base}-1920.webp 1920w`
      : `${base}-828.webp 828w, ${base}-2000.webp ${w2000}w`,
    ...(hero ? { avifSrcSet: `${base}-828.avif 828w, ${base}-1280.avif 1280w, ${base}-1920.avif 1920w` } : {}),
  }
}

/**
 * A /public/themes frame as WebP with its 1080 px phone copy when there is one
 * (01–24). Used by the v2 themes while their own demo photos are on the way.
 */
function pht(
  id: string,
  n: number,
  category: string,
  caption: string,
  [width, height]: [number, number],
  /** First-screen frame: has 828/1280 WebP + AVIF copies next to it. */
  hero = false
): PortfolioItem {
  const base = `/themes/${String(n).padStart(2, '0')}`
  return {
    id,
    previewUrl: `${base}.webp`,
    visible: true,
    category,
    caption,
    width,
    height,
    srcSet: hero
      ? `${base}-828.webp 828w, ${base}-1280.webp 1280w, ${base}.webp ${width}w`
      : n <= 24
        ? `${base}-1080.webp 1080w, ${base}.webp ${width}w`
        : undefined,
    ...(hero ? { avifSrcSet: `${base}-828.avif 828w, ${base}-1280.avif 1280w` } : {}),
  }
}

/** A landing /public/showcase frame (WebP, no smaller copies). */
function phs(
  id: string,
  n: string,
  category: string,
  caption: string,
  [width, height]: [number, number],
  /** First-screen frame: 828/1280 WebP + AVIF copies next to it ('small': 480/828). */
  hero: boolean | 'small' = false
): PortfolioItem {
  const base = `/showcase/${n}`
  return {
    id,
    previewUrl: `${base}.webp`,
    visible: true,
    category,
    caption,
    width,
    height,
    ...(hero === 'small'
      ? {
          srcSet: `${base}-480.webp 480w, ${base}-828.webp 828w`,
          avifSrcSet: `${base}-480.avif 480w, ${base}-828.avif 828w`,
        }
      : hero
        ? {
            srcSet: `${base}-828.webp 828w, ${base}-1280.webp 1280w, ${base}.webp ${width}w`,
            avifSrcSet: `${base}-828.avif 828w, ${base}-1280.avif 1280w`,
          }
        : {}),
  }
}

type Hero = SiteContent['hero']
type Contact = SiteContent['contact']
function content(
  partial: Omit<Partial<SiteContent>, 'about' | 'hero' | 'contact'> &
    Pick<SiteContent, 'pricing'> & {
      hero: Pick<Hero, 'title' | 'subtitle' | 'imageId'> & Partial<Hero>
      about: { text: string; imageId?: string }
      contact: Omit<Contact, 'telegram'> & Partial<Contact>
    }
): SiteContent {
  return {
    albumCovers: {},
    translations: {},
    settings: { languages: [], leadForm: true, booking: false },
    moment: { text: '', imageId: '' },
    process: { steps: [] },
    testimonials: { items: [] },
    terms: { prepayment: '', delivery: '', travel: '', bring: '' },
    gifts: { enabled: false, items: [] },
    ...partial,
    hero: { role: '', city: '', directions: [], ...partial.hero },
    about: { imageId: '', ...partial.about },
    contact: { telegram: '', ...partial.contact },
  }
}

export const THEME_DEMOS: ThemeDemo[] = [
  {
    value: 'tysha',
    theme: 'tysha',
    mode: 'light',
    name: 'Тиша',
    suits: 'Весільна та сімейна зйомка',
    displayName: 'Ольга Вишня',
    content: content({
      hero: {
        title: 'Ольга Вишня',
        subtitle: 'Весільні історії у вашому темпі',
        imageId: '1',
        city: 'Львів і Карпати',
        directions: ['Весілля', 'Love story', 'Сімейні'],
      },
      terms: {
        prepayment: '30% — і дата ваша',
        delivery: 'перші кадри за 3 дні, уся галерея за 4 тижні',
        travel: 'Львів і Карпати без доплат, далі — дорога за домовленістю',
        bring: 'зручне взуття і все, що для вас важливе: листи, обручки, плед',
      },
      about: {
        text: 'Я знімаю весілля такими, якими їх памʼятають самі наречені: світло крізь фіранку, мамині руки, що поправляють фату, тиша перед першим «так». Не ставлю в пози — спостерігаю й допомагаю почуватися вільно.',
        imageId: '17',
      },
      moment: { text: 'Найцінніше — між кадрами', imageId: '15' },
      testimonials: {
        items: [
          {
            names: 'Марта і Богдан',
            text: 'Ми боялися, що будемо скуті перед камерою, а в результаті просто забули про неї. Дивимося галерею — і знову чуємо той вечір.',
            photoId: '6',
          },
          {
            names: 'Ірина та Олег',
            text: 'Ольга помітила все, що ми самі пропустили: як тато витирав сльози, як сестра тримала мене за руку. Дякуємо за ці кадри.',
            photoId: '18',
          },
          {
            names: 'Родина Коваль',
            text: 'Спокійно, тепло і зовсім без «а тепер усміхаємося». Діти бігали, ми сміялися, а фото вийшли саме такими, як ми є.',
            photoId: '13',
          },
        ],
      },
      pricing: {
        items: [
          {
            name: 'Love story',
            price: 'від 7 000 ₴',
            includes: ['до 2 годин зйомки', 'одна-дві локації', '80+ кадрів з обробкою', 'онлайн-галерея'],
          },
          {
            name: 'Весільний день',
            price: 'від 26 000 ₴',
            includes: ['до 10 годин зйомки', 'збори, церемонія і вечір', '500+ кадрів з обробкою', 'онлайн-галерея з оригіналами'],
            featured: true,
          },
          {
            name: 'Камерне весілля',
            price: 'від 14 000 ₴',
            includes: ['до 5 годин зйомки', 'розпис і вечеря з близькими', '250+ кадрів з обробкою', 'онлайн-галерея'],
          },
        ],
      },
      contact: { email: 'olga@example.com', phone: '+380 67 100 00 00', instagram: '@olga.vyshnia', telegram: 'olga_vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      // 1–4: landscape frames for the hero; then the grid's rhythm
      // (landscape, portrait, portrait, landscape, landscape, portrait…).
      phw('1', '/themes/07', 'Весілля', 'Марта і Богдан', [2000, 1335]),
      phw('2', '/themes/15', 'Весілля', 'Дорога в гори', [2000, 1335]),
      phw('3', '/themes/12', 'Весілля', 'Червоний дім на пагорбі', [2000, 1335]),
      phw('4', '/themes/04', 'Весілля', 'Дорога додому', [2000, 1335]),
      phw('5', '/themes/01', 'Весілля', 'Біля старого паркану', [2000, 1335]),
      phw('6', '/themes/18', 'Love story', 'Тільки ми', [1335, 2000]),
      phw('7', '/themes/13', 'Love story', 'Серед трав', [1335, 2000]),
      phw('8', '/themes/16', 'Весілля', 'Перший погляд', [2000, 1335]),
      phw('9', '/themes/20', 'Весілля', 'Удвох', [2000, 1335]),
      phw('10', '/showcase/01', 'Love story', 'Ліс після дощу', [1333, 2000]),
      phw('11', '/themes/05', 'Весілля', 'Під горами', [2000, 1335]),
      phw('12', '/themes/06', 'Весілля', 'Вітер з гір', [1335, 2000]),
      phw('13', '/showcase/09', 'Сімейні', 'Велика родина', [1333, 2000]),
      phw('14', '/themes/23', 'Весілля', 'Червоні дахи', [2000, 1335]),
      phw('15', '/showcase/16', 'Портрети', 'Золота година', [2000, 1333]),
      phw('16', '/showcase/14', 'Сімейні', 'На татових плечах', [1333, 2000]),
      phw('17', '/showcase/08', 'Портрети', 'Біля вікна', [1333, 2000]),
      phw('18', '/showcase/03', 'Love story', 'Липневе світло', [1333, 2000]),
      phw('19', '/showcase/04', 'Сімейні', 'Неділя в полі', [1333, 2000]),
      phw('20', '/showcase/07', 'Сімейні', 'Перше літо', [1333, 2000]),
    ],
  },
  {
    value: 'opivnich',
    theme: 'tysha',
    mode: 'night',
    name: 'Опівніч',
    suits: 'Вечірні та мистецькі зйомки',
    displayName: 'Ольга Вишня',
    content: content({
      hero: {
        title: 'Ольга Вишня',
        subtitle: 'Світло, що зʼявляється в темряві',
        imageId: '1',
        city: 'Київ',
        directions: ['Весілля', 'Портрети', 'Світло і тінь'],
      },
      terms: {
        prepayment: '30% — і вечір ваш',
        delivery: '10 кадрів наступного ранку, галерея за 3 тижні',
        travel: 'Київ і область без доплат',
        bring: 'бенгальські вогні беру я; вам — улюблений плед на вечір',
      },
      gifts: {
        enabled: true,
        items: [
          { kind: 'certificate', enabled: true, title: 'Сертифікат на вечірню зйомку', text: 'На річницю чи весілля друзів: годину живого світла й 60 кадрів.', price: 'від 3 000 ₴', imageId: '19' },
          { kind: 'book', enabled: false, title: '', text: '', price: '', imageId: '' },
          { kind: 'prints', enabled: true, title: 'Принти на матовому папері', text: 'Глибокі тіні на бавовняному папері, 20×30 і 30×45.', price: 'від 450 ₴', imageId: '18' },
        ],
      },
      about: {
        text: 'Я люблю вечір: гірлянди, свічки, бенгальські вогні й обличчя, на які падає тепле світло. Там, де інші вимикають камеру, для мене починається найцікавіше — темрява робить кожен кадр тихішим і чеснішим.',
        imageId: '11',
      },
      moment: { text: 'Вогні гаснуть — кадри лишаються', imageId: '' },
      testimonials: {
        items: [
          {
            names: 'Анна і Максим',
            text: 'Ми боялися, що вечірні кадри вийдуть темними й шумними. А вийшли найкрасивішими у всій галереї — наче кіно.',
            photoId: '2',
          },
          {
            names: 'Софія та Ілля',
            text: 'Перший танець під гірляндами і вогні наприкінці — дивимося ці фото й знову опиняємося в тому вечорі.',
            photoId: '4',
          },
        ],
      },
      pricing: {
        items: [
          {
            name: 'Вечір при свічках',
            price: 'від 9 000 ₴',
            includes: ['до 3 годин зйомки', 'камерне свято або портрети', '120+ кадрів з обробкою', 'онлайн-галерея'],
          },
          {
            name: 'Весілля до ночі',
            price: 'від 28 000 ₴',
            includes: ['до 12 годин, до останнього танцю', 'план вечірнього світла', '500+ кадрів з обробкою', 'онлайн-галерея з оригіналами'],
            featured: true,
          },
          {
            name: 'Вечірня зйомка',
            price: 'від 12 000 ₴',
            includes: ['до 4 годин зйомки', 'захід сонця і вечір', '200+ кадрів з обробкою', 'онлайн-галерея'],
          },
        ],
      },
      contact: { email: 'olga@example.com', phone: '+380 67 100 00 00', instagram: '@olga.vyshnia', telegram: 'olga_vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      // 1: hero; 11: the photographer's portrait; the next nine form the grid
      // (pair, trio, pause, trio); the rest feed the strip of lights.
      // No frame is shared with «Тиша»'s demo.
      phn('1', '/themes/25', 'Весілля', 'Коридор із вогнів', [2000, 1333], true),
      phn('2', '/themes/26', 'Весілля', 'Перший танець під гірляндами', [2000, 1335]),
      phn('3', '/themes/27', 'Весілля', 'Поцілунок під іскрами', [1333, 2000]),
      phn('4', '/themes/29', 'Весілля', 'Сукня в іскрах', [1333, 2000]),
      phn('5', '/themes/28', 'Весілля', 'Щасливі', [1333, 2000]),
      phn('6', '/themes/38', 'Портрети', 'Тепло на обличчі', [1416, 2000]),
      phn('7', '/themes/30', 'Світло і тінь', 'Остання година сонця', [2000, 1374]),
      phn('8', '/themes/39', 'Портрети', 'Вікно у вечір', [1600, 2000]),
      phn('9', '/showcase/02', 'Портрети', 'Промінь', [1333, 2000]),
      phn('11', '/showcase/06', 'Світло і тінь', 'Портрет', [1333, 2000]),
      phn('12', '/themes/37', 'Портрети', 'Червоне світло', [2000, 1333]),
      phn('14', '/themes/35', 'Портрети', 'Вогні міста', [1333, 2000]),
      phn('15', '/showcase/10', 'Світло і тінь', 'Сутінки', [1333, 2000]),
      phn('16', '/themes/36', 'Світло і тінь', 'Боке', [1500, 2000]),
      phn('17', '/showcase/12', 'Світло і тінь', 'Високі вікна', [1333, 2000]),
      phn('18', '/showcase/13', 'Світло і тінь', 'Чорно-біле', [1333, 2000]),
      phn('19', '/showcase/15', 'Світло і тінь', 'Туман', [1333, 2000]),
    ],
  },
  {
    value: 'povitria',
    theme: 'povitria',
    mode: 'light',
    name: 'Повітря',
    suits: 'Сімейні та lifestyle',
    displayName: 'Ірина Літо',
    content: content({
      hero: {
        title: 'Ірина Літо',
        subtitle: 'Легкі сімейні історії',
        imageId: '1',
        city: 'Одеса',
        directions: ['Сімейні', 'Діти', 'Lifestyle вдома'],
      },
      terms: {
        prepayment: '1 000 ₴ — і день за вами',
        delivery: 'галерея за 2 тижні',
        travel: 'Одеса й узбережжя — без доплат',
        bring: 'одяг у спокійних кольорах, улюблену іграшку, воду й перекус для дітей',
      },
      about: {
        text: 'Я знімаю сімʼї там, де їм добре: вдома за сніданком, у полі, на прогулянці до заходу сонця. Без позування годинами — граємо, розмовляємо, ловимо світло. А фото потім пахнуть тим самим днем.',
        imageId: '21',
      },
      moment: { text: 'Від ранкового вікна до золотої години', imageId: '' },
      testimonials: {
        items: [
          { names: 'Олена', text: 'Діти навіть не помітили, що це зйомка. А в нас тепер є фото, де ми всі справжні.', photoId: '9' },
          { names: 'Андрій і Марія', text: 'Хотіли кілька кадрів у полі, а отримали цілу історію нашого вечора. Дуже тепло.', photoId: '15' },
          { names: 'Наталія', text: 'Легко, спокійно і без «посміхнись у камеру». Саме так, як хотілося.', photoId: '13' },
        ],
      },
      pricing: {
        items: [
          { name: 'Прогулянка', price: 'від 4 500 ₴', includes: ['1 година', 'одна локація', '40 кадрів з обробкою'] },
          {
            name: 'День родини',
            price: 'від 9 000 ₴',
            includes: ['до 3 годин', 'вдома і надворі', '120 кадрів з обробкою', 'онлайн-галерея'],
            featured: true,
          },
          { name: 'Lifestyle вдома', price: 'від 7 000 ₴', includes: ['2 години', 'ранок або вечір удома', '80 кадрів з обробкою'] },
        ],
      },
      contact: { email: 'iryna@example.com', phone: '+380 63 200 00 00', instagram: '@iryna.lito', telegram: 'iryna_lito', bookingUrl: '' },
    }),
    portfolio: [
      // 01 hero · 02–13 the collage (02–07 carry a time: «День у світлі»)
      // · 14–20 spares (the floating hero prints) · 21 portrait.
      pha('1', '01', 'Сімейні', 'Простір', [2400, 1602]),
      pha('2', '02', 'Lifestyle вдома', '08:40 · Ранок біля вікна', [2400, 3600]),
      pha('3', '03', 'Lifestyle вдома', '09:30 · Сніданок', [2400, 1600]),
      pha('4', '04', 'Сімейні', '13:10 · Полудень у полі', [2400, 1600]),
      pha('5', '05', 'Сімейні', '15:20 · Пікнік', [2400, 1600]),
      pha('6', '06', 'Сімейні', '17:30 · Прогулянка', [2400, 1601]),
      pha('7', '07', 'Сімейні', '19:40 · Золота година', [2400, 1600]),
      pha('8', '08', 'Сімейні', 'Утрьох', [2400, 3307]),
      pha('9', '09', 'Сімейні', 'Вище неба', [2400, 3596]),
      pha('10', '10', 'Сімейні', 'Сонце в траві', [2400, 3600]),
      pha('11', '11', 'Сімейні', 'Обійми', [2400, 3600]),
      pha('12', '12', 'Діти', 'Старший брат', [2400, 3600]),
      pha('13', '13', 'Діти', 'Літо', [2400, 3600]),
      pha('14', '14', 'Сімейні', 'Тепло', [2400, 1600]),
      pha('15', '15', 'Сімейні', 'Всі разом', [2400, 1600]),
      pha('16', '16', 'Сімейні', 'У полі', [2400, 1600]),
      pha('17', '17', 'Діти', 'Вітер', [2400, 3624]),
      pha('18', '18', 'Діти', 'Стежка', [2400, 3360]),
      pha('19', '19', 'Сімейні', 'Біля моря', [2400, 3600]),
      pha('20', '20', 'Сімейні', 'Перед заходом', [2400, 1600]),
      pha('21', '21', 'Сімейні', 'Ірина', [2400, 3609]),
    ],
  },
  {
    value: 'start',
    theme: 'start',
    mode: 'light',
    name: 'Старт',
    suits: 'Перше портфоліо, до 10 кадрів',
    displayName: 'Марко Вереск',
    content: content({
      hero: {
        title: 'Марко Вереск',
        subtitle: 'Прості й чесні кадри — без пафосу і довгих поз',
        imageId: '2',
        city: 'Київ',
        directions: ['Love story', 'Портрет', 'Сімейні'],
      },
      about: {
        text: 'Я знімаю другий рік і досі радію кожній зйомці, як першій. Люблю природне світло, прогулянки і людей, які не вміють позувати, — разом ми впораємося. Беру небагато зйомок на місяць, щоб на кожну був час.',
        imageId: '',
      },
      terms: {
        prepayment: '500 ₴, решта — після зйомки',
        delivery: 'усі фото за 7 днів',
        travel: 'Київ — без доплат',
        bring: 'дві зміни одягу й гарний настрій',
      },
      testimonials: {
        items: [
          { names: 'Аня і Тарас', text: 'Було легко й весело, а фото вийшли саме про нас. Дякуємо, що не мучив позами!', photoId: '3' },
          { names: 'Олена', text: 'Отримала фото вже за п’ять днів — і всі як на підбір. Рекомендую подругам.', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'Портрет', price: '2 000 ₴', includes: ['1 година', 'одна локація', '30 фото з обробкою'] },
          {
            name: 'Love story',
            price: '3 500 ₴',
            includes: ['до 2 годин', 'дві локації', '60 фото з обробкою'],
            featured: true,
          },
          { name: 'Сімейна', price: '3 000 ₴', includes: ['1.5 години', 'парк або дім', '50 фото з обробкою'] },
        ],
      },
      contact: { email: 'marko@example.com', phone: '+380 93 500 00 00', instagram: '@marko.veresk', telegram: 'marko_veresk', bookingUrl: '' },
    }),
    // Exactly ten frames: «Старт» must look good with a small portfolio.
    // TEMPORARY (until assets/start): 02–19 are the mountain couple of the
    // «Тиша» set; 31 is Старт's own. See docs/THEMES_LOG.md.
    portfolio: [
      pht('1', 2, 'Love story', 'Вітер у горах', [2000, 1335]),
      pht('2', 31, 'Сімейні', 'Захід сонця', [2000, 1333], true),
      pht('3', 9, 'Портрет', 'Погляд', [1450, 2000]),
      pht('4', 3, 'Love story', 'Удвох', [2000, 1335]),
      pht('5', 10, 'Портрет', 'Тиша', [1335, 2000]),
      pht('6', 8, 'Love story', 'Дорога', [2000, 1335]),
      pht('7', 19, 'Портрет', 'Світло', [1335, 2000]),
      pht('8', 11, 'Love story', 'Серед трав', [2000, 1335]),
      pht('9', 14, 'Love story', 'Сміх', [2000, 1335]),
      pht('10', 17, 'Love story', 'Вечір', [2000, 1335]),
    ],
  },
  {
    value: 'nizhnist',
    theme: 'nizhnist',
    mode: 'light',
    name: 'Ніжність',
    suits: 'Новонароджені, вагітність, рік малюка',
    displayName: 'Соломія Тепла',
    content: content({
      hero: {
        title: 'Соломія Тепла',
        subtitle: 'Перший рік малюка — від перших днів до першої свічки на торті',
        imageId: '1',
        city: 'Львів',
        directions: ['Рік малюка', 'Сімейні', 'Діти'],
      },
      about: {
        text: 'Я мама двох дітей і вже шість років знімаю найменших. Теплу студію готую заздалегідь, працюю лише з денним світлом і ніколи не поспішаю: годування, сон і обійми — важливіші за кадр.',
        imageId: '',
      },
      moment: {
        text: 'Безпека на зйомці: студія прогріта до 26 °C, усі пози — лише з підстраховкою рук асистента, реквізит перевіряю перед кожною зйомкою, а перерви робимо стільки, скільки потрібно малюку.',
        imageId: '',
      },
      terms: {
        prepayment: '1 000 ₴ — і дата ваша',
        delivery: 'превʼю за 3 дні, усі фото за 2 тижні',
        travel: 'студія у Львові; виїзд додому — +600 ₴',
        bring: 'улюблену ковдрочку, запасний одяг і все для годування',
      },
      gifts: {
        enabled: true,
        items: [
          { kind: 'certificate', enabled: true, title: 'Подарунковий сертифікат', text: 'Для мами в декреті чи майбутніх батьків — на будь-яку зйомку або суму.', price: 'від 1 500 ₴', imageId: '' },
          { kind: 'book', enabled: true, title: 'Фотокнига «Мій перший рік»', text: '20 розворотів, тверда льняна обкладинка, тиснення імені.', price: 'від 2 400 ₴', imageId: '' },
          { kind: 'prints', enabled: true, title: 'Принти для дитячої', text: 'Мʼякий матовий папір, 20×30, у пастельних паспарту.', price: 'від 350 ₴', imageId: '' },
        ],
      },
      testimonials: {
        items: [
          { names: 'Ірина, мама Марка', text: 'Я хвилювалася, як він витримає зйомку, а він проспав майже весь час у теплі. Кадри — найдорожче, що в нас є.', photoId: '' },
          { names: 'Оля та Дмитро', text: 'Знімалися щоквартально весь перший рік — тепер у нас ціла книга про те, як Соня росла.', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'Новонароджений', price: 'від 4 500 ₴', includes: ['до 3 годин у теплій студії', 'реквізит і одяг', '25 фото з ретушшю'] },
          {
            name: 'Рік малюка',
            price: 'від 14 000 ₴',
            includes: ['4 зйомки: 1, 4, 8 і 12 місяців', '15 фото з кожної', 'фотокнига в подарунок'],
            featured: true,
          },
          { name: 'Сімейна вдома', price: 'від 3 800 ₴', includes: ['1.5 години у вас удома', 'вся родина', '40 фото з обробкою'] },
        ],
      },
      contact: { email: 'solomiia@example.com', phone: '+380 97 600 00 00', instagram: '@solomiia.tepla', telegram: 'solomiia_tepla', bookingUrl: '' },
    }),
    // TEMPORARY (until assets/nizhnist): family frames from the «Повітря» set
    // that its page does not show (14–20) and four «Тиша» spares from
    // /showcase. The «рік малюка» ribbon reads the «1 міс · …» captions.
    portfolio: [
      phs('1', '07', 'Сімейні', 'Перше літо', [1333, 2000], true),
      pha('2', '20', 'Рік малюка', '1 міс · Перші тижні вдома', [2400, 1600]),
      phs('3', '04', 'Рік малюка', '4 міс · На ковдрі в траві', [1333, 2000]),
      pha('4', '14', 'Рік малюка', '8 міс · На татових руках', [2400, 1600]),
      phs('5', '14', 'Рік малюка', '1 рік · Вище за всіх', [1333, 2000]),
      pha('6', '15', 'Сімейні', 'Усі разом', [2400, 1600]),
      pha('7', '17', 'Діти', 'Вітер', [2400, 3624]),
      pha('8', '19', 'Сімейні', 'Біля моря', [2400, 3600]),
      pha('9', '18', 'Діти', 'Стежка', [2400, 3360]),
      pha('10', '16', 'Діти', 'У полі', [2400, 1600]),
      phs('11', '16', 'Діти', 'Золота година', [2000, 1333]),
      phs('12', '03', 'Сімейні', 'Липневе світло', [1333, 2000]),
      phs('13', '08', 'Сімейні', 'Біля вікна', [1333, 2000]),
    ],
  },
  {
    value: 'kontent',
    theme: 'kontent',
    mode: 'light',
    name: 'Контент',
    suits: 'Контент для брендів і соцмереж',
    displayName: 'Аліна Кадр',
    content: content({
      hero: {
        title: 'Аліна Кадр',
        subtitle: 'Фото й короткі відео для соцмереж бренду — за один знімальний день',
        imageId: '1',
        role: 'Контент-фотограф',
        city: 'Київ і онлайн',
        directions: ['Продукт', 'Майстри', 'Люди бренду'],
      },
      about: {
        text: 'Я знімаю контент для малого бізнесу: кавʼярні, майстерні, бʼюті-бренди. Приїжджаю з планом публікацій на місяць, а йду з фото й вертикальними відео, які одразу можна викладати.',
        imageId: '',
      },
      terms: {
        prepayment: '50% після узгодження контент-плану',
        delivery: 'перші 10 кадрів наступного дня, усе за 5 днів',
        travel: 'Київ — включено; інші міста — дорога',
        bring: 'продукт у кількох варіантах і людей, які з ним працюють',
      },
      testimonials: {
        items: [
          { names: 'Кавʼярня «Зерно»', text: 'Після зйомки нам вистачило контенту на півтора місяця. Охоплення в рілсах виросли вдвічі.', photoId: '' },
          { names: 'Майстерня «Глина»', text: 'Аліна сама придумала сюжети для відео — нам лишилося тільки працювати, як завжди.', photoId: '' },
          { names: 'Бренд догляду «Ліс»', text: 'Чіткий план, швидко, і кадри однаково гарні в профілі й на сайті.', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'Старт профілю', price: '6 000 ₴', includes: ['2 години зйомки', '30 фото', '3 вертикальні відео'] },
          {
            name: 'Місяць контенту',
            price: '14 000 ₴',
            includes: ['контент-план на місяць', '80 фото', '10 відео для reels', 'обкладинки для highlights'],
            featured: true,
          },
          { name: 'Продуктова', price: '4 500 ₴', includes: ['до 10 позицій', 'фон і реквізит', '40 фото з ретушшю'] },
        ],
      },
      contact: { email: 'alina@example.com', phone: '+380 50 700 00 00', instagram: '@alina.kadr', telegram: 'alina_kadr', bookingUrl: '' },
    }),
    // TEMPORARY (until assets/kontent): product frames of «Індекс» (55–59)
    // and the painting-studio frames of «Паспарту» (32–34); no videos yet.
    portfolio: [
      pht('1', 55, 'Продукт', 'Сироватки на сонці', [1333, 2000], true),
      pht('2', 58, 'Продукт', 'Крапля', [1333, 2000]),
      pht('3', 32, 'Майстри', 'Перший мазок', [1333, 2000]),
      pht('4', 33, 'Майстри', 'Палітра', [1333, 2000]),
      pht('5', 56, 'Продукт', 'Набір', [2000, 1333]),
      pht('6', 34, 'Майстри', 'Готова робота', [1126, 2000]),
      pht('7', 57, 'Продукт', 'Лінійка', [2000, 1333]),
      pht('8', 59, 'Продукт', 'Тюбики', [1333, 2000]),
      pht('9', 41, 'Люди бренду', 'Деталі образу', [1333, 2000]),
      pht('10', 47, 'Люди бренду', 'Лукбук', [1333, 2000]),
    ],
  },
  {
    value: 'lyst',
    theme: 'lyst',
    mode: 'light',
    name: 'Лист',
    suits: 'Love story, весілля, річниці',
    displayName: 'Віра Ясень',
    content: content({
      hero: {
        title: 'Віра Ясень',
        subtitle: 'Знімаю історії, які хочеться перечитувати',
        imageId: '1',
        city: 'Чернівці',
        directions: ['Love story', 'Весілля', 'Річниця'],
      },
      about: {
        text: 'Я вірю, що найкращі кадри схожі на листи: їх пишуть повільно й для когось одного. Тому перед зйомкою ми довго говоримо, а на зйомці я просто дозволяю вам бути поруч.',
        imageId: '',
      },
      terms: {
        prepayment: '30% — і день записано за вами',
        delivery: '20 кадрів за тиждень, уся історія за місяць',
        travel: 'Буковина без доплат; інші міста — дорога',
        bring: 'речі зі спільною історією: лист, плед, улюблену книжку',
      },
      testimonials: {
        items: [
          { names: 'Марта і Богдан', text: 'Ми перечитуємо ці фото, як старі листи. Кожного разу знаходимо щось нове.', photoId: '' },
          { names: 'Ганна та Ігор, 25 років разом', text: 'Діти подарували нам зйомку на річницю. Ми знову почувалися як на першому побаченні.', photoId: '' },
          { names: 'Олеся і Нік', text: 'Спокійно, тепло і зовсім без «а тепер поцілуйтеся». Дякуємо за нашу історію.', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'Love story', price: 'від 6 000 ₴', includes: ['2 години', 'одна-дві локації', '70 кадрів'] },
          {
            name: 'Весільний день',
            price: 'від 22 000 ₴',
            includes: ['до 10 годин', 'лист-історія вашого дня', '400+ кадрів', 'друкований конверт із 10 фото'],
            featured: true,
          },
          { name: 'Річниця', price: 'від 5 000 ₴', includes: ['1.5 години', 'місце вашого знайомства', '50 кадрів'] },
        ],
      },
      contact: { email: 'vira@example.com', phone: '+380 66 800 00 00', instagram: '@vira.yasen', telegram: 'vira_yasen', bookingUrl: '' },
    }),
    // Three frames fly out of the envelope: 1 (own), then the first two of
    // the grid. TEMPORARY (until assets/lyst): 10, 19, 21, 22, 24, 03, 11, 14
    // and /showcase/05 are the mountain couple of the «Тиша» set.
    portfolio: [
      phs('1', '11', 'Love story', 'Під яблунею', [1333, 2000], 'small'),
      pht('2', 10, 'Love story', 'Тихо', [1335, 2000]),
      pht('3', 22, 'Весілля', 'Удвох у горах', [2000, 1335]),
      pht('4', 21, 'Весілля', 'Після церемонії', [2000, 1335]),
      pht('5', 19, 'Річниця', 'Як уперше', [1335, 2000]),
      pht('6', 24, 'Весілля', 'Червоні дахи', [2000, 1335]),
      phs('7', '05', 'Love story', 'Простір', [2000, 1335]),
      pht('8', 3, 'Річниця', 'Разом', [2000, 1335]),
      pht('9', 11, 'Love story', 'Серед трав', [2000, 1335]),
      pht('10', 14, 'Весілля', 'Сміх', [2000, 1335]),
    ],
  },
  {
    value: 'portret',
    theme: 'portret',
    mode: 'light',
    name: 'Портрет',
    suits: 'Бізнес-портрет і особистий бренд',
    displayName: 'Остап Грань',
    content: content({
      hero: {
        title: 'Остап Грань',
        subtitle: 'Портрети, у яких вас впізнають і яким довіряють',
        imageId: '1',
        city: 'Київ, студія на Подолі',
        directions: ['Бізнес-портрет', 'Особистий бренд', 'Творче портфоліо'],
      },
      about: {
        text: 'Десять років знімаю людей, які не люблять фотографуватися: керівників, лікарів, юристів, акторів. Моє завдання — щоб за 40 хвилин ви розслабилися, а портрет говорив про вас без слів.',
        imageId: '',
      },
      // «До / після ретуші»: the moment frame is the «до», the first-screen frame the «після».
      moment: { text: 'Ретуш: шкіра, світло, колір — без «пластику»', imageId: '11' },
      terms: {
        prepayment: '50% при бронюванні',
        delivery: 'вибір кадрів за 2 дні, ретуш — за 5 робочих днів',
        travel: 'офіс у межах Києва — +1 500 ₴',
        bring: '2–3 однотонні сорочки чи блузи; піджак; окуляри, якщо носите; гребінець і пудру без блиску',
      },
      testimonials: {
        items: [
          { names: 'Ірина, партнерка юрфірми', text: 'Нарешті портрет, який не соромно поставити на сайт фірми. І все за годину.', photoId: '' },
          { names: 'Андрій, засновник студії', text: 'Остап підказав, що вдягти, і за кадром жартував так, що я забув про камеру.', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'Діловий портрет', price: '3 500 ₴', includes: ['40 хвилин у студії', '2 образи', '5 кадрів із ретушшю'] },
          {
            name: 'Особистий бренд',
            price: '9 000 ₴',
            includes: ['2 години: студія і робоче місце', 'до 4 образів', '25 кадрів із ретушшю', 'добірка для LinkedIn і сайту'],
            featured: true,
          },
          { name: 'Команда', price: 'від 1 800 ₴ / особа', includes: ['виїзна студія в офіс', 'однакове світло для всіх', '3 кадри на людину'] },
        ],
      },
      contact: { email: 'ostap@example.com', phone: '+380 67 900 00 00', instagram: '@ostap.gran', telegram: 'ostap_gran', bookingUrl: '' },
    }),
    // TEMPORARY (until assets/portret): fashion frames of «Журнал» (42–48)
    // and portraits of «Опівніч» (/showcase); «до ретуші» (11) is a flat
    // rendering of 48 made for the demo, not a real raw file.
    portfolio: [
      pht('1', 48, 'Особистий бренд', 'Червоний костюм', [1333, 2000], true),
      pht('2', 42, 'Бізнес-портрет', 'Монохром', [1333, 2000]),
      pht('3', 44, 'Бізнес-портрет', 'Вулиця', [1333, 2000]),
      phs('4', '13', 'Творче портфоліо', 'Світло з вікна', [1333, 2000]),
      pht('5', 46, 'Бізнес-портрет', 'Опора', [1333, 2000]),
      phs('6', '12', 'Творче портфоліо', 'Лофт', [1333, 2000]),
      phs('7', '15', 'Творче портфоліо', 'Контражур', [1333, 2000]),
      pht('8', 40, 'Особистий бренд', 'На сходах', [1500, 2000]),
      phs('9', '10', 'Творче портфоліо', 'Вікно потяга', [1333, 2000]),
      phs('10', '06', 'Творче портфоліо', 'Тінь', [1333, 2000]),
      {
        id: '11',
        previewUrl: '/themes/portret/48-before-1280.webp',
        srcSet: '/themes/portret/48-before-828.webp 828w, /themes/portret/48-before-1280.webp 1280w',
        visible: true,
        category: null,
        caption: 'До ретуші',
        width: 1333,
        height: 2000,
      },
    ],
  },
  {
    value: 'sviato',
    theme: 'sviato',
    mode: 'light',
    name: 'Свято',
    suits: 'Дні народження, хрестини, корпоративи',
    displayName: 'Тарас Іскра',
    content: content({
      hero: {
        title: 'Тарас Іскра',
        subtitle: 'Знімаю свята так, щоб гості потім шукали себе в кожному кадрі',
        imageId: '1',
        city: 'Дніпро',
        directions: ['Дні народження', 'Хрестини', 'Корпоративи'],
      },
      about: {
        text: 'Я той фотограф, якого не помічають на святі, доки не побачать фото. Працюю швидко, з живим світлом і фотобудкою, а найкращі кадри показую гостям ще до кінця вечора.',
        imageId: '',
      },
      terms: {
        prepayment: '1 000 ₴ — і дата за вами',
        delivery: '30 кадрів наступного дня, решта за тиждень',
        travel: 'Дніпро без доплат; область — 10 ₴/км',
        bring: 'список важливих гостей і моментів — решту візьму на себе',
      },
      gifts: {
        enabled: true,
        items: [
          { kind: 'certificate', enabled: true, title: 'Сертифікат на свято', text: 'Подаруйте друзям зйомку їхнього дня народження чи хрестин.', price: 'від 2 000 ₴', imageId: '' },
          { kind: 'book', enabled: false, title: '', text: '', price: '', imageId: '' },
          { kind: 'prints', enabled: true, title: 'Стрічки з фотобудки', text: 'Друкуємо на місці: кожен гість забирає свою стрічку.', price: 'від 1 500 ₴', imageId: '' },
        ],
      },
      testimonials: {
        items: [
          { names: 'Наталя, 40 років', text: 'Фотобудка була хітом вечора, а кадри з танцполу — найкращі в моєму житті!', photoId: '' },
          { names: 'Команда «Сокіл»', text: 'Корпоратив на 80 людей — і кожен знайшов себе в галереї. Дякуємо!', photoId: '' },
        ],
      },
      pricing: {
        items: [
          { name: 'День народження', price: 'від 4 000 ₴', includes: ['до 3 годин', 'репортаж і портрети гостей', '150+ кадрів'] },
          {
            name: 'Свято + фотобудка',
            price: 'від 7 500 ₴',
            includes: ['до 4 годин', 'фотобудка з реквізитом', 'друк стрічок на місці', '250+ кадрів'],
            featured: true,
          },
          { name: 'Хрестини', price: 'від 3 500 ₴', includes: ['церемонія і застілля', 'сімейні портрети', '120+ кадрів'] },
        ],
      },
      contact: { email: 'taras@example.com', phone: '+380 68 100 20 30', instagram: '@taras.iskra', telegram: 'taras_iskra', bookingUrl: '' },
    }),
    get freeDates() {
      return sampleFreeDates()
    },
    // The photo-booth strip: 1–4. TEMPORARY (until assets/sviato): evening
    // frames of the «Опівніч» set.
    portfolio: [
      phn('1', '/themes/27', 'Дні народження', 'Іскри', [1333, 2000]),
      phn('2', '/themes/28', 'Дні народження', 'Щасливі', [1333, 2000]),
      phn('3', '/themes/29', 'Корпоративи', 'Вогні', [1333, 2000]),
      phn('4', '/themes/26', 'Корпоративи', 'Танець', [2000, 1335]),
      phn('5', '/themes/25', 'Корпоративи', 'Коридор із вогнів', [2000, 1333]),
      phn('6', '/themes/30', 'Хрестини', 'Остання година сонця', [2000, 1374]),
      phn('7', '/themes/38', 'Дні народження', 'Тепло на обличчі', [1416, 2000]),
      phn('8', '/themes/37', 'Дні народження', 'Червоне світло', [2000, 1333]),
      phn('9', '/themes/39', 'Хрестини', 'Вікно у вечір', [1600, 2000]),
      phn('10', '/themes/35', 'Корпоративи', 'Вогні міста', [1333, 2000]),
      phn('11', '/themes/36', 'Хрестини', 'Боке', [1500, 2000]),
    ],
  },
  {
    value: 'plivka',
    theme: 'plivka',
    mode: 'light',
    name: 'Плівка',
    suits: 'Плівкова естетика',
    displayName: 'Тарас Кадр',
    content: content({
      hero: { title: 'Тарас Кадр', subtitle: 'Знято на плівку', imageId: '' },
      about: { text: 'Портрети й історії з характером справжньої плівки: зерно, теплі тони, чесні емоції.' },
      pricing: {
        items: [{ name: 'Плівкова зйомка', price: 'від 6 000 ₴', includes: ['1.5 години', 'скани', '2 плівки'] }],
      },
      contact: { email: 'taras@example.com', phone: '', instagram: '@taras.kadr', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 38, 'Портрети', 'Бурштин'),
      ph('2', 35, 'Портрети', 'У русі'),
      ph('3', 37, 'Портрети', 'Червоне світло'),
      ph('4', 36, 'Портрети', 'Вогні міста'),
      ph('5', 39, 'Історії', 'Вікно'),
    ],
  },
  {
    value: 'zhurnal',
    theme: 'zhurnal',
    mode: 'light',
    name: 'Журнал',
    suits: 'Фешн і бʼюті',
    displayName: 'Studio Nota',
    content: content({
      hero: {
        title: 'Studio Nota',
        subtitle: 'Редакційна зйомка з характером',
        imageId: '1',
        role: 'Фотостудія',
        city: 'Київ',
        directions: ['Фешн-сторі', 'Лукбук', 'Портрет'],
      },
      terms: {
        prepayment: '50% після узгодження мудборду',
        delivery: 'превʼю за 2 дні, ретуш за 10 робочих днів',
        travel: 'по Києву — включено; інші міста — дорога й проживання команди',
        bring: '2–3 образи, взуття до кожного, нейтральна білизна',
      },
      about: {
        text: 'Ми знімаємо одяг так, як його носять: на вулиці, в русі, з характером. Кожна зйомка починається з історії — кольору, міста, настрою, — а вже потім зі світла й образів.\n\nПрацюємо з брендами, дизайнерами та моделями: від камерних бʼюті-портретів до редакційних сторі й лукбуків. Нам важливо, щоб кадри говорили мовою бренду, а не мовою шаблону.',
        imageId: '',
      },
      moment: { text: 'Червоне і чорне', imageId: '' },
      testimonials: {
        items: [
          {
            names: 'Дизайнерка одягу',
            text: 'Лукбук вийшов саме таким, як ми бачили колекцію: живим, міським і дуже нашим.',
            photoId: '6',
          },
          {
            names: 'Модель',
            text: 'Найспокійніша зйомка в моєму досвіді — чіткий план, і при цьому багато свободи.',
            photoId: '3',
          },
        ],
      },
      pricing: {
        items: [
          { name: 'Бʼюті', price: 'від 8 000 ₴', includes: ['студія', 'візажист', '15 кадрів з ретушшю'] },
          {
            name: 'Фешн-сторі',
            price: 'від 18 000 ₴',
            includes: ['команда й локація', 'до 6 образів', '30 кадрів з ретушшю'],
            featured: true,
          },
          { name: 'Лукбук', price: 'від 12 000 ₴', includes: ['студія або вулиця', 'до 15 образів', 'кадри під каталог'] },
        ],
      },
      contact: { email: 'hello@nota.example', phone: '+380 44 300 00 00', instagram: '@studio.nota', telegram: 'studio_nota', bookingUrl: '' },
    }),
    portfolio: [
      // 1: the cover; 2–10: the magazine pages. No frame is shared with another theme's demo.
      phj('1', 43, 'Фешн-сторі', 'Червоний костюм', true),
      phj('2', 40, 'Фешн-сторі', 'На бордюрі'),
      phj('3', 41, 'Лукбук', 'Брошки'),
      phj('4', 47, 'Лукбук', 'Лукбук'),
      phj('5', 48, 'Фешн-сторі', 'Після дощу'),
      phj('6', 42, 'Портрет', 'Монохром'),
      phj('7', 44, 'Фешн-сторі', 'Вузька вулиця'),
      phj('8', 45, 'Портрет', 'Журнал у руках'),
      phj('9', 46, 'Портрет', 'Тінь і світло'),
      phj('10', 49, 'Лукбук', 'Ліхтар'),
    ],
  },
  {
    value: 'galereia',
    theme: 'galereia',
    mode: 'light',
    name: 'Галерея',
    suits: 'Арт і портрет',
    displayName: 'Анна Світ',
    content: content({
      hero: { title: 'Анна Світ', subtitle: 'Портрет як мистецтво', imageId: '' },
      about: { text: 'Художні портрети, де кожен кадр — окрема робота. Тиша, світло й людина.' },
      pricing: {
        items: [{ name: 'Арт-портрет', price: 'від 7 500 ₴', includes: ['студія', 'концепція', '10 робіт'] }],
      },
      contact: { email: 'anna@example.com', phone: '', instagram: '@anna.svit', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 33, 'Живопис', 'Біла троянда'),
      ph('2', 32, 'Процес', 'Акварель'),
      ph('3', 34, 'Натюрморт', 'Троянди у вазі'),
    ],
  },
  {
    value: 'arkhiv',
    theme: 'arkhiv',
    mode: 'light',
    name: 'Архів',
    suits: 'Документальна зйомка',
    displayName: 'Максим День',
    content: content({
      hero: { title: 'Максим День', subtitle: 'Документую життя як воно є', imageId: '' },
      about: { text: 'Репортаж і документальна зйомка: події, вулиця, справжні миті без постановки.' },
      pricing: {
        items: [{ name: 'Репортаж', price: 'від 10 000 ₴', includes: ['до 6 годин', '200+ кадрів'] }],
      },
      contact: { email: 'maksym@example.com', phone: '+380 50 400 00 00', instagram: '@maksym.day', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 50, 'Люди', 'Погляд'),
      ph('2', 51, 'Місто', 'Пасажири'),
      ph('3', 52, 'Місто', 'Вечірній трамвай'),
      ph('4', 53, 'Люди', 'Втома'),
      ph('5', 54, 'Місто', 'Рух'),
    ],
  },
  {
    value: 'prodakshn',
    theme: 'prodakshn',
    mode: 'light',
    name: 'Продакшн',
    suits: 'Комерційна зйомка, фото + відео',
    displayName: 'Василенко Продакшн',
    content: content({
      hero: { title: 'Фото і відео продакшн для брендів', subtitle: 'Київ · студія 180 м² · знімаємо по всій Європі', imageId: '' },
      about: {
        text: 'Василенко Продакшн — студія комерційної зйомки в Києві. Кампейни, каталоги, музичні відео та діджитал-контент повного циклу.',
      },
      pricing: {
        items: [
          { name: 'Кампейн', price: 'від 40 000 ₴', includes: ['препродакшн', 'команда', 'фото + відео'] },
          { name: 'Каталог', price: 'від 15 000 ₴', includes: ['студія', 'до 120 SKU', 'ретуш'] },
        ],
      },
      contact: { email: 'hello@vasylenko.ua', phone: '+380 44 000 00 00', instagram: '@vasylenko.prod', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 57, 'Кампейни', 'Лінійка догляду'),
      ph('2', 55, 'Продукт', 'Олії'),
      ph('3', 56, 'Кампейни', 'Сет'),
      ph('4', 58, 'Продукт', 'Флакони й тубуси'),
      ph('5', 59, 'Продукт', 'У дії'),
    ],
  },
]
