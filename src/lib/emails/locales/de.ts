import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** German. „Sie“ like the site. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'de')
const galleries = (count: number) => n(count, '{n, plural, one {# Galerie} other {# Galerien}}')
const files = (count: number) => n(count, '{n, plural, one {# Datei} other {# Dateien}}')
/** Nominative/accusative: „30 Tage lang“, „noch 14 Tage“. */
const days = (count: number) => n(count, '{n, plural, one {# Tag} other {# Tage}}')
/** Dative: „in 3 Tagen“, „nach 60 Tagen“. */
const daysDat = (count: number) => n(count, '{n, plural, one {# Tag} other {# Tagen}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Oder löschen Sie im Dashboard, was Sie nicht mehr brauchen, um in die kostenlosen ${freeGb} GB zu passen — dann geht nichts verloren: ${then}`

const SIGN = '— proiav'

export const de: EmailCopy = {
  hello: (name) => (name ? `Hallo ${name}!` : 'Hallo!'),
  helloClient: 'Guten Tag!',
  footerQuestions: 'Fragen und Rechnungen',
  planNames: {
    free: 'Kostenlos',
    basic: 'Basis',
    plus: 'Plus',
    pro: 'Maximum',
    site_basic: 'Website Basis',
    site_plus: 'Website Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} Speicher für Galerien`,
    galleries: 'Kundengalerien mit Passwort, Bildauswahl und ZIP-Download',
    video: 'Videos in Galerien',
    noBranding: 'Kein „proiav“-Hinweis in den Galerien',
    logo: 'Ihr Logo in den Galerien',
    stats: 'Statistik zu Aufrufen und Downloads',
    support: 'Bevorzugter Support',
    noExpiry: 'Kein Ablaufdatum für Galerien, solange der Tarif aktiv ist',
    sites: (count) => `${count} Portfolio-Websites`,
    site: 'Portfolio-Website',
    domain: 'Eigene Domain',
  },

  receipt(v) {
    const credit = v.credit ? ` (davon ${v.credit} aus Empfehlungsguthaben)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Die automatische Verlängerung ist aktiv: Die nächste Abbuchung erfolgt am ${v.nextChargeAt}, ${v.nextChargeAmount}. 3 Tage vorher erinnern wir Sie daran. Sie können sie jederzeit im Dashboard kündigen — der bezahlte Zeitraum läuft trotzdem bis zum Ende.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Die automatische Verlängerung konnte nicht eingerichtet werden: Bei Zahlung über ${v.wallet} wird die Karte nicht gespeichert. Der Tarif gilt bis ${v.periodEnd}. Damit er sich nächstes Mal automatisch verlängert, zahlen Sie mit Karte und aktivieren Sie „Automatische Verlängerung“.`
    } else {
      renewal = `Die automatische Verlängerung ist aus: Der Tarif gilt bis ${v.periodEnd}, danach haben Sie noch ${days(v.graceDays)} lang vollen Zugang, anschließend wird das Konto kostenlos.`
    }
    return {
      subject: `Quittung: ${v.amount} — Tarif „${v.plan}“, proiav`,
      lead: ['Zahlung erhalten. Vielen Dank, dass Sie bei uns sind!'],
      rows: [
        ['Tarif', `„${v.plan}“${v.volume ? `, ${v.volume}` : ''}`],
        ['Betrag', `${v.amount}${credit}`],
        ['Zahlungsdatum', v.paidAt],
        ['Zeitraum', `${v.period === 'year' ? 'Jahr' : 'Monat'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Gültig bis', v.periodEnd],
        ['Zahlungsart', v.wallet ? `${v.wallet} (${v.provider})` : `Karte, ${v.provider}`],
        ['Bestellung', v.orderId],
      ],
      list: { title: 'Was enthalten ist', items: v.includes },
      after: [renewal, `Die Bankquittung sendet ${v.provider} separat.`],
      button: { label: 'Dashboard öffnen', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `In ${daysDat(v.days)}: automatische Verlängerung des Tarifs „${v.plan}“, ${v.amount}`,
      lead: [
        `Am ${v.chargeAt} buchen wir ${v.amount} von Ihrer gespeicherten Karte ab — die automatische Verlängerung des Tarifs „${v.plan}“${v.volume ? ` (${v.volume})` : ''} für ein${v.period === 'year' ? ' Jahr' : 'en Monat'}.`,
      ],
      rows: [
        ['Tarif', `„${v.plan}“`],
        ['Betrag', v.amount],
        ['Abbuchungsdatum', v.chargeAt],
      ],
      after: [
        'Haben Sie Empfehlungsguthaben auf Ihrem Konto, rechnen wir es an — dann wird weniger abgebucht.',
        'Sie möchten nicht verlängern? Kündigen Sie die automatische Verlängerung vor dem Abbuchungsdatum: Der bezahlte Zeitraum läuft bis zum Ende, die Karte wird nicht erneut belastet.',
      ],
      button: { label: 'Automatische Verlängerung kündigen', url: `${v.billingUrl}#autopay` },
      link: { label: 'Dashboard und Tarife', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · ${v.amount} für den Tarif „${v.plan}“ konnten nicht abgebucht werden`,
      lines: [
        v.greeting,
        '',
        `Heute wollten wir ${v.amount} für den Tarif „${v.plan}“ abbuchen, aber die Bank hat die Zahlung abgelehnt`,
        '(meist ist die Karte abgelaufen oder nicht ausreichend gedeckt).',
        '',
        `Es geht nichts verloren. Bis ${v.graceUntil} funktioniert alles wie bisher:`,
        `Die Galerien sind für Kunden geöffnet${v.volume ? `, Limit ${v.volume}` : ''}.`,
        '',
        `Damit der Tarif ohne Unterbrechung weiterläuft, aktualisieren Sie Ihre Karte bis ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Wenn Sie das nicht tun:',
        `– ab ${v.graceUntil} sind die Galerien für Kunden nicht mehr erreichbar (Sie sehen sie weiterhin und können sie herunterladen);`,
        `– ab ${v.deletesAt} werden die Dateien aus dem Speicher gelöscht.`,
        '',
        'Wir erinnern Sie 30, 7 und 1 Tag vor dem Löschen.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo ? 'Ihr Gratismonat im Tarif „Basis“ für den Import' : `Der bezahlte Zeitraum des Tarifs „${v.plan}“`
    return {
      subject: `proiav · Ihr Tarif „${v.plan}“ ist abgelaufen — noch ${days(v.graceDays)} funktioniert alles wie bisher`,
      lines: [
        v.greeting,
        '',
        `${what} ist am ${v.endedAt} abgelaufen.`,
        '',
        `Bis ${v.closesAt} ändert sich nichts: Die Galerien sind für Kunden geöffnet,`,
        `${v.volume ? `das Limit beträgt ${v.volume}, ` : ''}Videos bleiben erhalten.`,
        '',
        'Danach, falls der Tarif nicht verlängert wird:',
        `– ${v.closesAt}: Die Galerien werden für Kunden geschlossen. Sie sehen weiterhin alles im Dashboard`,
        '  und können jede Galerie als ZIP-Archiv herunterladen;',
        `– ${v.deletesAt}: Die Dateien werden endgültig aus dem Speicher gelöscht.`,
        '',
        'Eine Zahlung genügt, um den Tarif zu verlängern — und alles ist sofort wieder geöffnet:',
        v.billingUrl,
        '',
        `Sie möchten nicht zahlen? Laden Sie die Galerien, die Sie brauchen, bis ${v.deletesAt} herunter — das ist kostenlos.`,
        fitIntoFree(v.freeGb, 'Das Konto wird kostenlos, und die Galerien bleiben für Kunden geöffnet.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · Galerien für Kunden geschlossen, Dateien bleiben bis ${v.deletesAt} erhalten`,
      lines: [
        v.greeting,
        '',
        `Heute ist die Übergangszeit nach dem Tarif „${v.plan}“ zu Ende gegangen. Ihre ${galleries(v.galleryCount)}`,
        `${v.galleryCount === 1 ? 'ist' : 'sind'} für Kunden geschlossen: Unter dem Link sehen sie „Diese Galerie ist vorübergehend nicht verfügbar“ —`,
        'in ihrer eigenen Sprache, also der, in der sie die Galerie geöffnet haben.',
        '',
        'Für Sie ist nichts verloren: Alle Galerien und Dateien sind im Dashboard. Das Archiv',
        'jeder Galerie können Sie kostenlos herunterladen.',
        '',
        `Die Dateien bleiben bis ${v.deletesAt} erhalten. Danach werden sie aus dem`,
        'Speicher gelöscht und können nicht wiederhergestellt werden.',
        '',
        'Um die Galerien wieder zu öffnen, bezahlen Sie einen Tarif; sie sind dann unter denselben',
        'Links erreichbar, Passwörter und die Auswahl Ihrer Kunden bleiben erhalten:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'Die übrigen Dateien bleiben, das Konto wird kostenlos, und die Galerien öffnen sich wieder für Kunden.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · Dateien werden morgen gelöscht — letzte Erinnerung'
        : `proiav · Dateien werden in ${daysDat(v.daysLeft)} gelöscht (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Morgen' : `In ${daysDat(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, am ${v.deletesAt}, löschen wir die Dateien`,
        `Ihrer Galerien aus dem Speicher: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Dies ist die letzte Erinnerung.'] : []),
        '',
        'Das ist endgültig — gelöschte Dateien lassen sich nicht wiederherstellen.',
        '',
        'Drei Wege, nichts zu verlieren:',
        '1. Tarif bezahlen — die Galerien öffnen sich sofort wieder für Kunden, die Dateien bleiben:',
        `   ${v.billingUrl}`,
        `2. Galerien bis ${v.deletesAt} als ZIP-Archiv herunterladen — kostenlos, im Dashboard:`,
        `   ${v.dashboardUrl}`,
        `3. Löschen, was Sie nicht mehr brauchen, um in die kostenlosen ${v.freeGb} GB zu passen — die übrigen Dateien bleiben, und die Galerien öffnen sich wieder für Kunden.`,
        `   ${v.dashboardUrl}`,
        '',
        'Wenn Sie diese Dateien nicht mehr brauchen, müssen Sie nichts tun.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · Ihr Gratismonat im Tarif „Basis“ endet am ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Ihr Gratismonat im Tarif „Basis“ für den Import einer Galerie endet am ${v.endsAt}.`,
        '',
        `Um bei „Basis“ zu bleiben (${v.storageGb} GB, ${v.price}/Monat), aktivieren Sie die automatische Zahlung:`,
        `Wir buchen jetzt ${v.price} ab, und der bezahlte Monat beginnt am ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Ohne automatische Zahlung funktioniert nach dem ${v.endsAt} noch ${days(v.graceDays)} lang alles wie bisher, dann werden die Galerien`,
        `für Kunden geschlossen, und nach weiteren ${daysDat(v.retentionDays)} werden die Dateien aus dem Speicher gelöscht.`,
        'Wir erinnern Sie rechtzeitig daran.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'morgen' : `in ${daysDat(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} werden ${when} geschlossen`
        : `proiav · die Galerie „${v.galleries[0].title}“ wird ${when} geschlossen`,
      lines: [
        v.greeting,
        '',
        many
          ? `Im kostenlosen Tarif ist eine Galerie ${days(v.freeDays)} lang geöffnet. ${When} werden diese Galerien für Kunden geschlossen:`
          : `Im kostenlosen Tarif ist eine Galerie ${days(v.freeDays)} lang geöffnet. ${When} wird diese Galerie für Kunden geschlossen:`,
        ...v.galleries.map((g) => `• „${g.title}“ — ${g.closesAt}`),
        '',
        `Nach dem Schließen sehen Ihre Kunden „Diese Galerie ist geschlossen. Bitte wenden Sie sich an Ihren Fotografen.“ Sie selbst sehen sie weiterhin im Dashboard, und ${daysDat(v.purgeDays)} nach dem Schließen werden die Dateien gelöscht.`,
        '',
        `Damit Galerien ohne Zeitlimit geöffnet bleiben, wechseln Sie zu „Basis“: ${v.basicPrice}/Monat, ${v.basicGb} GB, Videos. Das Zeitlimit entfällt für alle Galerien direkt nach der Zahlung:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · Ihr Partnerzeitraum endet am ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Danke, dass Sie mit uns arbeiten! Ihr Partnerzeitraum im Tarif „${v.plan}“ endet am ${v.endsAt}.`,
        '',
        `Um ohne Unterbrechung bei „${v.plan}“ zu bleiben, schließen Sie den Tarif mit automatischer Zahlung ab: ${v.priceMonth}/Monat oder ${v.priceYear}/Jahr (zwei Monate geschenkt). Sie können auch einen anderen Tarif wählen — ab „Basis“ für ${v.basicPrice}/Monat.`,
        v.billingUrl,
        '',
        `Wenn Sie nichts tun, wird Ihr Konto kostenlos (${v.freeGb} GB): Bestehende Galerien bleiben noch ${days(v.freeDays)} für Kunden erreichbar, jede neue ${days(v.freeDays)} ab ihrer Erstellung.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Ihre Fotos sind fertig: Die Galerie „${v.galleryTitle}“ ist jetzt geöffnet — Sie können die Fotos ansehen, Ihre Favoriten auswählen und herunterladen.`,
    ]
    if (v.hasPassword) lead.push('Die Galerie ist passwortgeschützt — falls noch nicht geschehen, schickt Ihnen der Fotograf das Passwort separat.')
    return {
      subject: `Ihre Fotos sind fertig — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotograf', v.photographerName]] : undefined,
      button: { label: 'Galerie öffnen', url: v.url },
      after: [
        'Sie erhalten diese E-Mail, weil der Fotograf Ihre Adresse hinterlegt hat, um Sie zu benachrichtigen, sobald die Fotos fertig sind. Wenn Sie antworten, geht Ihre Antwort an den Fotografen.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'Empfehlungsprämie' : 'Empfehlungsguthaben'
    const firstWhat = v.isAmbassador ? 'Ihre erste Empfehlungsprämie' : 'Ihr erstes Empfehlungsguthaben'
    return {
      subject: v.first ? `+${v.sum} — ${firstWhat}` : `+${v.sum} — ${what}`,
      lines: [
        v.greeting,
        '',
        `Ein Fotograf, der über Ihren Link gekommen ist, hat gerade ${v.first ? 'einen bezahlten Tarif abgeschlossen' : 'seinen Tarif erneut bezahlt'}.`,
        v.isAmbassador
          ? `Ihnen wurden ${v.sum} zur Auszahlung gutgeschrieben — 10 % seiner Zahlung. Und so bei jeder seiner ersten ${v.cap} Zahlungen.`
          : `Ihnen wurden ${v.sum} als Guthaben gutgeschrieben — 10 % seiner Zahlung. Und so bei jeder weiteren Zahlung.`,
        v.isAmbassador
          ? `Auszahlung ab ${v.minWithdrawal} im Dashboard: ${v.link}`
          : `Das Guthaben wird automatisch mit Ihrer nächsten Rechnung verrechnet. Guthaben und Link: ${v.link}`,
        '',
        'Danke, dass Sie uns Ihren Kollegen empfehlen.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Neue Buchung: ${v.slot}`,
      lines: [
        `Soeben wurde ein Shooting für ${v.slot} gebucht (${v.minutes} Min., ${v.price}).`,
        '',
        `Kunde: ${v.clientName}`,
        `Telefon: ${v.clientPhone}`,
        `E-Mail: ${v.clientEmail}`,
        '',
        'Den Zahlungsstatus sehen Sie im Dashboard.',
      ],
    }
  },
}
