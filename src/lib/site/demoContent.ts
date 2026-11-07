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

function content(
  partial: Omit<Partial<SiteContent>, 'about'> &
    Pick<SiteContent, 'hero' | 'pricing' | 'contact'> & { about: { text: string; imageId?: string } }
): SiteContent {
  return {
    albumCovers: {},
    translations: {},
    settings: { languages: [], leadForm: true, booking: false },
    moment: { text: '', imageId: '' },
    process: { steps: [] },
    testimonials: { items: [] },
    ...partial,
    about: { imageId: '', ...partial.about },
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
      hero: { title: 'Ольга Вишня', subtitle: 'Весільні історії у вашому темпі', imageId: '1' },
      about: {
        text: 'Я знімаю весілля такими, якими їх памʼятають самі наречені: світло крізь фіранку, мамині руки, що поправляють фату, тиша перед першим «так». Не ставлю в пози — спостерігаю й допомагаю почуватися вільно.',
        imageId: '17',
      },
      moment: { text: 'Найцінніше — між кадрами', imageId: '15' },
      process: {
        steps: [
          {
            title: 'Знайомство',
            text: 'Зідзвонюємося або зустрічаємося на каву. Ви розповідаєте про свій день, я — про те, як працюю. Без поспіху й зобовʼязань.',
          },
          {
            title: 'Підготовка',
            text: 'Разом складаємо таймінг, обираємо локації та час із найкращим світлом. За тиждень до зйомки надсилаю короткий план дня.',
          },
          {
            title: 'Зйомка',
            text: 'Я поруч, але не заважаю: більше спостерігаю, ніж керую. Підказую лише там, де це справді допомагає.',
          },
          {
            title: 'Галерея',
            text: 'Спершу — кілька кадрів, щоб поділитися з рідними. Потім — повна онлайн-галерея з оригіналами, яку зручно переглядати й завантажувати.',
          },
        ],
      },
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
      contact: { email: 'olga@example.com', phone: '+380 67 100 00 00', instagram: '@olga.vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      // 1–4: landscape frames for the hero; then the grid's rhythm
      // (landscape, portrait, portrait, landscape, landscape, portrait…).
      phw('1', '/themes/07', 'Весілля', 'Марта і Богдан', [2000, 1335]),
      phw('2', '/themes/15', 'Весілля', 'Дорога в гори', [2000, 1335]),
      phw('3', '/themes/12', 'Весілля', 'Червоний дім на пагорбі', [2000, 1335]),
      phw('4', '/themes/04', 'Весілля', 'Дорога додому', [2000, 1335]),
      phw('5', '/themes/01', 'Весілля', 'Біля старого паркану', [2000, 1335]),
      phw('6', '/themes/18', 'Пари', 'Тільки ми', [1335, 2000]),
      phw('7', '/themes/13', 'Пари', 'Серед трав', [1335, 2000]),
      phw('8', '/themes/16', 'Весілля', 'Перший погляд', [2000, 1335]),
      phw('9', '/themes/20', 'Весілля', 'Удвох', [2000, 1335]),
      phw('10', '/showcase/01', 'Пари', 'Ліс після дощу', [1333, 2000]),
      phw('11', '/themes/05', 'Весілля', 'Під горами', [2000, 1335]),
      phw('12', '/themes/06', 'Весілля', 'Вітер з гір', [1335, 2000]),
      phw('13', '/showcase/09', 'Сімейні', 'Велика родина', [1333, 2000]),
      phw('14', '/themes/23', 'Весілля', 'Червоні дахи', [2000, 1335]),
      phw('15', '/showcase/16', 'Портрети', 'Золота година', [2000, 1333]),
      phw('16', '/showcase/14', 'Сімейні', 'На татових плечах', [1333, 2000]),
      phw('17', '/showcase/08', 'Портрети', 'Біля вікна', [1333, 2000]),
      phw('18', '/showcase/03', 'Пари', 'Липневе світло', [1333, 2000]),
      phw('19', '/showcase/04', 'Сімейні', 'Неділя в полі', [1333, 2000]),
      phw('20', '/showcase/07', 'Сімейні', 'Перше літо', [1333, 2000]),
      phw('21', '/showcase/06', 'Портрети', 'Вечірнє світло', [1333, 2000]),
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
      hero: { title: 'Ольга Вишня', subtitle: 'Світло, що зʼявляється в темряві', imageId: '1' },
      about: {
        text: 'Я люблю вечір: гірлянди, свічки, бенгальські вогні й обличчя, на які падає тепле світло. Там, де інші вимикають камеру, для мене починається найцікавіше — темрява робить кожен кадр тихішим і чеснішим.',
        imageId: '11',
      },
      moment: { text: 'Вогні гаснуть — кадри лишаються', imageId: '' },
      process: {
        steps: [
          {
            title: 'Розмова про вечір',
            text: 'Дізнаюся, яким ви бачите свято після заходу сонця: гірлянди, свічки, перший танець, вогні наприкінці.',
          },
          {
            title: 'План світла',
            text: 'Разом із координатором продумуємо, де буде тепле світло і в який момент запалити бенгальські вогні.',
          },
          {
            title: 'Вечірня зйомка',
            text: 'Працюю з живим світлом і мінімумом спалахів, щоб зберегти атмосферу вечора такою, якою ви її відчували.',
          },
          {
            title: 'Галерея',
            text: 'Кольори доводжу вручну, щоб зберегти теплі тони і глибокі тіні. Готову онлайн-галерею з оригіналами зручно переглядати й завантажувати.',
          },
        ],
      },
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
      contact: { email: 'olga@example.com', phone: '+380 67 100 00 00', instagram: '@olga.vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      // 1: hero; 2–10: the grid's rhythm (pair, trio, pause, trio); 11: the
      // photographer's portrait; the rest feed the strip of lights.
      phn('1', '/themes/25', 'Вечірні весілля', 'Коридор із вогнів', [2000, 1333], true),
      phn('2', '/themes/26', 'Вечірні весілля', 'Перший танець під гірляндами', [2000, 1335]),
      phn('3', '/themes/27', 'Вечірні весілля', 'Поцілунок під іскрами', [1333, 2000]),
      phn('4', '/themes/29', 'Вечірні весілля', 'Сукня в іскрах', [1333, 2000]),
      phn('5', '/themes/28', 'Вечірні весілля', 'Щасливі', [1333, 2000]),
      phn('6', '/themes/38', 'Свічки й портрети', 'Тепло на обличчі', [1416, 2000]),
      phn('7', '/themes/30', 'Світло і тінь', 'Остання година сонця', [2000, 1374]),
      phn('8', '/themes/39', 'Свічки й портрети', 'Вікно у вечір', [1600, 2000]),
      phn('9', '/showcase/02', 'Свічки й портрети', 'Промінь', [1333, 2000]),
      phn('10', '/showcase/08', 'Свічки й портрети', 'Біля вікна', [1333, 2000]),
      phn('11', '/showcase/06', 'Світло і тінь', 'Портрет', [1333, 2000]),
      phn('12', '/themes/37', 'Свічки й портрети', 'Червоне світло', [2000, 1333]),
      phn('13', '/showcase/16', 'Світло і тінь', 'Крізь листя', [2000, 1333]),
      phn('14', '/themes/35', 'Свічки й портрети', 'Вогні міста', [1333, 2000]),
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
      hero: { title: 'Ірина Літо', subtitle: 'Легкі сімейні історії', imageId: '' },
      about: { text: 'Світлі, повітряні кадри про звичайне щастя: сімʼї, діти, ранки вдома.' },
      pricing: {
        items: [
          { name: 'Прогулянка', price: 'від 4 500 ₴', includes: ['1 година', '40 кадрів'] },
          { name: 'Lifestyle вдома', price: 'від 7 000 ₴', includes: ['2 години', '80 кадрів'] },
        ],
      },
      contact: { email: 'iryna@example.com', phone: '+380 63 200 00 00', instagram: '@iryna.lito', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 31, 'Діти', 'Босоніж до сонця'),
      ph('2', 30, 'Сімейні', 'Вечір біля озера'),
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
      hero: { title: 'Studio Nota', subtitle: 'Фешн, бʼюті, редакційна зйомка', imageId: '' },
      about: { text: 'Редакційні та рекламні зйомки для брендів і моделей. Стиль, світло, характер.' },
      pricing: {
        items: [
          { name: 'Бʼюті', price: 'від 8 000 ₴', includes: ['студія', 'візаж', '15 кадрів'] },
          { name: 'Фешн-стори', price: 'від 18 000 ₴', includes: ['команда', 'локація', 'ретуш'] },
        ],
      },
      contact: { email: 'hello@nota.example', phone: '+380 44 300 00 00', instagram: '@studio.nota', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 43, 'Фешн', 'Червоний костюм'),
      ph('2', 42, 'Фешн', 'Monochrome'),
      ph('3', 41, 'Деталі', 'Брошки'),
      ph('4', 40, 'Фешн', 'На бордюрі'),
      ph('5', 44, 'Фешн', 'Вузька вулиця'),
      ph('6', 48, 'Портрети'),
      ph('7', 45, 'Фешн'),
      ph('8', 47, 'Фешн', 'Лукбук'),
      ph('9', 46, 'Портрети'),
      ph('10', 49, 'Фешн'),
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
