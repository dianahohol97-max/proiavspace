import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** Polish. Impersonal address like the dashboard; plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'pl')
const galleries = (count: number) =>
  n(count, '{n, plural, one {# galeria} few {# galerie} many {# galerii} other {# galerii}}')
const files = (count: number) => n(count, '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}')
const days = (count: number) => n(count, '{n, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}')
/** «3 galerie zostaną zamknięte» — subject and verb agree with the count. */
const galleriesClose = (count: number) =>
  n(
    count,
    '{n, plural, one {# galeria zostanie zamknięta} few {# galerie zostaną zamknięte} many {# galerii zostanie zamkniętych} other {# galerii zostanie zamkniętych}}'
  )

const fitIntoFree = (freeGb: number, then: string) =>
  `Można też usunąć w panelu to, co niepotrzebne, aby zmieścić się w darmowych ${freeGb} GB — wtedy nic nie zniknie: ${then}`

const SIGN = '— proiav'

export const pl: EmailCopy = {
  hello: (name) => (name ? `Dzień dobry, ${name}!` : 'Dzień dobry!'),
  helloClient: 'Dzień dobry!',
  footerQuestions: 'Pytania i rachunki',
  footerSupport: 'Pomoc',
  planNames: {
    free: 'Darmowy',
    basic: 'Podstawowy',
    plus: 'Plus',
    pro: 'Maksymalny',
    site_basic: 'Strona · Podstawowy',
    site_plus: 'Strona · Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} miejsca na galerie`,
    galleries: 'Galerie dla klientów z hasłem, wyborem zdjęć i pobieraniem w archiwum ZIP',
    video: 'Wideo w galeriach',
    noBranding: 'Bez oznaczenia „proiav” w galeriach',
    logo: 'Własne logo w galeriach',
    stats: 'Statystyki wyświetleń i pobrań',
    support: 'Priorytetowe wsparcie',
    noExpiry: 'Galerie bez limitu czasu, dopóki plan jest aktywny',
    sites: (count) => n(count, '{n, plural, one {# strona-portfolio} few {# strony-portfolio} many {# stron-portfolio} other {# strony-portfolio}}'),
    site: 'Strona-portfolio',
    domain: 'Własna domena',
  },

  receipt(v) {
    const credit = v.credit ? ` (w tym ${v.credit} z bonusu za polecenia)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Automatyczne odnawianie jest włączone: następne obciążenie ${v.nextChargeAt}, ${v.nextChargeAmount}. Przypomnienie wyślemy 3 dni wcześniej. Można je wyłączyć w dowolnym momencie w panelu — opłacony okres i tak trwa do końca.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Nie udało się włączyć automatycznego odnawiania: płatność przez ${v.wallet} nie zapisuje karty. Plan jest aktywny do ${v.periodEnd}. Aby następnym razem odnawiał się automatycznie, należy zapłacić kartą z zaznaczonym polem „Automatyczne odnawianie”.`
    } else {
      renewal = `Automatyczne odnawianie jest wyłączone: plan jest aktywny do ${v.periodEnd}, potem pełny dostęp zostaje jeszcze przez ${days(v.graceDays)}, a następnie konto przechodzi na plan Darmowy.`
    }
    return {
      subject: `Potwierdzenie płatności: ${v.amount} — plan „${v.plan}”, proiav`,
      lead: ['Płatność otrzymana. Dziękujemy, że jesteście z nami!'],
      rows: [
        ['Plan', `„${v.plan}”${v.volume ? `, ${v.volume}` : ''}`],
        ['Kwota', `${v.amount}${credit}`],
        ['Data płatności', v.paidAt],
        ['Okres', `${v.period === 'year' ? 'rok' : 'miesiąc'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Aktywny do', v.periodEnd],
        ['Metoda płatności', v.wallet ? `${v.wallet} (${v.provider})` : `karta, ${v.provider}`],
        ['Zamówienie', v.orderId],
      ],
      list: { title: 'Co obejmuje plan', items: v.includes },
      after: [renewal, `Potwierdzenie bankowe ${v.provider} wysyła osobno.`],
      button: { label: 'Otwórz panel', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Za ${days(v.days)} — automatyczne odnowienie planu „${v.plan}”, ${v.amount}`,
      lead: [
        `${v.chargeAt} pobierzemy ${v.amount} z zapisanej karty — automatyczne odnowienie planu „${v.plan}”${v.volume ? ` (${v.volume})` : ''} na ${v.period === 'year' ? 'rok' : 'miesiąc'}.`,
      ],
      rows: [
        ['Plan', `„${v.plan}”`],
        ['Kwota', v.amount],
        ['Data obciążenia', v.chargeAt],
      ],
      after: [
        'Jeśli na koncie jest bonus za polecenia, uwzględnimy go — pobrana kwota będzie mniejsza.',
        'Rezygnacja z odnowienia? Wystarczy wyłączyć automatyczne odnawianie przed datą obciążenia: opłacony okres trwa do końca, a karta nie zostanie ponownie obciążona.',
      ],
      button: { label: 'Wyłącz automatyczne odnawianie', url: `${v.billingUrl}#autopay` },
      link: { label: 'Panel i plany', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · nie udało się pobrać ${v.amount} za plan „${v.plan}”`,
      lines: [
        v.greeting,
        '',
        `Dziś próbowaliśmy pobrać ${v.amount} za plan „${v.plan}”, ale bank odrzucił płatność`,
        '(najczęściej karta straciła ważność albo zabrakło środków).',
        '',
        `Nic nie znika. Do ${v.graceUntil} wszystko działa jak dotąd:`,
        `galerie są otwarte dla klientów${v.volume ? `, limit ${v.volume}` : ''}.`,
        '',
        `Aby plan działał bez przerwy, należy zaktualizować kartę do ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Bez aktualizacji:',
        `– od ${v.graceUntil} galerie będą niedostępne dla klientów (w panelu nadal są widoczne i można je pobrać);`,
        `– od ${v.deletesAt} pliki zostaną usunięte z serwera.`,
        '',
        'Przypomnimy 30, 7 i 1 dzień przed usunięciem.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo
      ? 'Bezpłatny miesiąc planu „Podstawowy” za import'
      : `Opłacony okres planu „${v.plan}”`
    return {
      subject: `proiav · plan „${v.plan}” się zakończył — przez ${days(v.graceDays)} wszystko działa jak dotąd`,
      lines: [
        v.greeting,
        '',
        `${what} zakończył się ${v.endedAt}.`,
        '',
        `Do ${v.closesAt} nic się nie zmienia: galerie są otwarte dla klientów,`,
        `${v.volume ? `limit wynosi ${v.volume}, ` : ''}wideo pozostaje na miejscu.`,
        '',
        'Potem, jeśli plan nie zostanie odnowiony:',
        `– ${v.closesAt}: galerie zamykają się dla klientów. W panelu nadal widać wszystko`,
        '  i każdą galerię można pobrać jako archiwum ZIP;',
        `– ${v.deletesAt}: pliki zostają trwale usunięte z serwera.`,
        '',
        'Odnowienie planu to jedna płatność — wszystko od razu się otwiera:',
        v.billingUrl,
        '',
        `Bez planów na płatność? Potrzebne galerie można bezpłatnie pobrać do ${v.deletesAt}.`,
        fitIntoFree(v.freeGb, 'konto przejdzie na plan Darmowy, a galerie pozostaną otwarte dla klientów.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · galerie są zamknięte dla klientów, pliki przechowujemy do ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Dziś zakończył się okres przejściowy po planie „${v.plan}”. Galerie na koncie (${galleries(v.galleryCount)})`,
        'są zamknięte dla klientów: pod linkiem widzą komunikat „Galeria jest tymczasowo niedostępna” —',
        'w swoim języku, tym samym, w którym otworzyli galerię.',
        '',
        'W panelu nic nie zniknęło: wszystkie galerie i pliki są na miejscu. Archiwum',
        'każdej galerii można pobrać bezpłatnie.',
        '',
        `Pliki przechowujemy do ${v.deletesAt}. Po tej dacie zostaną usunięte`,
        'z serwera i nie będzie można ich odzyskać.',
        '',
        'Aby ponownie otworzyć galerie, wystarczy opłacić plan; będą dostępne pod tymi samymi',
        'linkami, a hasła i wybory klientów zostaną zachowane:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'pozostałe pliki zostaną, konto przejdzie na plan Darmowy, a galerie znów otworzą się dla klientów.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · jutro pliki zostaną usunięte — ostatnie przypomnienie'
        : `proiav · za ${days(v.daysLeft)} pliki zostaną usunięte (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Jutro' : `Za ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, ${v.deletesAt}, usuniemy z serwera pliki`,
        `galerii na koncie: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'To ostatnie przypomnienie.'] : []),
        '',
        'To ostateczne — usuniętych plików nie da się odzyskać.',
        '',
        'Trzy sposoby, by nic nie stracić:',
        '1. Opłacić plan — galerie od razu otworzą się dla klientów, a pliki zostaną:',
        `   ${v.billingUrl}`,
        `2. Pobrać galerie jako archiwa ZIP do ${v.deletesAt} — bezpłatnie, z panelu:`,
        `   ${v.dashboardUrl}`,
        `3. Usunąć to, co niepotrzebne, aby zmieścić się w darmowych ${v.freeGb} GB — pozostałe pliki zostaną, a galerie znów otworzą się dla klientów.`,
        `   ${v.dashboardUrl}`,
        '',
        'Jeśli te pliki nie są już potrzebne, nie trzeba nic robić.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · bezpłatny miesiąc planu „Podstawowy” kończy się ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Bezpłatny miesiąc planu „Podstawowy” za import galerii kończy się ${v.endsAt}.`,
        '',
        `Aby zostać na planie „Podstawowy” (${v.storageGb} GB, ${v.price}/mies.), wystarczy włączyć płatność automatyczną:`,
        `${v.price} pobierzemy teraz, a opłacony miesiąc zacznie się ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Bez płatności automatycznej po ${v.endsAt} wszystko działa jak dotąd jeszcze przez ${days(v.graceDays)}, potem galerie`,
        `zamykają się dla klientów, a po ${days(v.retentionDays)} pliki zostają usunięte z serwera.`,
        'Przypomnimy o tym wcześniej.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'jutro' : `za ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${when} ${galleriesClose(v.galleries.length)}`
        : `proiav · galeria „${v.galleries[0].title}” zostanie zamknięta ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `W planie Darmowym galeria jest otwarta przez ${days(v.freeDays)}. ${When} dla klientów zostaną zamknięte:`
          : `W planie Darmowym galeria jest otwarta przez ${days(v.freeDays)}. ${When} dla klientów zostanie zamknięta:`,
        ...v.galleries.map((g) => `• „${g.title}” — ${g.closesAt}`),
        '',
        `Po zamknięciu klient zobaczy komunikat „Ta galeria jest już zamknięta. Prosimy o kontakt z fotografem.”. W panelu galeria nadal jest widoczna, a ${days(v.purgeDays)} po zamknięciu pliki zostają usunięte.`,
        '',
        `Aby galerie działały bez limitu czasu, wystarczy przejść na plan „Podstawowy”: ${v.basicPrice}/mies., ${v.basicGb} GB, wideo. Limit czasu znika ze wszystkich galerii od razu po płatności:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · okres partnerski kończy się ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Dziękujemy za współpracę! Okres partnerski na planie „${v.plan}” kończy się ${v.endsAt}.`,
        '',
        `Aby zostać na planie „${v.plan}” bez przerwy, wystarczy wybrać go z płatnością automatyczną: ${v.priceMonth}/mies. lub ${v.priceYear}/rok (dwa miesiące gratis). Można też wybrać inny plan — od „Podstawowego” za ${v.basicPrice}/mies.`,
        v.billingUrl,
        '',
        `Jeśli nic nie zostanie zrobione, konto przejdzie na plan Darmowy (${v.freeGb} GB): istniejące galerie pozostaną dostępne dla klientów jeszcze przez ${days(v.freeDays)}, a każda nowa — przez ${days(v.freeDays)} od utworzenia.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Zdjęcia są gotowe: galeria „${v.galleryTitle}” jest już otwarta — można je oglądać, wybierać ulubione i pobierać.`,
    ]
    if (v.hasPassword) lead.push('Galeria jest chroniona hasłem — fotograf prześle je osobno, jeśli jeszcze tego nie zrobił.')
    return {
      subject: `Zdjęcia są gotowe — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotograf', v.photographerName]] : undefined,
      button: { label: 'Otwórz galerię', url: v.url },
      after: [
        'Ta wiadomość została wysłana, ponieważ fotograf podał ten adres, aby powiadomić o gotowych zdjęciach. Odpowiedź na nią trafi do fotografa.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'nagroda za polecenie' : 'bonus za polecenie'
    const first = v.isAmbassador ? 'pierwsza' : 'pierwszy'
    return {
      subject: `+${v.sum} — ${v.first ? `${first} ${what}` : what}`,
      lines: [
        v.greeting,
        '',
        `Fotograf, który dołączył przez link polecający, właśnie ${v.first ? 'wybrał płatny plan' : 'ponownie opłacił swój plan'}.`,
        v.isAmbassador
          ? `Do wypłaty naliczono ${v.sum} — 10% jego płatności. Tak samo będzie przy każdej z jego pierwszych ${v.cap} płatności.`
          : `Naliczono ${v.sum} bonusu — 10% jego płatności. Tak będzie przy każdej jego kolejnej płatności.`,
        v.isAmbassador
          ? `Wypłata od ${v.minWithdrawal} w panelu: ${v.link}`
          : `Bonus zostanie automatycznie odliczony od najbliższego rachunku. Saldo i link są w panelu: ${v.link}`,
        '',
        'Dziękujemy za polecanie nas innym fotografom.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Nowa rezerwacja: ${v.slot}`,
      lines: [
        `Właśnie zarezerwowano sesję na ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Klient: ${v.clientName}`,
        `Telefon: ${v.clientPhone}`,
        `E-mail: ${v.clientEmail}`,
        '',
        'Status płatności można sprawdzić w panelu.',
      ],
    }
  },
}
