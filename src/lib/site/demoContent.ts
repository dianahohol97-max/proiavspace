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

/** «Тиша» demo photos: the lighter .webp copies keep the demo's LCP honest. */
function phw(id: string, path: string, category: string, caption = ''): PortfolioItem {
  return { id, previewUrl: `${path}.webp`, visible: true, category, caption }
}

function content(
  partial: Omit<Partial<SiteContent>, 'about'> &
    Pick<SiteContent, 'hero' | 'pricing' | 'contact'> & { about: { text: string; imageId?: string } }
): SiteContent {
  return {
    albumCovers: {},
    translations: {},
    settings: { languages: [], leadForm: true, booking: false },
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
      albumCovers: { Весілля: '12', Пари: '6', Сімейні: '13', Портрети: '15' },
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
      phw('1', '/themes/07', 'Весілля', 'Марта і Богдан'),
      phw('2', '/themes/15', 'Весілля', 'Дорога в гори'),
      phw('3', '/themes/12', 'Весілля', 'Червоний дім на пагорбі'),
      phw('4', '/themes/04', 'Весілля', 'Дорога додому'),
      phw('5', '/themes/01', 'Весілля', 'Біля старого паркану'),
      phw('6', '/themes/18', 'Пари', 'Тільки ми'),
      phw('7', '/themes/13', 'Пари', 'Серед трав'),
      phw('8', '/themes/16', 'Весілля', 'Перший погляд'),
      phw('9', '/themes/20', 'Весілля', 'Удвох'),
      phw('10', '/showcase/01', 'Пари', 'Ліс після дощу'),
      phw('11', '/themes/05', 'Весілля', 'Під горами'),
      phw('12', '/themes/06', 'Весілля', 'Вітер з гір'),
      phw('13', '/showcase/09', 'Сімейні', 'Велика родина'),
      phw('14', '/themes/23', 'Весілля', 'Червоні дахи'),
      phw('15', '/showcase/16', 'Портрети', 'Золота година'),
      phw('16', '/showcase/14', 'Сімейні', 'На татових плечах'),
      phw('17', '/showcase/08', 'Портрети', 'Біля вікна'),
      phw('18', '/showcase/03', 'Пари', 'Липневе світло'),
      phw('19', '/showcase/04', 'Сімейні', 'Неділя в полі'),
      phw('20', '/showcase/07', 'Сімейні', 'Перше літо'),
      phw('21', '/showcase/06', 'Портрети', 'Вечірнє світло'),
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
      about: { text: 'Вечірні весілля, зйомки при свічках і мистецькі портрети — там, де темрява стає драмою.' },
      pricing: {
        items: [
          { name: 'Вечірня зйомка', price: 'від 12 000 ₴', includes: ['4 години', 'нічний блок', 'кольорокорекція'] },
        ],
      },
      contact: { email: 'olga@example.com', phone: '', instagram: '@olga.vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 26, 'Вечірні', 'Перший танець під гірляндами'),
      ph('2', 25, 'Вечірні', 'Коридор із вогнів'),
      ph('3', 27, 'Весілля', 'Поцілунок під іскрами'),
      ph('4', 28, 'Весілля', 'Щасливі'),
      ph('5', 29, 'Вечірні', 'Сукня в іскрах'),
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
