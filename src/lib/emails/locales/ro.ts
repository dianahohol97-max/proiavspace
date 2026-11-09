import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** Romanian — „dumneavoastră” everywhere. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'ro')
const galleries = (count: number) =>
  n(count, '{n, plural, one {# galerie} few {# galerii} other {# de galerii}}')
const files = (count: number) => n(count, '{n, plural, one {# fișier} few {# fișiere} other {# de fișiere}}')
const days = (count: number) => n(count, '{n, plural, one {# zi} few {# zile} other {# de zile}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Sau ștergeți din panoul de control ce nu vă mai trebuie, ca să vă încadrați în cei ${freeGb} GB gratuiți — atunci nu dispare nimic: ${then}`

const SIGN = '— proiav'

export const ro: EmailCopy = {
  hello: (name) => (name ? `Bună ziua, ${name}!` : 'Bună ziua!'),
  helloClient: 'Bună ziua!',
  footerQuestions: 'Întrebări și facturi',
  footerSupport: 'Asistență',
  planNames: {
    free: 'Gratuit',
    basic: 'Basic',
    plus: 'Plus',
    pro: 'Maxim',
    site_basic: 'Site Basic',
    site_plus: 'Site Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} spațiu de stocare pentru galerii`,
    galleries: 'Galerii pentru clienți cu parolă, selecția fotografiilor și descărcare ca arhivă',
    video: 'Video în galerii',
    noBranding: 'Fără mențiunea „proiav” în galerii',
    logo: 'Logoul dumneavoastră în galerii',
    stats: 'Statistici de vizualizări și descărcări',
    support: 'Asistență prioritară',
    noExpiry: 'Galeriile nu expiră cât timp planul este activ',
    sites: (count) =>
      n(count, '{n, plural, one {# site-portofoliu} few {# site-uri-portofoliu} other {# de site-uri-portofoliu}}'),
    site: 'Site-portofoliu',
    domain: 'Domeniu propriu',
  },

  receipt(v) {
    const credit = v.credit ? ` (din care ${v.credit} din creditul de recomandare)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Reînnoirea automată este activă: următoarea debitare are loc pe ${v.nextChargeAt}, ${v.nextChargeAmount}. Vă trimitem un memento cu 3 zile înainte. O puteți anula oricând din panoul de control — perioada plătită rămâne activă până la final.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Reînnoirea automată nu a putut fi activată: plata prin ${v.wallet} nu salvează cardul. Planul este activ până la ${v.periodEnd}. Ca data viitoare să se reînnoiască automat, plătiți cu cardul, cu opțiunea „Reînnoire automată” bifată.`
    } else {
      renewal = `Reînnoirea automată este dezactivată: planul este activ până la ${v.periodEnd}, apoi mai aveți acces complet încă ${days(v.graceDays)}, după care contul devine gratuit.`
    }
    return {
      subject: `Chitanță: ${v.amount} — planul „${v.plan}”, proiav`,
      lead: ['Plata a fost primită. Vă mulțumim că sunteți alături de noi!'],
      rows: [
        ['Plan', `„${v.plan}”${v.volume ? `, ${v.volume}` : ''}`],
        ['Sumă', `${v.amount}${credit}`],
        ['Data plății', v.paidAt],
        ['Perioadă', `${v.period === 'year' ? 'an' : 'lună'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Activ până la', v.periodEnd],
        ['Metodă de plată', v.wallet ? `${v.wallet} (${v.provider})` : `card, ${v.provider}`],
        ['Comandă', v.orderId],
      ],
      list: { title: 'Ce include', items: v.includes },
      after: [renewal, `${v.provider} trimite separat chitanța bancară.`],
      button: { label: 'Deschide panoul de control', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Peste ${days(v.days)} — reînnoirea automată a planului „${v.plan}”, ${v.amount}`,
      lead: [
        `Pe ${v.chargeAt} vom debita ${v.amount} de pe cardul salvat — reînnoirea automată a planului „${v.plan}”${v.volume ? ` (${v.volume})` : ''} pentru ${v.period === 'year' ? 'un an' : 'o lună'}.`,
      ],
      rows: [
        ['Plan', `„${v.plan}”`],
        ['Sumă', v.amount],
        ['Data debitării', v.chargeAt],
      ],
      after: [
        'Dacă aveți credit de recomandare în sold, îl vom lua în calcul — suma debitată va fi mai mică.',
        'Nu doriți reînnoirea? Anulați reînnoirea automată înainte de data debitării: perioada plătită rămâne activă până la final, iar cardul nu va mai fi debitat.',
      ],
      button: { label: 'Anulează reînnoirea automată', url: `${v.billingUrl}#autopay` },
      link: { label: 'Panoul de control și planurile', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · nu am putut debita ${v.amount} pentru planul „${v.plan}”`,
      lines: [
        v.greeting,
        '',
        `Astăzi am încercat să debităm ${v.amount} pentru planul „${v.plan}”, dar banca a refuzat plata`,
        '(cel mai des, cardul a expirat sau nu au fost suficiente fonduri).',
        '',
        `Nu dispare nimic. Până la ${v.graceUntil} totul funcționează ca înainte:`,
        `galeriile sunt deschise pentru clienți${v.volume ? `, limita este ${v.volume}` : ''}.`,
        '',
        `Ca să păstrați planul fără întrerupere, actualizați cardul până la ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Dacă nu o faceți:',
        `– din ${v.graceUntil} galeriile nu vor mai fi disponibile pentru clienți (dumneavoastră le vedeți în continuare și le puteți descărca);`,
        `– din ${v.deletesAt} fișierele vor fi șterse din spațiul de stocare.`,
        '',
        'Vă vom aminti cu 30, 7 și 1 zi înainte de ștergere.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo
      ? 'Luna gratuită a planului „Basic” primită pentru import'
      : `Perioada plătită a planului „${v.plan}”`
    return {
      subject: `proiav · planul „${v.plan}” s-a încheiat — totul funcționează ca înainte încă ${days(v.graceDays)}`,
      lines: [
        v.greeting,
        '',
        `${what} s-a încheiat pe ${v.endedAt}.`,
        '',
        `Până la ${v.closesAt} nu se schimbă nimic: galeriile sunt deschise pentru clienți,`,
        `${v.volume ? `limita este ${v.volume}, ` : ''}clipurile video rămân la locul lor.`,
        '',
        'După aceea, dacă planul nu este reînnoit:',
        `– ${v.closesAt}: galeriile se închid pentru clienți. Dumneavoastră vedeți în continuare totul în panoul de control`,
        '  și puteți descărca orice galerie ca arhivă zip;',
        `– ${v.deletesAt}: fișierele sunt șterse definitiv din spațiul de stocare.`,
        '',
        'Pentru reînnoirea planului este suficientă o singură plată, iar totul se redeschide imediat:',
        v.billingUrl,
        '',
        `Nu plănuiți să plătiți? Descărcați galeriile de care aveți nevoie înainte de ${v.deletesAt} — este gratuit.`,
        fitIntoFree(v.freeGb, 'contul devine gratuit, iar galeriile rămân deschise pentru clienți.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    const closedLine = n(
      v.galleryCount,
      '{n, plural, one {Galeria dumneavoastră este închisă} few {Cele # galerii ale dumneavoastră sunt închise} other {Cele # de galerii ale dumneavoastră sunt închise}}',
    )
    return {
      subject: `proiav · galeriile sunt închise pentru clienți, fișierele sunt păstrate până la ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Astăzi s-a încheiat perioada de tranziție după expirarea planului „${v.plan}”. ${closedLine}`,
        'pentru clienți: la link aceștia văd „Această galerie este temporar indisponibilă” —',
        'în limba lor, cea în care au deschis galeria.',
        '',
        'Pentru dumneavoastră nu a dispărut nimic: toate galeriile și fișierele sunt în panoul de control.',
        'Puteți descărca gratuit arhiva oricărei galerii.',
        '',
        `Fișierele sunt păstrate până la ${v.deletesAt}. După această dată vor fi șterse din`,
        'spațiul de stocare și nu vor mai putea fi recuperate.',
        '',
        'Ca să redeschideți galeriile, plătiți un plan; vor fi disponibile la aceleași',
        'linkuri, iar parolele și selecțiile clienților se păstrează:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'fișierele rămase se păstrează, contul devine gratuit, iar galeriile se redeschid pentru clienți.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · fișierele vor fi șterse mâine — ultimul memento'
        : `proiav · fișierele vor fi șterse peste ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Mâine' : `Peste ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, pe ${v.deletesAt}, vom șterge din spațiul de stocare fișierele`,
        `galeriilor dumneavoastră: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Acesta este ultimul memento.'] : []),
        '',
        'Ștergerea este definitivă — fișierele șterse nu mai pot fi recuperate.',
        '',
        'Trei moduri de a nu pierde nimic:',
        '1. Plătiți un plan — galeriile se redeschid imediat pentru clienți, iar fișierele rămân:',
        `   ${v.billingUrl}`,
        `2. Descărcați galeriile ca arhive zip înainte de ${v.deletesAt} — gratuit, din panoul de control:`,
        `   ${v.dashboardUrl}`,
        `3. Ștergeți ce nu vă mai trebuie, ca să vă încadrați în cei ${v.freeGb} GB gratuiți — fișierele rămase se păstrează, iar galeriile se redeschid pentru clienți.`,
        `   ${v.dashboardUrl}`,
        '',
        'Dacă nu mai aveți nevoie de aceste fișiere, nu trebuie să faceți nimic.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · luna gratuită a planului „Basic” se încheie pe ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Luna gratuită a planului „Basic”, primită pentru importul unei galerii, se încheie pe ${v.endsAt}.`,
        '',
        `Ca să rămâneți pe „Basic” (${v.storageGb} GB, ${v.price}/lună), activați plata automată:`,
        `debităm acum ${v.price}, iar luna plătită începe pe ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Fără plată automată, după ${v.endsAt} totul funcționează ca înainte încă ${days(v.graceDays)}, apoi galeriile`,
        `se închid pentru clienți, iar după încă ${days(v.retentionDays)} fișierele sunt șterse din spațiul de stocare.`,
        'Vă vom anunța din timp.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'mâine' : `peste ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} se închid ${when}`
        : `proiav · galeria „${v.galleries[0].title}” se închide ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `Pe planul gratuit, o galerie rămâne deschisă ${days(v.freeDays)}. ${When} se vor închide pentru clienți aceste galerii:`
          : `Pe planul gratuit, o galerie rămâne deschisă ${days(v.freeDays)}. ${When} se va închide pentru clienți această galerie:`,
        ...v.galleries.map((g) => `• „${g.title}” — ${g.closesAt}`),
        '',
        `După închidere, clientul vede „Această galerie este închisă. Vă rugăm să contactați fotograful.” Dumneavoastră o vedeți în continuare în panoul de control, iar la ${days(v.purgeDays)} după închidere fișierele sunt șterse.`,
        '',
        `Ca galeriile să rămână deschise fără limită de timp, treceți la „Basic”: ${v.basicPrice}/lună, ${v.basicGb} GB, video. Limita de timp dispare pentru toate galeriile imediat după plată:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · perioada dumneavoastră de partener se încheie pe ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Vă mulțumim pentru colaborare! Perioada de partener pe planul „${v.plan}” se încheie pe ${v.endsAt}.`,
        '',
        `Ca să rămâneți pe „${v.plan}” fără întrerupere, alegeți planul cu plată automată: ${v.priceMonth}/lună sau ${v.priceYear}/an (două luni cadou). Puteți alege și alt plan, de la „Basic” cu ${v.basicPrice}/lună.`,
        v.billingUrl,
        '',
        `Dacă nu faceți nimic, contul devine gratuit (${v.freeGb} GB): galeriile existente rămân disponibile pentru clienți încă ${days(v.freeDays)}, iar fiecare galerie nouă — ${days(v.freeDays)} de la creare.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Fotografiile dumneavoastră sunt gata: galeria „${v.galleryTitle}” este deja deschisă — le puteți vedea, vă puteți alege favoritele și le puteți descărca.`,
    ]
    if (v.hasPassword)
      lead.push('Galeria este protejată cu parolă — fotograful vă va trimite parola separat, dacă nu a făcut-o deja.')
    return {
      subject: `Fotografiile dumneavoastră sunt gata — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotograf', v.photographerName]] : undefined,
      button: { label: 'Deschide galeria', url: v.url },
      after: [
        'Primiți acest e-mail pentru că fotograful a indicat adresa dumneavoastră ca să primiți o notificare când fotografiile sunt gata. Dacă răspundeți, răspunsul ajunge la fotograf.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'recompensă de recomandare' : 'credit de recomandare'
    return {
      subject: `+${v.sum} — ${v.first ? `${v.isAmbassador ? 'prima' : 'primul'} ${what}` : what}`,
      lines: [
        v.greeting,
        '',
        `Un fotograf venit prin linkul dumneavoastră tocmai ${v.first ? 'a ales un plan plătit' : 'a plătit din nou planul'}.`,
        v.isAmbassador
          ? `Ați primit ${v.sum} de retras — 10% din plata lui. La fel pentru ${n(v.cap, '{n, plural, one {prima sa plată} few {fiecare dintre primele sale # plăți} other {fiecare dintre primele sale # de plăți}}')}.`
          : `Ați primit ${v.sum} credit — 10% din plata lui. Și așa la fiecare plată a lui.`,
        v.isAmbassador
          ? `Puteți retrage banii din panoul de control, începând de la ${v.minWithdrawal}: ${v.link}`
          : `Creditul se aplică automat la următoarea factură. Sold și link: ${v.link}`,
        '',
        'Vă mulțumim că ne recomandați colegilor.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Rezervare nouă: ${v.slot}`,
      lines: [
        `Tocmai a fost rezervată o ședință pentru ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Client: ${v.clientName}`,
        `Telefon: ${v.clientPhone}`,
        `E-mail: ${v.clientEmail}`,
        '',
        'Verificați statusul plății în panoul de control.',
      ],
    }
  },
}
