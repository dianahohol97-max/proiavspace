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

function content(
  partial: Partial<SiteContent> & Pick<SiteContent, 'hero' | 'about' | 'pricing' | 'contact'>
): SiteContent {
  return {
    albumCovers: {},
    translations: {},
    settings: { languages: [], leadForm: true, booking: false },
    ...partial,
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
        text: 'Знімаю весілля девʼятий рік. Люблю природне світло, тихі моменти між кадрами й щирі емоції, які лишаються з вами назавжди.',
      },
      pricing: {
        items: [
          { name: 'Ранок нареченої', price: 'від 9 000 ₴', includes: ['3 години', '60 кадрів', 'онлайн-галерея'] },
          { name: 'Весільний день', price: 'від 26 000 ₴', includes: ['до 12 годин', '600+ кадрів', 'фотокнига'] },
        ],
      },
      contact: { email: 'olga@example.com', phone: '+380 67 100 00 00', instagram: '@olga.vyshnia', bookingUrl: '' },
    }),
    portfolio: [
      ph('1', 7, 'Весілля', 'Марта і Богдан'),
      ph('2', 1, 'Весілля', 'Біля старого паркану'),
      ph('3', 15, 'Весілля', 'Дорога в гори'),
      ph('4', 18, 'Пари', 'Тільки ми'),
      ph('5', 12, 'Весілля', 'Червоний дім на пагорбі'),
      ph('6', 4, 'Емоції', 'Біжимо'),
      ph('7', 13, 'Пари', 'Серед трав'),
      ph('8', '/showcase/09.jpg', 'Сімейні', 'Велика родина'),
      ph('9', '/showcase/14.jpg', 'Сімейні', 'На татових плечах'),
      ph('10', '/showcase/06.jpg', 'Портрети'),
      ph('11', '/showcase/02.jpg', 'Портрети'),
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
