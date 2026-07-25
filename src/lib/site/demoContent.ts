import type { SiteContent } from './content'
import type { ThemeId, SiteMode } from './themes'
import type { PortfolioItem } from '@/components/site/SiteRenderer'

/**
 * Filled demo content for the public «Теми» showcase — one realistic sample
 * site per theme, with generated photos in /public/themes. Ukrainian copy;
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

function img(n: number): string {
  return `/themes/${String(n).padStart(2, '0')}.jpg`
}
function ph(id: string, n: number, category: string, caption = ''): PortfolioItem {
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
      ph('1', 1, 'Весілля', 'Марта і Богдан'),
      ph('2', 13, 'Весілля', 'У полі на заході'),
      ph('3', 15, 'Весілля', 'Перший танець'),
      ph('4', 14, 'Деталі', 'Букет нареченої'),
      ph('5', 16, 'Деталі', 'Обручки й обітниці'),
      ph('6', 17, 'Емоції', 'Побачив наречену'),
      ph('7', 11, 'Пари', 'Заручини'),
      ph('8', 18, 'Сімейні', 'Перші дні'),
      ph('9', 19, 'Сімейні', 'Осінь у парку'),
      ph('10', 5, 'Портрети'),
      ph('11', 7, 'Портрети'),
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
      ph('1', 35, 'Вечірні', 'Бенгальські вогні'),
      ph('2', 36, 'Вечірні', 'Місто вночі'),
      ph('3', 3, 'Вечірні', 'При свічках'),
      ph('4', 15, 'Весілля', 'Перший танець'),
      ph('5', 23, 'Портрети'),
      ph('6', 33, 'Портрети'),
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
      ph('1', 18, 'Сімейні', 'Ранок удома'),
      ph('2', 19, 'Сімейні', 'Осінь у парку'),
      ph('3', 20, 'Пари', 'Разом на кухні'),
      ph('4', 32, 'Портрети', 'Біля вікна'),
      ph('5', 4, 'Сімейні'),
      ph('6', 12, 'Діти'),
      ph('7', 11, 'Пари'),
      ph('8', 7, 'Портрети'),
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
      ph('1', 25, 'Історії', 'Дощ у місті'),
      ph('2', 32, 'Портрети', 'Біля вікна'),
      ph('3', 34, 'Портрети', 'Профіль'),
      ph('4', 14, 'Деталі'),
      ph('5', 5, 'Портрети'),
      ph('6', 7, 'Портрети'),
      ph('7', 11, 'Пари'),
      ph('8', 4, 'Історії'),
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
      ph('1', 21, 'Бʼюті', 'Чиста шкіра'),
      ph('2', 22, 'Фешн', 'У русі'),
      ph('3', 23, 'Фешн', 'Контраст'),
      ph('4', 34, 'Портрети'),
      ph('5', 31, 'Стиль життя', 'Смак'),
      ph('6', 6, 'Фешн'),
      ph('7', 9, 'Фешн'),
      ph('8', 5, 'Бʼюті'),
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
    portfolio: [ph('1', 7, 'Портрети'), ph('2', 5, 'Портрети'), ph('3', 10, 'Натюрморт'), ph('4', 11, 'Пари')],
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
      ph('1', 25, 'Вулиця', 'Дощ у місті'),
      ph('2', 26, 'Репортаж', 'За лаштунками'),
      ph('3', 27, 'Події', 'Тост'),
      ph('4', 33, 'Люди'),
      ph('5', 17, 'Емоції'),
      ph('6', 8, 'Вулиця'),
      ph('7', 4, 'Події'),
      ph('8', 11, 'Люди'),
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
      ph('1', 28, 'Каталоги', 'Кераміка — 120 SKU'),
      ph('2', 29, 'Продукт', 'Парфум'),
      ph('3', 30, 'Каталоги', 'Трикотаж'),
      ph('4', 31, 'Фуд', 'Сезонне меню'),
      ph('5', 24, 'Кампейни', 'Кампейн'),
      ph('6', 9, 'Кампейни', 'Кампейн «Ковчег»'),
      ph('7', 10, 'Каталоги'),
      ph('8', 6, 'Фешн', 'Лукбук FW26'),
    ],
  },
]
