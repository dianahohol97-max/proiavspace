import type { Locale } from '@/lib/i18n/config'
import type { GalleryPlanId } from '@/lib/plans'

/**
 * Marketing landing copy. Kept apart from the app dictionaries — this text
 * is long-form and changes with campaigns, not with UI.
 */

export interface LandingCopy {
  nav: { features: string; galleries: string; pricing: string; themes: string; blog: string; signIn: string; ctaShort: string; dashboard: string }
  hero: {
    chips: string[]
    titleBefore: string
    titleAccent: string
    titleAfter: string
    /** Keyword-bearing line right under the H1. */
    subtitle: string
    lede: string
    cta: string
    ctaNote: string
    statNumber: string
    statText: string
    /** Hero card: the client's «Shoot → Editing → Ready» status. */
    status: { steps: [string, string, string]; now: string; eta: string }
    mockName: string
    mockTitle: string
  }
  strip: { label: string }
  products: {
    label: string
    titleBefore: string
    titleAccent: string
    lede: string
    gallery: { no: string; title: string; text: string; tagStrong: string; tagRest: string }
    /** New gallery features, each shown with a real screenshot of the interface. */
    features: { no: string; title: string; text: string; tagStrong: string; tagRest: string; alt: string }[]
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
      watermark: { label: string; text: string }
      stats: { label: string; number: string; text: string }
      themes: { label: string; text: string; chips: string[] }
      previewPhoto: string
      slideshow: { label: string; text: string }
      video: { label: string; text: string }
      languages: { label: string; text: string }
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
  footer: { tagline: string; blog: string; terms: string; privacy: string; support: string }
}

const uk: LandingCopy = {
  nav: {
    features: 'Можливості',
    galleries: 'Галереї',
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
    subtitle: 'Онлайн-галерея для фотографа: передайте фото клієнту одним красивим посиланням.',
    lede:
      'Галереї, у яких клієнт одразу розуміє, як забрати фото — без Google Drive і питань «як завантажити». Відбір кадрів сердечками, пароль і термін дії, оригінали без стискання. Скрізь лише ваш бренд.',
    cta: 'Почати безкоштовно',
    ctaNote: '3 ГБ безкоштовно, кожна галерея відкрита 30 днів. Без картки.',
    statNumber: '30 000',
    statText: 'фотографій передано клієнтам через галереї проЯв',
    status: { steps: ['Зйомка', 'Обробка', 'Готово'], now: 'зараз', eta: 'Орієнтовно до 14 грудня' },
    mockName: 'Олена Романюк',
    mockTitle: 'Весільні історії',
  },
  strip: { label: 'Роботи фотографів' },
  products: {
    label: 'Галереї · відбір · статус зйомки',
    titleBefore: 'Клієнтська галерея для фотографа — ',
    titleAccent: 'під вашим брендом',
    lede:
      'Усе починається з галереї — саме там фотограф щотижня зустрічається з клієнтом. Нове в галереях: відбір браку, статус зйомки для клієнта й завантаження, яке переживає обрив звʼязку. Нижче — справжні екрани.',
    gallery: {
      no: '01 — Галереї',
      title: 'Передавайте зйомки красиво',
      text: 'Завантажуєте фотографії — клієнт отримує красиве посилання й качає сам, без Google Drive і питань «як завантажити». Обране, пароль, термін дії, архів, статистика.',
      tagStrong: 'Оригінали без стискання.',
      tagRest: ' Файли — як зняли',
    },
    features: [
      {
        no: '02 — AI-відбір',
        title: 'Брак підсвічується, рішення — ваше',
        text: 'Розмиті кадри, повтори в серіях і заплющені очі позначаються автоматично, кращий кадр серії видно поруч з іншими. Аналіз іде у вашому браузері — фото нікуди не надсилаються.',
        tagStrong: 'Нічого не ховається само.',
        tagRest: ' Кадр зникає для клієнта, лише коли ви це підтвердите',
        alt: 'Панель «Відбір кадрів»: позначки «Повтор» і «Розмито» на кадрах і фільтр «Потенційний брак»',
      },
      {
        no: '03 — Статус зйомки',
        title: 'Клієнт бачить, де зараз його фото',
        text: 'Поки галерея порожня, за тим самим посиланням клієнт бачить етапи «Зйомка → Обробка → Готово» і орієнтовну дату, якщо ви її вказали. Щойно фото готові — на тому ж місці відкривається галерея.',
        tagStrong: 'Один перемикач у кабінеті.',
        tagRest: ' Зміни видно клієнту одразу',
        alt: 'Екран статусу для клієнта: «Ваші кадри вже в роботі», етап «Обробка» і орієнтовна дата',
      },
      {
        no: '04 — Надійне завантаження',
        title: 'Обрив звʼязку — не з нуля',
        text: 'Великі файли йдуть частинами по 8 МБ. Зникла мережа — завантаження чекає й продовжує саме. Закрили вкладку — оберіть ті самі файли, і вони докачаються з місця зупинки.',
        tagStrong: 'Повторюється лише недокачана частина,',
        tagRest: ' а не весь файл',
        alt: 'Завантажувач галереї без мережі: фото вже завантажені, відео чекають на звʼязок',
      },
    ],
  },
  bento: {
    label: 'Все в одному кабінеті',
    titleBefore: 'Галерея з паролем, відбором і zip — ',
    titleAccent: 'дрібниці спокійної роботи',
    cards: {
      selection: {
        label: 'Відбір',
        text: 'Клієнт сердечком позначає кадри на ретуш — список файлів експортується одним кліком',
      },
      galleryPhoto: 'Галерея',
      protection: { label: 'Захист', text: 'Пароль і термін дії на кожну галерею' },
      archive: { label: 'Архів', text: 'Все однією кнопкою — zip збирається без черг і очікувань' },
      watermark: { label: 'Водяний знак', text: 'Ваше імʼя на превʼю. Оригінали — чисті' },
      stats: { label: 'Статистика', number: '247', text: 'переглядів галереї цього тижня' },
      themes: {
        label: 'Дизайн галереї',
        text: 'Три настрої й пʼять розкладок',
        chips: ['Мозаїка', 'Колаж', 'Едіторіал', 'Квадрати', 'Портрет 3:4'],
      },
      previewPhoto: 'Превʼю без втрат швидкості',
      slideshow: { label: 'Перегляд', text: 'Повноекранний лайтбокс і слайдшоу — і на телефоні' },
      video: {
        label: 'Відео',
        text: 'Ролики поруч із фото в тій самій галереї — з тарифу «Базовий»',
      },
      languages: { label: 'Мови', text: 'Клієнт перемикає галерею на свою мову — їх девʼять' },
    },
  },
  principles: {
    huge: 'Принципи',
    title: 'Те, як платформа влаштована зсередини',
    lede: 'Це не список фіч — це рішення, які не переглядаються.',
    items: [
      {
        title: 'Ваш бренд попереду',
        text: 'З першого платного тарифу в галереях немає жодної згадки про нас. Клієнт бачить лише фотографа.',
      },
      {
        title: 'Рішення — за фотографом',
        text: 'Автоматика лише підказує. Жоден кадр не ховається від клієнта, поки ви це не підтвердите.',
      },
      {
        title: 'Оригінали недоторканні',
        text: 'Файли зберігаються байт у байт. Клієнт переглядає швидкі превʼю, а завантажує повну якість.',
      },
      {
        title: 'Кадри не їдуть на аналіз',
        text: 'Відбір рахується у вашому браузері. Фото не передаються стороннім сервісам, навіть модель облич вантажиться з нашого сервера.',
      },
    ],
  },
  pricing: {
    label: 'Тарифи',
    titleBefore: 'Тарифи онлайн-галереї: ',
    titleAccent: 'платите лише за місце',
    lede:
      'Відбір фото клієнтом безкоштовний для всіх. Платні тарифи знімають наш брендинг і додають відео та більше місця, а з Плюса — статистику.',
    perMonth: '/ місяць',
    freeLabel: 'без картки',
    yearHint: (year) => `або ${year} ₴ на рік — два місяці в подарунок`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} ТБ сховища` : `${gb} ГБ сховища`),
    popular: 'Рекомендуємо',
    fineprint:
      'Оплата карткою будь-якого українського банку. Скасувати можна будь-коли — ще 14 днів усе працює на повному ліміті. Далі, якщо ви понад безкоштовні 3 ГБ, галереї закриваються для клієнтів, а файли зберігаються ще 60 днів.',
    plans: {
      free: {
        name: 'Безкоштовний',
        note: 'Кожна галерея відкрита 30 днів — щоб спробувати',
        bullets: ['Відбір фото клієнтом', 'Галереї з паролем і терміном дії', 'Без обмеження кількості галерей'],
      },
      basic: {
        name: 'Базовий',
        note: 'Ваш бренд — і лише він',
        bullets: ['Без нашого брендингу', 'Ваше лого в галереї', 'Відео в галереях'],
      },
      plus: {
        name: 'Плюс',
        note: 'Для повного робочого сезону',
        bullets: ['Все з Базового', 'Статистика переглядів', 'Чайові від клієнтів'],
      },
      pro: {
        name: 'Максимальний',
        note: 'Великі архіви й насичений сезон',
        bullets: ['Все з Плюса', 'Пріоритетна підтримка', '1 ТБ сховища'],
      },
    },
    planCta: 'Обрати',
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
    title: 'Питання про онлайн-галереї проЯв',
    items: [
      {
        q: 'Чи бачать клієнти, що галерея зроблена на проЯв?',
        a: "На безкоштовному тарифі внизу галереї стоїть маленький підпис «Створено на проЯв». Уже з Базового його немає: на сторінках — лише ваше ім'я, ваш логотип і ваші фотографії.",
      },
      {
        q: 'Чи може AI-відбір сам сховати або видалити кадри?',
        a: 'Ні. Він лише позначає ймовірний брак: розмиті кадри, повтори в серіях, заплющені очі. Від клієнта ховається тільки те, що ви самі підтвердили й сховали кнопкою, — файли при цьому не видаляються, і кожен кадр можна повернути.',
      },
      {
        q: 'Що бачить клієнт, поки фото ще в обробці?',
        a: 'Якщо ви поставили статус зйомки, за посиланням на галерею клієнт бачить етапи «Зйомка → Обробка → Готово» і орієнтовну дату, якщо ви її вказали. Коли додасте фото — там само відкриється галерея.',
      },
      {
        q: 'Що станеться з файлами, якщо я скасую підписку?',
        a: '14 днів усе працює як раніше. Якщо ви вміщаєтеся в безкоштовні 3 ГБ — акаунт просто стає безкоштовним. Якщо ні — галереї закриваються для клієнтів, а файли зберігаються ще 60 днів: ви бачите все в кабінеті, можете завантажити архівом або продовжити тариф. Перед видаленням попередимо листами за 30, 7 і 1 день.',
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
    tagline: 'Онлайн-галереї для фотографів України',
    blog: 'Блог',
    terms: 'Публічна оферта',
    privacy: 'Політика конфіденційності',
    support: 'Підтримка',
  },
}

const en: LandingCopy = {
  nav: { features: 'Features', galleries: 'Galleries', pricing: 'Pricing', themes: 'Themes', blog: 'Blog', signIn: 'Sign in', ctaShort: 'Start for free', dashboard: 'Dashboard' },
  hero: {
    chips: ['Weddings', 'Families', 'Portraits', 'Studios'],
    titleBefore: 'Everything that happens ',
    titleAccent: 'after',
    titleAfter: ' the shutter clicks',
    subtitle: 'An online client gallery for photographers: deliver a shoot with one beautiful link.',
    lede:
      'Galleries where the client instantly knows how to grab their photos — no Google Drive, no "how do I download this?". Favourites, a password and expiry, uncompressed originals. Your brand everywhere.',
    cta: 'Start for free',
    ctaNote: '3 GB free, each gallery stays open 30 days. No card.',
    statNumber: '30 000',
    statText: 'photos delivered to clients through proiav galleries',
    status: { steps: ['Shoot', 'Editing', 'Ready'], now: 'now', eta: 'Expected by 14 December' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Wedding stories',
  },
  strip: { label: 'Photographers’ work' },
  products: {
    label: 'Galleries · culling · shoot status',
    titleBefore: 'A client gallery for photographers — ',
    titleAccent: 'under your brand',
    lede:
      'It all starts with the gallery — that is where a photographer meets clients every week. New in galleries: reject culling, a shoot status for the client and uploads that survive a dropped connection. Below are the real screens.',
    gallery: {
      no: '01 — Galleries',
      title: 'Deliver shoots beautifully',
      text: 'Upload the photos — the client gets a beautiful link and downloads on their own, no Google Drive and no "how do I download this?". Favorites, password, expiry, zip, stats.',
      tagStrong: 'Originals uncompressed.',
      tagRest: ' Files exactly as shot',
    },
    features: [
      {
        no: '02 — AI culling',
        title: 'Rejects get flagged, you decide',
        text: 'Blurry frames, repeats within a burst and closed eyes are flagged automatically, and the best frame of a burst sits next to the rest. The analysis runs in your browser — photos are not sent anywhere.',
        tagStrong: 'Nothing is hidden on its own.',
        tagRest: ' A photo disappears for the client only once you confirm it',
        alt: 'The «Photo culling» panel: «Repeat» and «Blurry» flags on photos and the «Possible rejects» filter',
      },
      {
        no: '03 — Shoot status',
        title: 'Clients see where their photos are',
        text: 'While the gallery is empty, the same link shows the client «Shoot → Editing → Ready» and an expected date if you set one. Once the photos are in, the gallery opens right there.',
        tagStrong: 'One switch in the dashboard.',
        tagRest: ' The client sees changes at once',
        alt: 'The client status screen: «Your photos are already in progress», the «Editing» step and an expected date',
      },
      {
        no: '04 — Reliable upload',
        title: 'A dropped connection is not a restart',
        text: 'Large files go up in 8 MB parts. The network drops — the upload waits and carries on by itself. The tab was closed — choose the same files and they continue where they stopped.',
        tagStrong: 'Only the unfinished part is repeated,',
        tagRest: ' not the whole file',
        alt: 'The gallery uploader offline: photos already uploaded, videos waiting for the connection',
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
      watermark: { label: 'Watermark', text: 'Your name on previews. Originals stay clean' },
      stats: { label: 'Stats', number: '247', text: 'gallery views this week' },
      themes: {
        label: 'Gallery design',
        text: 'Three moods, five layouts',
        chips: ['Masonry', 'Collage', 'Editorial', 'Squares', 'Portrait 3:4'],
      },
      previewPhoto: 'Previews with zero speed loss',
      slideshow: { label: 'Viewing', text: 'Full-screen lightbox and slideshow — on phones too' },
      video: {
        label: 'Video',
        text: 'Clips next to the photos in the same gallery — from the Basic plan',
      },
      languages: { label: 'Languages', text: 'Clients switch the gallery to their language — nine of them' },
    },
  },
  principles: {
    huge: 'Principles',
    title: 'How the platform is built inside',
    lede: 'Not a feature list — decisions that do not get revisited.',
    items: [
      {
        title: 'Your brand up front',
        text: 'From the first paid tier, galleries never mention us. The client sees only the photographer.',
      },
      {
        title: 'The photographer decides',
        text: 'Automation only suggests. No photo is hidden from the client until you confirm it.',
      },
      {
        title: 'Originals are untouchable',
        text: 'Files are stored byte for byte. Clients browse fast previews and download full quality.',
      },
      {
        title: 'Photos are not shipped off for analysis',
        text: 'Culling runs in your browser. Photos are not passed to third-party services — even the face model loads from our own server.',
      },
    ],
  },
  pricing: {
    label: 'Pricing',
    titleBefore: 'Online gallery pricing: ',
    titleAccent: 'pay only for storage',
    lede:
      'Client photo selection is free for everyone. Paid tiers remove our branding and add video and more room; Plus adds statistics.',
    perMonth: '/ month',
    freeLabel: 'no card',
    yearHint: (year) => `or ${year} ₴ per year — two months free`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB of storage` : `${gb} GB of storage`),
    popular: 'Recommended',
    fineprint:
      'Pay with any Ukrainian bank card. Cancel anytime — everything keeps working for 14 more days. After that, if you are over the free 3 GB, galleries close to clients and files are kept for 60 more days.',
    plans: {
      free: {
        name: 'Free',
        note: 'Each gallery stays open 30 days — to try it out',
        bullets: ['Client photo selection', 'Password & expiry on galleries', 'Unlimited galleries'],
      },
      basic: {
        name: 'Basic',
        note: 'Your brand — and only yours',
        bullets: ['No our branding', 'Your logo in galleries', 'Video in galleries'],
      },
      plus: {
        name: 'Plus',
        note: 'For a full working season',
        bullets: ['Everything in Basic', 'View statistics', 'Client tips'],
      },
      pro: {
        name: 'Maximum',
        note: 'Large archives and a busy season',
        bullets: ['Everything in Plus', 'Priority support', '1 TB of storage'],
      },
    },
    planCta: 'Choose',
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
        q: 'Do clients see the gallery is made on proiav?',
        a: 'On the free tier a small “Made with proiav” note sits at the bottom of the gallery. From Basic up it is gone: pages carry only your name, your logo and your photos.',
      },
      {
        q: 'Can AI culling hide or delete photos on its own?',
        a: 'No. It only flags likely rejects: blurry frames, repeats within a burst, closed eyes. Only what you confirm and hide with the button is hidden from the client — the files are not deleted, and every photo can be brought back.',
      },
      {
        q: 'What does the client see while the photos are being edited?',
        a: 'If you set a shoot status, the gallery link shows the client «Shoot → Editing → Ready» and an expected date if you set one. Once you add the photos, the gallery opens right there.',
      },
      {
        q: 'What happens to files if I cancel?',
        a: 'Everything keeps working for 14 days. If you fit into the free 3 GB, the account simply becomes free. If not, galleries close to clients and files are kept for 60 more days: you still see everything, can download it or renew the plan. We email you 30, 7 and 1 day before deletion.',
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
    tagline: 'Online client galleries for photographers in Ukraine',
    blog: 'Blog',
    terms: 'Public offer',
    privacy: 'Privacy policy',
    support: 'Support',
  },
}

export function getLandingCopy(locale: Locale): LandingCopy {
  // Only Ukrainian is fully authored for marketing; every other locale gets
  // English (client languages don't have a translated landing page).
  return locale === 'uk' ? uk : en
}
