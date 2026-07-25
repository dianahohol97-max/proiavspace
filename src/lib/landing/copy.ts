import type { Locale } from '@/lib/i18n/config'
import type { GalleryPlanId, SitePlanId } from '@/lib/plans'

/**
 * Marketing landing copy. Kept apart from the app dictionaries — this text
 * is long-form and changes with campaigns, not with UI.
 */

export interface LandingCopy {
  nav: { features: string; galleries: string; sites: string; pricing: string; themes: string; blog: string; signIn: string; ctaShort: string; dashboard: string }
  hero: {
    chips: string[]
    titleBefore: string
    titleAccent: string
    titleAfter: string
    lede: string
    cta: string
    ctaNote: string
    statNumber: string
    statText: string
    slotPay: string
    mockName: string
    mockTitle: string
  }
  strip: { label: string }
  products: {
    label: string
    titleBefore: string
    titleAccent: string
    lede: string
    items: { no: string; title: string; text: string; tagStrong: string; tagRest: string }[]
  }
  bento: {
    label: string
    titleBefore: string
    titleAccent: string
    cards: {
      selection: { label: string; text: string }
      galleryPhoto: string
      protection: { label: string; text: string }
      archive: { label: string; text: string }
      payments: { label: string; text: string }
      stats: { label: string; number: string; text: string }
      themes: { label: string; text: string; chips: string[] }
      previewPhoto: string
      autoRelease: { label: string; text: string }
      video: { label: string; text: string }
      email: { label: string; text: string }
    }
  }
  principles: {
    huge: string
    title: string
    lede: string
    items: { title: string; text: string }[]
  }
  pricing: {
    label: string
    titleBefore: string
    titleAccent: string
    lede: string
    perMonth: string
    freeLabel: string
    yearHint: (year: string) => string
    storage: (gb: number) => string
    popular: string
    fineprint: string
    plans: Record<GalleryPlanId, { name: string; note: string; bullets: string[] }>
    planCta: string
    siteTitle: string
    siteLede: string
    sitePlans: Record<SitePlanId, { name: string; note: string }>
    bundleNote: string
  }
  referral: {
    label: string
    title: string
    lede: string
    steps: string[]
    cta: string
  }
  faq: { label: string; title: string; items: { q: string; a: string }[] }
  final: { label: string; titleBefore: string; titleAccent: string; cta: string }
  footer: { tagline: string; blog: string; terms: string; privacy: string }
}

const uk: LandingCopy = {
  nav: {
    features: 'Можливості',
    galleries: 'Галереї',
    sites: 'Сайти',
    pricing: 'Тарифи',
    themes: 'Теми',
    blog: 'Блог',
    signIn: 'Увійти',
    ctaShort: 'Почати безкоштовно',
    dashboard: 'Кабінет',
  },
  hero: {
    chips: ['Весілля', "Сім'ї", 'Портрети', 'Студії'],
    titleBefore: 'Усе, що стається ',
    titleAccent: 'після',
    titleAfter: ' зйомки',
    lede:
      'Галереї, у яких клієнт одразу розуміє, як забрати фото — без Google Drive і питань «як завантажити». Персональний сайт за вечір і бронювання з оплатою напряму на вашу картку. Скрізь лише ваш бренд.',
    cta: 'Почати безкоштовно',
    ctaNote: '3 ГБ назавжди безкоштовно. Без картки при реєстрації.',
    statNumber: '120 000',
    statText: 'фотографій передано клієнтам через галереї «Прояву»',
    slotPay: 'Оплатити фотографу',
    mockName: 'Олена Романюк',
    mockTitle: 'Весільні історії',
  },
  strip: { label: 'Роботи фотографів' },
  products: {
    label: 'Три продукти · один кабінет',
    titleBefore: 'Кожен етап роботи з клієнтом — ',
    titleAccent: 'під вашим брендом',
    lede:
      'Починається все з галерей — саме там фотограф щотижня зустрічається з клієнтом. Сайт і бронювання підключаються, коли будете готові.',
    items: [
      {
        no: '01 — Галереї',
        title: 'Передавайте зйомки красиво',
        text: 'Завантажуєте фотографії — клієнт отримує красиве посилання й качає сам, без Google Drive і питань «як завантажити». Обране, пароль, термін дії, архів, статистика.',
        tagStrong: 'Оригінали без стискання.',
        tagRest: ' Файли — як зняли',
      },
      {
        no: '02 — Сайти',
        title: 'Сайт-візитівка за вечір',
        text: 'Вісім готових тем — від редакційної «Тиші» до музейної «Галереї». Портфоліо збирається саме з ваших опублікованих зйомок.',
        tagStrong: 'Теми перемикаються',
        tagRest: ' без втрати контенту',
      },
      {
        no: '03 — Бронювання',
        title: 'Клієнт сам обирає час',
        text: 'І одразу оплачує — Monobank, WayForPay, банка чи реквізити. Двоє не заброюють один слот, неоплачені броні звільняються самі.',
        tagStrong: 'Гроші напряму вам.',
        tagRest: ' Ми не торкаємось платежів',
      },
    ],
  },
  bento: {
    label: 'Все в одному кабінеті',
    titleBefore: 'Дрібниці, з яких складається ',
    titleAccent: 'спокійна робота',
    cards: {
      selection: {
        label: 'Відбір',
        text: 'Клієнт сердечком позначає кадри на ретуш — список файлів експортується одним кліком',
      },
      galleryPhoto: 'Галерея',
      protection: { label: 'Захист', text: 'Пароль і термін дії на кожну галерею' },
      archive: { label: 'Архів', text: 'Все однією кнопкою — zip збирається без черг і очікувань' },
      payments: { label: 'Оплати', text: 'Напряму на вашу картку. Завжди.' },
      stats: { label: 'Статистика', number: '247', text: 'переглядів галереї цього тижня' },
      themes: {
        label: 'Теми сайту',
        text: 'Вісім характерів',
        chips: ['Тиша', 'Опівніч', 'Плівка', 'Журнал', 'Архів'],
      },
      previewPhoto: 'Превʼю без втрат швидкості',
      autoRelease: { label: 'Бронювання', text: 'Неоплачений слот звільняється сам за кілька годин' },
      video: {
        label: 'Великі відео',
        text: 'Завантаження частинами: обрив мережі на 95% коштує секунд, а не години',
      },
      email: { label: 'Пошта', text: 'Лист про нову бронь — одразу, з контактами клієнта' },
    },
  },
  principles: {
    huge: 'Принципи',
    title: 'Те, як платформа влаштована зсередини',
    lede: 'Це не список фіч — це рішення, які не переглядаються.',
    items: [
      {
        title: 'Ваш бренд попереду',
        text: 'З першого платного тарифу на галереях і сайтах немає жодної згадки про нас. Клієнт бачить лише фотографа.',
      },
      {
        title: 'Гроші — напряму',
        text: 'Оплати за зйомки йдуть на ваш еквайринг чи картку. Платформа не тримає ваші гроші ні секунди.',
      },
      {
        title: 'Оригінали недоторканні',
        text: 'Файли зберігаються байт у байт. Клієнт переглядає швидкі превʼю, а завантажує повну якість.',
      },
      {
        title: 'Оплата = слово банку',
        text: 'Статус «оплачено» ставиться після перевірки в банку — ніколи зі слів клієнта чи неперевіреного вебхука.',
      },
    ],
  },
  pricing: {
    label: 'Тарифи',
    titleBefore: 'Галереї — за місце, сайти — ',
    titleAccent: 'окремим прайсом',
    lede:
      'Відбір фото клієнтом безкоштовний для всіх. Платні тарифи знімають наш брендинг, додають відео, статистику й більше місця.',
    perMonth: '/ місяць',
    freeLabel: 'назавжди',
    yearHint: (year) => `або ${year} ₴ на рік — два місяці в подарунок`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} ТБ сховища` : `${gb} ГБ сховища`),
    popular: 'Найпопулярніший',
    fineprint:
      'Оплата карткою будь-якого українського банку. Скасувати можна будь-коли — файли лишаються ще 7 днів на повному ліміті, далі просто зупиняється завантаження нових, поки ви над безкоштовним лімітом.',
    plans: {
      free: {
        name: 'Безкоштовний',
        note: 'Для перших галерей і проби пера',
        bullets: ['Відбір фото клієнтом', 'Галереї з паролем і терміном дії', 'Сайт-пробник на 7 днів'],
      },
      basic: {
        name: 'Базовий',
        note: 'Ваш бренд — і лише він',
        bullets: ['Без нашого брендингу', 'Ваше лого в галереї', 'Все з безкоштовного'],
      },
      plus: {
        name: 'Плюс',
        note: 'Для повного робочого сезону',
        bullets: ['Відео в галереях', 'Статистика переглядів', 'Чайові від клієнтів'],
      },
      pro: {
        name: 'Максимальний',
        note: 'Великі архіви та щільний календар',
        bullets: ['Все з Плюса', 'Пріоритетна підтримка', '1 ТБ сховища'],
      },
    },
    planCta: 'Обрати',
    siteTitle: 'Сайти — окремо',
    siteLede:
      'Персональний сайт з власним доменом, SSL і SEO-налаштуваннями. Пробний період — 7 днів безкоштовно.',
    sitePlans: {
      site_trial: { name: 'Пробний', note: '1 сайт на 7 днів' },
      site_basic: { name: 'Базовий', note: '1 сайт · власний домен · SSL · SEO' },
      site_plus: { name: 'Плюс', note: '2+ сайти · мультимовність · все те саме' },
    },
    bundleNote: 'Бандл «Галерея + Сайт» — мінус 15% на сайт, коли активні обидві підписки.',
  },
  referral: {
    label: 'Реферальна програма',
    title: 'Запрошуйте колег — і отримуйте 10% з кожної їхньої оплати',
    lede: 'Поділіться посиланням із фотографом. Коли він оформить платний тариф, вам нараховується 10% кредитом із кожної його оплати — і далі щомісяця. Кредит автоматично зменшує ваш наступний рахунок.',
    steps: [
      'Берете своє посилання в кабінеті.',
      'Колега реєструється за ним і оформлює платний тариф.',
      'Вам щомісяця капає 10% кредитом — автоматично.',
    ],
    cta: 'Отримати посилання',
  },
  faq: {
    label: 'Питання, які ставлять найчастіше',
    title: 'Коротко про важливе',
    items: [
      {
        q: 'Чи бачать клієнти, що галерея зроблена на «Прояві»?',
        a: "На безкоштовному тарифі внизу галереї стоїть маленький підпис «Створено на Прояві». Уже з Базового його немає: на сторінках — лише ваше ім'я, ваш логотип і ваші фотографії.",
      },
      {
        q: 'Через кого проходять гроші за зйомки?',
        a: 'Повз нас. Рахунок створюється на вашому еквайрингу Monobank чи WayForPay, ручні способи — це ваша банка чи картка. Ми лише показуємо клієнту кнопку і звіряємо статус оплати з банком.',
      },
      {
        q: 'Що станеться з файлами, якщо я скасую підписку?',
        a: 'Нічого страшного. Файли не видаляються — знижується лише ліміт, тож нові завантаження зупиняться, поки ви над ним. Завантажити своє ви можете завжди.',
      },
      {
        q: 'Чи стискаються мої фотографії?',
        a: 'Оригінали зберігаються байт у байт як завантажені. Для швидкого перегляду клієнт бачить згенеровані превʼю, але кнопка завантаження завжди віддає оригінал.',
      },
    ],
  },
  final: {
    label: 'Почніть із однієї галереї',
    titleBefore: 'Наступну зйомку віддайте клієнту ',
    titleAccent: 'красиво',
    cta: 'Створити безкоштовний акаунт',
  },
  footer: {
    tagline: 'Галереї · Сайти · Бронювання — для фотографів України',
    blog: 'Блог',
    terms: 'Публічна оферта',
    privacy: 'Політика конфіденційності',
  },
}

const en: LandingCopy = {
  nav: { features: 'Features', galleries: 'Galleries', sites: 'Sites', pricing: 'Pricing', themes: 'Themes', blog: 'Blog', signIn: 'Sign in', ctaShort: 'Start for free', dashboard: 'Dashboard' },
  hero: {
    chips: ['Weddings', 'Families', 'Portraits', 'Studios'],
    titleBefore: 'Everything that happens ',
    titleAccent: 'after',
    titleAfter: ' the shutter clicks',
    lede:
      'Galleries where the client instantly knows how to grab their photos — no Google Drive, no "how do I download this?". A personal site built in an evening, and bookings paid straight to your card. Your brand everywhere.',
    cta: 'Start for free',
    ctaNote: '3 GB free forever. No card at sign-up.',
    statNumber: '120 000',
    statText: 'photos delivered to clients through Proiav galleries',
    slotPay: 'Pay the photographer',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Wedding stories',
  },
  strip: { label: 'Photographers’ work' },
  products: {
    label: 'Three products · one dashboard',
    titleBefore: 'Every step of client work — ',
    titleAccent: 'under your brand',
    lede:
      'It all starts with galleries — that is where a photographer meets clients every week. The site and booking join in when you are ready.',
    items: [
      {
        no: '01 — Galleries',
        title: 'Deliver shoots beautifully',
        text: 'Upload the photos — the client gets a beautiful link and downloads on their own, no Google Drive and no "how do I download this?". Favorites, password, expiry, zip, stats.',
        tagStrong: 'Originals uncompressed.',
        tagRest: ' Files exactly as shot',
      },
      {
        no: '02 — Sites',
        title: 'A personal site in an evening',
        text: 'Eight ready themes — from the editorial Tysha to the museum-like Galereia. The portfolio assembles from your published shoots.',
        tagStrong: 'Themes switch',
        tagRest: ' without losing content',
      },
      {
        no: '03 — Booking',
        title: 'Clients pick their own time',
        text: 'And pay right away — Monobank, WayForPay, a jar or requisites. No double-booking, unpaid holds release themselves.',
        tagStrong: 'Money goes straight to you.',
        tagRest: ' We never touch payments',
      },
    ],
  },
  bento: {
    label: 'All in one dashboard',
    titleBefore: 'The small things that make work ',
    titleAccent: 'calm',
    cards: {
      selection: {
        label: 'Selection',
        text: 'Clients heart the frames for retouching — export the file list in one click',
      },
      galleryPhoto: 'Gallery',
      protection: { label: 'Protection', text: 'Password and expiry on every gallery' },
      archive: { label: 'Archive', text: 'Everything in one click — the zip builds with no queues' },
      payments: { label: 'Payments', text: 'Straight to your card. Always.' },
      stats: { label: 'Stats', number: '247', text: 'gallery views this week' },
      themes: {
        label: 'Site themes',
        text: 'Eight characters',
        chips: ['Tysha', 'Opivnich', 'Plivka', 'Zhurnal', 'Arkhiv'],
      },
      previewPhoto: 'Previews with zero speed loss',
      autoRelease: { label: 'Booking', text: 'An unpaid slot frees itself after a few hours' },
      video: {
        label: 'Large videos',
        text: 'Chunked uploads: a network drop at 95% costs seconds, not hours',
      },
      email: { label: 'Email', text: 'A new-booking email arrives instantly with client contacts' },
    },
  },
  principles: {
    huge: 'Principles',
    title: 'How the platform is built inside',
    lede: 'Not a feature list — decisions that do not get revisited.',
    items: [
      {
        title: 'Your brand up front',
        text: 'From the first paid tier, galleries and sites never mention us. The client sees only the photographer.',
      },
      {
        title: 'Money goes direct',
        text: 'Shoot payments land on your acquiring or card. The platform never holds your money for a second.',
      },
      {
        title: 'Originals are untouchable',
        text: 'Files are stored byte for byte. Clients browse fast previews and download full quality.',
      },
      {
        title: 'Payment = the bank’s word',
        text: 'The “paid” status is set after verifying with the bank — never from the client’s words or an unverified webhook.',
      },
    ],
  },
  pricing: {
    label: 'Pricing',
    titleBefore: 'Galleries by storage, sites — ',
    titleAccent: 'priced separately',
    lede:
      'Client photo selection is free for everyone. Paid tiers remove our branding and add video, statistics and more room.',
    perMonth: '/ month',
    freeLabel: 'forever',
    yearHint: (year) => `or ${year} ₴ per year — two months free`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB of storage` : `${gb} GB of storage`),
    popular: 'Most popular',
    fineprint:
      'Pay with any Ukrainian bank card. Cancel anytime — files keep full limits for 7 more days, then new uploads pause while you are over the free limit.',
    plans: {
      free: {
        name: 'Free',
        note: 'For your first galleries',
        bullets: ['Client photo selection', 'Password & expiry on galleries', 'A trial site for 7 days'],
      },
      basic: {
        name: 'Basic',
        note: 'Your brand — and only yours',
        bullets: ['No our branding', 'Your logo in galleries', 'Everything in Free'],
      },
      plus: {
        name: 'Plus',
        note: 'For a full working season',
        bullets: ['Video in galleries', 'View statistics', 'Client tips'],
      },
      pro: {
        name: 'Maximum',
        note: 'Large archives and a dense calendar',
        bullets: ['Everything in Plus', 'Priority support', '1 TB of storage'],
      },
    },
    planCta: 'Choose',
    siteTitle: 'Sites — separately',
    siteLede: 'A personal site with a custom domain, SSL and SEO. A 7-day free trial.',
    sitePlans: {
      site_trial: { name: 'Trial', note: '1 site for 7 days' },
      site_basic: { name: 'Basic', note: '1 site · custom domain · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2+ sites · multilingual · all the same' },
    },
    bundleNote: 'Gallery + Site bundle — 15% off the site while both subscriptions are active.',
  },
  referral: {
    label: 'Referral program',
    title: 'Invite colleagues — earn 10% of every payment they make',
    lede: 'Share your link with a photographer. When they take a paid plan, you earn 10% credit from each of their payments — every month. The credit automatically reduces your next invoice.',
    steps: [
      'Grab your link in the dashboard.',
      'A colleague signs up with it and takes a paid plan.',
      'You earn 10% credit every month — automatically.',
    ],
    cta: 'Get your link',
  },
  faq: {
    label: 'Frequently asked',
    title: 'The important bits, briefly',
    items: [
      {
        q: 'Do clients see the gallery is made on Proiav?',
        a: 'On the free tier a small “Made with Proiav” note sits at the bottom of the gallery. From Basic up it is gone: pages carry only your name, your logo and your photos.',
      },
      {
        q: 'Who do shoot payments go through?',
        a: 'Past us. Invoices are created on your own Monobank or WayForPay merchant; manual methods are your jar or card. We only show the button and verify the status with the bank.',
      },
      {
        q: 'What happens to files if I cancel?',
        a: 'Nothing scary. Files are not deleted — only the limit drops, so new uploads pause while you are over it. You can always download what is yours.',
      },
      {
        q: 'Are my photos compressed?',
        a: 'Originals are stored byte for byte. Clients browse generated previews, but the download button always serves the original.',
      },
    ],
  },
  final: {
    label: 'Start with one gallery',
    titleBefore: 'Deliver your next shoot ',
    titleAccent: 'beautifully',
    cta: 'Create a free account',
  },
  footer: {
    tagline: 'Galleries · Sites · Booking — for photographers in Ukraine',
    blog: 'Blog',
    terms: 'Public offer',
    privacy: 'Privacy policy',
  },
}

export function getLandingCopy(locale: Locale): LandingCopy {
  // Only Ukrainian is fully authored for marketing; every other locale gets
  // English (client languages don't have a translated landing page).
  return locale === 'uk' ? uk : en
}
