/**
 * Legal documents (public offer + privacy policy) rendered at /[locale]/oferta
 * and /[locale]/privacy. Ukrainian is primary; English is the fallback for all
 * other locales.
 *
 * Business details are filled in (ФОП Гоголь Діана Іванівна). By choice, the
 * РНОКПП and full address are NOT published — they are provided in the
 * invoice/contract and on request, which satisfies e-commerce identification
 * without over-disclosing personal data. This is a working document, not legal
 * advice; a lawyer review before launch is still recommended.
 */

import { SUPPORT_EMAIL } from '@/lib/email-layout'

export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDoc {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export interface LegalCopy {
  oferta: LegalDoc
  privacy: LegalDoc
  backToHome: string
  reviewNote: string
}

const ENTITY = 'ФОП Гоголь Діана Іванівна'
const UPDATED = '29.09.2026'

const uk: LegalCopy = {
  backToHome: '← На головну',
  reviewNote: '',
  oferta: {
    title: 'Публічна оферта',
    updated: `Редакція від ${UPDATED}`,
    intro:
      `Цей документ є офіційною публічною пропозицією (офертою) ${ENTITY} (далі — «Виконавець») укласти договір про надання доступу до онлайн-сервісу «проЯв» (далі — «Сервіс») на викладених нижче умовах. Реєструючись у Сервісі або здійснюючи оплату, ви (далі — «Користувач») повністю й беззастережно приймаєте умови цієї оферти.`,
    sections: [
      {
        heading: '1. Терміни',
        paragraphs: [
          '«Сервіс» — програмний веб-продукт «проЯв» (proiav.space), що надає фотографам інструменти для клієнтських онлайн-галерей, персональних сайтів і приймання бронювань.',
          '«Користувач» — фотограф або інша особа, що зареєструвала акаунт у Сервісі.',
          '«Клієнт Користувача» — третя особа, якій Користувач надає доступ до галереї чи форми бронювання.',
          '«Тариф» — набір функцій та обсяг сховища, що надаються за плату відповідно до сторінки тарифів.',
        ],
      },
      {
        heading: '2. Предмет договору',
        paragraphs: [
          'Виконавець надає Користувачу доступ до функціоналу Сервісу на умовах обраного Тарифу, а Користувач зобов’язується оплачувати такий доступ (крім безкоштовного тарифу) та дотримуватися умов цієї оферти.',
          'Сервіс надається «як є». Виконавець розвиває Сервіс і може змінювати склад функцій, повідомляючи про суттєві зміни завчасно.',
        ],
      },
      {
        heading: '3. Тарифи та оплата',
        paragraphs: [
          'Актуальні ціни вказані на сторінці тарифів у гривнях (₴). Оплата здійснюється карткою українського банку через платіжного провайдера (Monobank / LiqPay); Виконавець не зберігає повних даних платіжної картки.',
          'Підписка діє протягом оплаченого періоду (місяць або рік) і, за наявності авто-продовження, поновлюється автоматично, доки Користувач її не скасує.',
          'Автопродовження вмикається позначкою «Автопродовження» біля кнопки оплати на сторінці тарифів: поруч вказано суму й періодичність списання. Якщо позначку залишено, платіжний провайдер (Monobank) зберігає токен картки, і кожного наступного періоду з неї автоматично списується та сама сума за обраний тариф (за вирахуванням реферального кредиту, якщо він є). Якщо позначку знято, картка не зберігається й тариф діє лише оплачений період.',
          'За 3 дні до кожного автоматичного списання Сервіс надсилає на пошту Користувача лист із сумою, датою списання та посиланням для скасування. Скасувати автопродовження можна будь-коли в кабінеті (розділ «Тариф») — після цього картку більше не списують, а збережений токен видаляється.',
          'Оплата через Google Pay або Apple Pay не зберігає картку, тому для такої оплати автопродовження недоступне: тариф діє оплачений період.',
          'Річна оплата надається за ціною десяти місяців (два місяці — у подарунок).',
        ],
      },
      {
        heading: '4. Повернення коштів',
        paragraphs: [
          'Оскільки доступ до цифрового Сервісу надається негайно, оплачений період поверненню не підлягає, окрім випадків, прямо передбачених законодавством України про захист прав споживачів.',
          'Скасувати авто-продовження можна будь-коли в кабінеті; після скасування тариф діє до кінця оплаченого періоду, після чого ще 14 днів зберігається повний доступ на ліміті тарифу.',
          'Якщо після цих 14 днів файли Користувача перевищують ліміт безкоштовного тарифу (3 ГБ), галереї закриваються для клієнтів Користувача, а файли зберігаються ще 60 днів і після цього видаляються зі сховища без можливості відновлення. Протягом цих 60 днів Користувач має повний доступ до файлів у кабінеті, може завантажити їх або відновити тариф — тоді галереї відкриваються за тими самими посиланнями. Про кожен етап Сервіс попереджає листом (зокрема за 30, 7 і 1 день до видалення). Безкоштовний тариф в межах його ліміту строку зберігання не має.',
          'Безкоштовний місяць тарифу «Базовий» за імпорт галереї (промо) надається один раз на акаунт; після його завершення діють ті самі правила, що й після закінчення оплаченого періоду.',
        ],
      },
      {
        heading: '5. Права та обов’язки Користувача',
        paragraphs: [
          'Користувач гарантує, що має всі права на контент (фотографії тощо), який завантажує, і несе відповідальність за його законність, зокрема за наявність згоди зображених осіб на обробку та поширення їхніх зображень.',
          'Користувач самостійно визначає мету й обсяг обробки персональних даних своїх Клієнтів і виступає володільцем таких даних; Виконавець обробляє їх виключно за дорученням Користувача (див. Політику конфіденційності).',
          'Заборонено використовувати Сервіс для незаконного, шахрайського чи такого, що порушує права третіх осіб, контенту.',
        ],
      },
      {
        heading: '6. Відповідальність',
        paragraphs: [
          'Виконавець докладає зусиль для безперебійної роботи Сервісу, але не гарантує відсутності технічних збоїв і не відповідає за втрати, спричинені форс-мажором чи діями третіх сторін (провайдерів хостингу, платежів, зв’язку).',
          'Виконавець не є стороною відносин між Користувачем і його Клієнтами та не відповідає за зміст галерей, сайтів і домовленості щодо зйомок.',
        ],
      },
      {
        heading: '7. Персональні дані',
        paragraphs: [
          'Обробка персональних даних здійснюється відповідно до Закону України «Про захист персональних даних» та Політики конфіденційності, що є невід’ємною частиною цієї оферти.',
        ],
      },
      {
        heading: '8. Строк дії та зміни',
        paragraphs: [
          'Оферта діє безстроково з моменту оприлюднення. Виконавець має право змінювати її умови, оприлюднюючи нову редакцію на цій сторінці; продовження користування Сервісом означає згоду з новою редакцією.',
        ],
      },
      {
        heading: '9. Реквізити Виконавця',
        paragraphs: [
          `Найменування: ${ENTITY}`,
          `Група оподаткування: платник єдиного податку третьої групи`,
          `Дата державної реєстрації: 04.09.2023`,
          `Місцезнаходження: Україна, м. Тернопіль (повна адреса — за запитом)`,
          `Електронна пошта: ${SUPPORT_EMAIL}`,
          `Повні реквізити (РНОКПП, банківський рахунок) надаються в рахунку та за запитом.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Політика конфіденційності',
    updated: `Редакція від ${UPDATED}`,
    intro:
      `Ця Політика пояснює, які персональні дані обробляє сервіс «проЯв» (${ENTITY}), з якою метою та на яких підставах. Користуючись Сервісом, ви погоджуєтеся з цією Політикою.`,
    sections: [
      {
        heading: '1. Які дані ми обробляємо',
        paragraphs: [
          'Дані акаунту: адреса електронної пошти, ім’я/назва бренду, налаштування профілю.',
          'Контент, який завантажує фотограф: фотографії та супровідна інформація до галерей і сайтів. Ці дані можуть містити зображення третіх осіб (Клієнтів фотографа).',
          'Технічні дані: журнали доступу, знеособлена аналітика використання (Google Analytics).',
          'Платіжні дані обробляє платіжний провайдер (Monobank / LiqPay); ми отримуємо лише статус оплати, а не повні реквізити картки.',
        ],
      },
      {
        heading: '2. Ролі: володілець і розпорядник',
        paragraphs: [
          'Щодо даних акаунту фотографа володільцем є Виконавець.',
          'Щодо персональних даних Клієнтів (зокрема зображень на фото) володільцем виступає сам фотограф — він визначає мету обробки. Виконавець діє як розпорядник (процесор) і обробляє ці дані виключно за дорученням фотографа та для роботи Сервісу.',
        ],
      },
      {
        heading: '3. Мета та підстави обробки',
        paragraphs: [
          'Надання функціоналу Сервісу (виконання договору-оферти), обробка платежів, підтримка користувачів, забезпечення безпеки та виконання вимог законодавства.',
          'Правові підстави: виконання договору, згода суб’єкта даних, законні інтереси Виконавця та виконання правових обов’язків.',
        ],
      },
      {
        heading: '4. Передача та субпідрядники',
        paragraphs: [
          'Ми залучаємо надійних постачальників інфраструктури: хостинг застосунку та бази даних, хмарне сховище файлів, платіжного провайдера та сервіс аналітики. Вони обробляють дані лише в обсязі, потрібному для надання своїх послуг.',
          'Ми не продаємо персональні дані третім особам.',
        ],
      },
      {
        heading: '5. Зберігання',
        paragraphs: [
          'Дані зберігаються, доки існує акаунт або доки цього вимагає мета обробки чи закон. Після видалення акаунту дані видаляються або знеособлюються у розумний строк.',
          'Файли зберігаються у хмарному сховищі; оригінали не змінюються.',
        ],
      },
      {
        heading: '6. Ваші права',
        paragraphs: [
          'Ви маєте право на доступ до своїх даних, їх виправлення, видалення, обмеження обробки та заперечення проти обробки, а також право відкликати згоду.',
          `Щоб скористатися правами, напишіть на ${SUPPORT_EMAIL}. Якщо ви — Клієнт фотографа, звертайтеся насамперед до самого фотографа як володільця ваших даних.`,
        ],
      },
      {
        heading: '7. Файли cookie',
        paragraphs: [
          'Ми використовуємо необхідні cookie для роботи авторизації та збереження налаштувань, а також аналітичні cookie для розуміння використання Сервісу. Ви можете керувати cookie в налаштуваннях браузера.',
        ],
      },
      {
        heading: '8. Контакти',
        paragraphs: [
          `З питань конфіденційності: ${SUPPORT_EMAIL}. Володілець: ${ENTITY}.`,
        ],
      },
    ],
  },
}

const en: LegalCopy = {
  backToHome: '← Home',
  reviewNote: '',
  oferta: {
    title: 'Public Offer (Terms)',
    updated: `Version of ${UPDATED}`,
    intro:
      `This document is a public offer by ${ENTITY} ("Provider") to enter into an agreement for access to the "proiav" online service ("Service"). By registering or paying, you ("User") fully accept these terms.`,
    sections: [
      {
        heading: '1. Definitions',
        paragraphs: [
          '"Service" — the "proiav" web product (proiav.space) providing photographers with client galleries, personal sites and booking.',
          '"User" — a photographer or other person who registers an account.',
          '"User’s Client" — a third party the User grants access to a gallery or booking form.',
        ],
      },
      {
        heading: '2. Subject',
        paragraphs: [
          'The Provider grants access to the Service under the chosen plan; the User agrees to pay for paid plans and follow these terms. The Service is provided "as is".',
        ],
      },
      {
        heading: '3. Plans and payment',
        paragraphs: [
          'Prices are shown on the pricing page in Ukrainian hryvnia (₴). Payment is made by card via a payment provider (Monobank / LiqPay); the Provider does not store full card details.',
          'A subscription runs for the paid period and, with auto-renewal on, renews automatically until canceled. Annual billing is priced at ten months (two months free).',
          'Auto-renewal is turned on with the «Auto-renewal» checkbox next to the pay button on the plans page, which states the amount and how often it is charged. With it ticked, the payment provider (Monobank) keeps a card token and the same amount for the chosen plan is charged automatically every period (less any referral credit). With it unticked, no card is saved and the plan runs for the paid period only.',
          'Three days before every automatic charge the Service e-mails the User the amount, the charge date and a link to cancel. Auto-renewal can be canceled at any time in the dashboard («Plan»); the card is then no longer charged and the saved token is deleted.',
          'Payments through Google Pay or Apple Pay do not save the card, so auto-renewal is not available for them: the plan runs for the paid period.',
        ],
      },
      {
        heading: '4. Refunds',
        paragraphs: [
          'As access to the digital Service is granted immediately, a paid period is non-refundable except where required by Ukrainian consumer-protection law. Auto-renewal can be canceled anytime; access continues to the end of the paid period, and files are kept for 7 more days at the full limit.',
        ],
      },
      {
        heading: '5. User obligations',
        paragraphs: [
          'The User warrants they hold all rights to the content they upload and is responsible for its lawfulness, including consent of depicted persons to process and share their images.',
          'The User is the controller of their Clients’ personal data; the Provider processes it only on the User’s instructions (see Privacy Policy).',
        ],
      },
      {
        heading: '6. Liability',
        paragraphs: [
          'The Provider aims for uninterrupted operation but does not guarantee the absence of technical faults and is not liable for losses caused by force majeure or third parties (hosting, payment, network providers).',
        ],
      },
      {
        heading: '7. Personal data',
        paragraphs: [
          'Personal data is processed under Ukraine’s Law "On Personal Data Protection" and the Privacy Policy, which forms an integral part of this offer.',
        ],
      },
      {
        heading: '8. Term and changes',
        paragraphs: [
          'The offer is effective indefinitely from publication. The Provider may change it by publishing a new version here; continued use means acceptance.',
        ],
      },
      {
        heading: '9. Provider details',
        paragraphs: [
          `Name: ${ENTITY}`,
          `Tax status: single-tax payer, third group`,
          `Registration date: 04.09.2023`,
          `Location: Ukraine, Ternopil (full address on request)`,
          `Email: ${SUPPORT_EMAIL}`,
          `Full details (tax ID, bank account) are provided in the invoice and on request.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: `Version of ${UPDATED}`,
    intro:
      `This Policy explains what personal data the "proiav" service (${ENTITY}) processes, why, and on what grounds. By using the Service you agree to it.`,
    sections: [
      {
        heading: '1. What we process',
        paragraphs: [
          'Account data: email, name/brand, profile settings.',
          'Content uploaded by the photographer: photos and related info, which may include images of third parties (the photographer’s Clients).',
          'Technical data: access logs, anonymized usage analytics (Google Analytics).',
          'Payment data is handled by the payment provider (Monobank / LiqPay); we receive only the payment status, not full card details.',
        ],
      },
      {
        heading: '2. Roles: controller and processor',
        paragraphs: [
          'For a photographer’s account data, the Provider is the controller.',
          'For Clients’ personal data (including faces in photos), the photographer is the controller and defines the purpose; the Provider acts as processor, handling it only on the photographer’s instructions.',
        ],
      },
      {
        heading: '3. Purpose and grounds',
        paragraphs: [
          'Providing the Service (contract performance), processing payments, support, security and legal compliance. Grounds: contract performance, consent, legitimate interests and legal obligations.',
        ],
      },
      {
        heading: '4. Sharing and sub-processors',
        paragraphs: [
          'We use trusted infrastructure providers: app and database hosting, cloud file storage, a payment provider and analytics. They process data only as needed to provide their services. We do not sell personal data.',
        ],
      },
      {
        heading: '5. Retention',
        paragraphs: [
          'Data is kept while the account exists or as long as the purpose or law requires. After account deletion, data is deleted or anonymized within a reasonable time.',
        ],
      },
      {
        heading: '6. Your rights',
        paragraphs: [
          'You have the right to access, correct, delete, restrict and object to processing, and to withdraw consent.',
          `To exercise them, email ${SUPPORT_EMAIL}. If you are a photographer’s Client, contact the photographer first as the controller of your data.`,
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'We use necessary cookies for authentication and settings, and analytics cookies to understand usage. You can manage cookies in your browser settings.',
        ],
      },
      {
        heading: '8. Contact',
        paragraphs: [`Privacy questions: ${SUPPORT_EMAIL}. Controller: ${ENTITY}.`],
      },
    ],
  },
}

export function getLegalCopy(locale: string): LegalCopy {
  return locale === 'uk' ? uk : en
}
