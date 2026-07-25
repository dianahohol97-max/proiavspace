/**
 * Ready-made, client-facing legal documents for a photographer's own clients.
 * Each photographer collects personal data (galleries, booking) and takes
 * payments, so their site needs a privacy policy and a refund/return policy —
 * written in the client's language and filled in with the photographer's name
 * and contact email. These are sensible templates, not legal advice; the
 * photographer stays the data controller.
 */

export type PolicyDoc = 'privacy' | 'refund'

export interface PolicyInput {
  /** Photographer's public/brand name — the data controller. */
  name: string
  /** Contact email clients can reach for data or refund requests. */
  email: string | null
  locale: string
}

export interface RenderedPolicy {
  title: string
  /** Section paragraphs; blank strings are rendered as headings via `#`. */
  blocks: string[]
}

function uk(name: string, email: string): Record<PolicyDoc, RenderedPolicy> {
  const to = email ? `${email}` : 'контактну адресу, вказану на сайті'
  return {
    privacy: {
      title: 'Політика конфіденційності',
      blocks: [
        `Ці умови пояснюють, як ${name} («Фотограф») збирає та використовує ваші персональні дані, коли ви замовляєте зйомку чи переглядаєте вашу онлайн-галерею.`,
        '# Які дані ми збираємо',
        'Ім’я, контактні дані (телефон, email, соцмережі), деталі замовлення та самі фотографії, зроблені під час зйомки. Для доступу до галереї може використовуватися пароль і технічний ідентифікатор сесії.',
        '# Для чого ми їх використовуємо',
        'Щоб виконати зйомку та передати вам фотографії, узгодити деталі, виставити рахунок і, за вашою згодою, показати окремі кадри в портфоліо. Ми не продаємо ваші дані третім сторонам.',
        '# Публікація фотографій',
        'Фотографії з вашої зйомки не публікуються в портфоліо чи соцмережах без вашої згоди. Ви можете відкликати згоду в будь-який момент, написавши нам.',
        '# Зберігання',
        'Ми зберігаємо галерею та вихідні файли протягом строку, узгодженого при замовленні, після чого вони можуть бути видалені. Резервні копії зберігаються не довше, ніж це технічно потрібно.',
        '# Ваші права',
        `Ви можете попросити копію, виправлення або видалення ваших даних, а також відкликати згоду на публікацію. Для цього напишіть на ${to}.`,
        '# Контакт',
        `З усіх питань щодо ваших даних звертайтеся до ${name}${email ? ` — ${email}` : ''}.`,
      ],
    },
    refund: {
      title: 'Умови оплати та повернення',
      blocks: [
        `Ці умови стосуються передоплати, оплати та повернення коштів за фотопослуги, які надає ${name} («Фотограф»).`,
        '# Бронювання та передоплата',
        'Дата зйомки закріплюється за вами після внесення передоплати (авансу). Передоплата підтверджує бронювання й резервує час у графіку Фотографа.',
        '# Скасування клієнтом',
        'Якщо ви скасовуєте зйомку більш ніж за 7 днів до дати — передоплата повертається повністю або переноситься на іншу дату. При скасуванні пізніше передоплата може бути утримана як компенсація зарезервованого часу.',
        '# Скасування або форс-мажор',
        'Якщо зйомка не може відбутися з вини Фотографа або через форс-мажор, ви обираєте: перенесення на іншу дату або повне повернення передоплати.',
        '# Готові фотографії',
        'Оскільки фотопослуга є індивідуальною й виконаною роботою, оплата за вже проведену зйомку та оброблені фотографії поверненню не підлягає. Якщо результат суттєво не відповідає узгодженому — ми домовимося про доопрацювання.',
        '# Як отримати повернення',
        `Щоб оформити повернення чи перенесення, напишіть на ${to}. Кошти повертаються тим самим способом, яким були сплачені, протягом розумного строку.`,
      ],
    },
  }
}

function en(name: string, email: string): Record<PolicyDoc, RenderedPolicy> {
  const to = email ? `${email}` : 'the contact address shown on the site'
  return {
    privacy: {
      title: 'Privacy Policy',
      blocks: [
        `This notice explains how ${name} (the “Photographer”) collects and uses your personal data when you book a shoot or view your online gallery.`,
        '# Data we collect',
        'Your name, contact details (phone, email, social handles), booking details and the photographs taken during the shoot. Gallery access may use a password and a technical session identifier.',
        '# How we use it',
        'To carry out the shoot and deliver your photographs, agree details, issue an invoice and — with your consent — feature selected frames in a portfolio. We do not sell your data to third parties.',
        '# Publishing photographs',
        'Photos from your shoot are not published in a portfolio or on social media without your consent. You can withdraw consent at any time by contacting us.',
        '# Retention',
        'We keep the gallery and source files for the period agreed at booking, after which they may be deleted. Backups are kept no longer than technically necessary.',
        '# Your rights',
        `You may request a copy, correction or deletion of your data, and withdraw publishing consent. To do so, contact ${to}.`,
        '# Contact',
        `For any questions about your data, contact ${name}${email ? ` — ${email}` : ''}.`,
      ],
    },
    refund: {
      title: 'Payment & Refund Terms',
      blocks: [
        `These terms cover deposits, payment and refunds for the photography services provided by ${name} (the “Photographer”).`,
        '# Booking & deposit',
        'Your shoot date is secured once a deposit is paid. The deposit confirms the booking and reserves time in the Photographer’s schedule.',
        '# Cancellation by the client',
        'If you cancel more than 7 days before the date, the deposit is refunded in full or moved to another date. For later cancellations the deposit may be retained to compensate the reserved time.',
        '# Cancellation or force majeure',
        'If the shoot cannot take place due to the Photographer or force majeure, you choose: reschedule to another date or a full refund of the deposit.',
        '# Delivered photographs',
        'As photography is a bespoke, performed service, payment for a completed shoot and edited photographs is non-refundable. If the result materially differs from what was agreed, we will arrange a revision.',
        '# How to request a refund',
        `To arrange a refund or reschedule, contact ${to}. Funds are returned by the original payment method within a reasonable period.`,
      ],
    },
  }
}

export function renderClientPolicy(doc: PolicyDoc, input: PolicyInput): RenderedPolicy {
  const name = input.name.trim() || (input.locale === 'uk' ? 'Фотограф' : 'the Photographer')
  const email = input.email?.trim() || ''
  const set = input.locale === 'uk' ? uk(name, email) : en(name, email)
  return set[doc]
}
