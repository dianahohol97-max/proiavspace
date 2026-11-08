import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** Italian. «tu» like the dashboard and client pages. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'it')
const galleries = (count: number) => n(count, '{n, plural, one {# galleria} other {# gallerie}}')
const files = (count: number) => n(count, '{n, plural, one {# file} other {# file}}')
const days = (count: number) => n(count, '{n, plural, one {# giorno} other {# giorni}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Oppure elimina dalla dashboard ciò che non ti serve più, per rientrare nei ${freeGb} GB gratuiti: così non sparisce nulla, ${then}`

const SIGN = '— proiav'

export const it: EmailCopy = {
  hello: (name) => (name ? `Ciao ${name},` : 'Ciao,'),
  helloClient: 'Buongiorno!',
  footerQuestions: 'Domande e fatture',
  footerSupport: 'Assistenza',
  planNames: {
    free: 'Gratuito',
    basic: 'Base',
    plus: 'Plus',
    pro: 'Massimo',
    site_basic: 'Sito Base',
    site_plus: 'Sito Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} di spazio per le gallerie`,
    galleries: 'Gallerie per i clienti con password, selezione delle foto e download in ZIP',
    video: 'Video nelle gallerie',
    noBranding: 'Nessun marchio «proiav» nelle gallerie',
    logo: 'Il tuo logo nelle gallerie',
    stats: 'Statistiche di visualizzazioni e download',
    support: 'Assistenza prioritaria',
    noExpiry: 'Le gallerie non scadono finché il piano è attivo',
    sites: (count) => `${count} siti portfolio`,
    site: 'Sito portfolio',
    domain: 'Dominio personalizzato',
  },

  receipt(v) {
    const credit = v.credit ? ` (di cui ${v.credit} dal credito referral)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Il rinnovo automatico è attivo: il prossimo addebito sarà il ${v.nextChargeAt}, ${v.nextChargeAmount}. Ti manderemo un promemoria 3 giorni prima. Puoi disattivarlo in qualsiasi momento dalla dashboard: il periodo già pagato resta attivo fino alla fine.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Non è stato possibile attivare il rinnovo automatico: il pagamento con ${v.wallet} non salva la carta. Il piano è attivo fino al ${v.periodEnd}. Per rinnovarlo in automatico la prossima volta, paga con carta lasciando selezionata la casella «Rinnovo automatico».`
    } else {
      renewal = `Il rinnovo automatico è disattivato: il piano è attivo fino al ${v.periodEnd}, poi mantieni l’accesso completo per altri ${days(v.graceDays)}, dopodiché l’account diventa gratuito.`
    }
    return {
      subject: `Ricevuta: ${v.amount} — piano «${v.plan}», proiav`,
      lead: ['Pagamento ricevuto. Grazie di essere con noi!'],
      rows: [
        ['Piano', `«${v.plan}»${v.volume ? `, ${v.volume}` : ''}`],
        ['Importo', `${v.amount}${credit}`],
        ['Data del pagamento', v.paidAt],
        ['Periodo', `${v.period === 'year' ? 'anno' : 'mese'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Attivo fino al', v.periodEnd],
        ['Metodo di pagamento', v.wallet ? `${v.wallet} (${v.provider})` : `carta, ${v.provider}`],
        ['Ordine', v.orderId],
      ],
      list: { title: 'Cosa comprende', items: v.includes },
      after: [renewal, `${v.provider} invia la ricevuta bancaria a parte.`],
      button: { label: 'Apri la dashboard', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Tra ${days(v.days)} — rinnovo automatico del piano «${v.plan}», ${v.amount}`,
      lead: [
        `Il ${v.chargeAt} addebiteremo ${v.amount} sulla carta salvata: è il rinnovo automatico del piano «${v.plan}»${v.volume ? ` (${v.volume})` : ''} per un ${v.period === 'year' ? 'anno' : 'mese'}.`,
      ],
      rows: [
        ['Piano', `«${v.plan}»`],
        ['Importo', v.amount],
        ['Data dell’addebito', v.chargeAt],
      ],
      after: [
        'Se hai del credito referral, ne terremo conto e l’addebito sarà più basso.',
        'Non vuoi rinnovare? Disattiva il rinnovo automatico prima della data dell’addebito: il periodo già pagato resta attivo fino alla fine e la carta non verrà più addebitata.',
      ],
      button: { label: 'Disattiva il rinnovo automatico', url: `${v.billingUrl}#autopay` },
      link: { label: 'Dashboard e piani', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · addebito di ${v.amount} per il piano «${v.plan}» non riuscito`,
      lines: [
        v.greeting,
        '',
        `Oggi abbiamo provato ad addebitare ${v.amount} per il piano «${v.plan}», ma la banca ha rifiutato il pagamento`,
        '(di solito perché la carta è scaduta o i fondi non erano sufficienti).',
        '',
        `Non sparisce nulla. Fino al ${v.graceUntil} tutto funziona come prima:`,
        `le gallerie restano aperte ai clienti${v.volume ? `, con limite di ${v.volume}` : ''}.`,
        '',
        `Per mantenere il piano senza interruzioni, aggiorna la carta entro il ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Altrimenti:',
        `– dal ${v.graceUntil} le gallerie non saranno più accessibili ai clienti (tu continui a vederle e puoi scaricarle);`,
        `– dal ${v.deletesAt} i file verranno eliminati dallo spazio di archiviazione.`,
        '',
        'Ti avviseremo 30, 7 e 1 giorno prima dell’eliminazione.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo ? 'Il tuo mese gratuito di «Base» per l’importazione' : `Il periodo pagato del piano «${v.plan}»`
    return {
      subject: `proiav · il tuo piano «${v.plan}» è terminato: per ${days(v.graceDays)} tutto funziona come prima`,
      lines: [
        v.greeting,
        '',
        `${what} è terminato il ${v.endedAt}.`,
        '',
        `Fino al ${v.closesAt} non cambia nulla: le gallerie restano aperte ai clienti,`,
        `${v.volume ? `il limite è di ${v.volume} e ` : ''}i video restano al loro posto.`,
        '',
        'Dopo, se il piano non viene rinnovato:',
        `– ${v.closesAt}: le gallerie si chiudono ai clienti. Tu continui a vedere tutto nella dashboard`,
        '  e puoi scaricare qualsiasi galleria in ZIP;',
        `– ${v.deletesAt}: i file vengono eliminati definitivamente dallo spazio di archiviazione.`,
        '',
        'Per rinnovare il piano basta un pagamento, e tutto si riapre subito:',
        v.billingUrl,
        '',
        `Non pensi di pagare? Scarica le gallerie che ti servono entro il ${v.deletesAt}: è gratis.`,
        fitIntoFree(v.freeGb, 'l’account diventa gratuito e le gallerie restano aperte ai clienti.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · gallerie chiuse ai clienti, i file sono conservati fino al ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Oggi è terminato il periodo di transizione dopo la fine del piano «${v.plan}». Le tue gallerie (${galleries(v.galleryCount)})`,
        'sono chiuse ai clienti: al link vedono «Questa galleria è temporaneamente non disponibile»,',
        'nella loro lingua, quella in cui hanno aperto la galleria.',
        '',
        'Per te non è sparito nulla: tutte le gallerie e i file sono nella dashboard. Puoi',
        'scaricare gratuitamente l’archivio di qualsiasi galleria.',
        '',
        `I file vengono conservati fino al ${v.deletesAt}. Dopo questa data saranno eliminati dallo`,
        'spazio di archiviazione e non sarà possibile recuperarli.',
        '',
        'Per riaprire le gallerie, paga un piano: saranno di nuovo disponibili agli stessi',
        'link, e password e selezioni dei clienti verranno mantenute:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'i file rimanenti restano, l’account diventa gratuito e le gallerie si riaprono ai clienti.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · domani i file verranno eliminati — ultimo promemoria'
        : `proiav · i file verranno eliminati tra ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Domani' : `Tra ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, il ${v.deletesAt}, elimineremo dallo spazio di archiviazione i file`,
        `delle tue gallerie: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Questo è l’ultimo promemoria.'] : []),
        '',
        'È definitivo: una volta eliminati, i file non si possono recuperare.',
        '',
        'Tre modi per non perdere nulla:',
        '1. Paga un piano: le gallerie si riaprono subito ai clienti e i file restano:',
        `   ${v.billingUrl}`,
        `2. Scarica le gallerie in ZIP entro il ${v.deletesAt}: è gratis, dalla dashboard:`,
        `   ${v.dashboardUrl}`,
        `3. Elimina ciò che non ti serve più per rientrare nei ${v.freeGb} GB gratuiti: i file rimanenti restano e le gallerie si riaprono ai clienti.`,
        `   ${v.dashboardUrl}`,
        '',
        'Se questi file non ti servono più, non devi fare nulla.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · il tuo mese gratuito di «Base» termina il ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Il tuo mese gratuito del piano «Base», ottenuto importando una galleria, termina il ${v.endsAt}.`,
        '',
        `Per restare su «Base» (${v.storageGb} GB, ${v.price}/mese), attiva il pagamento automatico:`,
        `addebitiamo ${v.price} adesso e il mese a pagamento parte dal ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Senza pagamento automatico, dopo il ${v.endsAt} tutto funziona come prima per ${days(v.graceDays)}, poi le gallerie`,
        `si chiudono ai clienti e ${days(v.retentionDays)} dopo i file vengono eliminati dallo spazio di archiviazione.`,
        'Ti avviseremo in anticipo.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'domani' : `tra ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} si chiudono ${when}`
        : `proiav · la galleria «${v.galleries[0].title}» si chiude ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `Con il piano gratuito una galleria resta aperta per ${days(v.freeDays)}. ${When} queste gallerie si chiuderanno ai clienti:`
          : `Con il piano gratuito una galleria resta aperta per ${days(v.freeDays)}. ${When} questa galleria si chiuderà ai clienti:`,
        ...v.galleries.map((g) => `• «${g.title}» — ${g.closesAt}`),
        '',
        `Dopo la chiusura il cliente vede «Questa galleria è chiusa. Contatta il tuo fotografo». Tu continui a vederla nella dashboard, e ${days(v.purgeDays)} dopo la chiusura i file vengono eliminati.`,
        '',
        `Per tenere le gallerie aperte senza limiti di tempo, passa a «Base»: ${v.basicPrice}/mese, ${v.basicGb} GB, video. Il limite di tempo viene rimosso da tutte le gallerie subito dopo il pagamento:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · il tuo periodo partner termina il ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Grazie per aver lavorato con noi! Il tuo periodo partner sul piano «${v.plan}» termina il ${v.endsAt}.`,
        '',
        `Per restare su «${v.plan}» senza interruzioni, attiva il piano con pagamento automatico: ${v.priceMonth}/mese oppure ${v.priceYear}/anno (due mesi in regalo). Puoi anche scegliere un altro piano, a partire da «Base» a ${v.basicPrice}/mese.`,
        v.billingUrl,
        '',
        `Se non fai nulla, l’account diventa gratuito (${v.freeGb} GB): le gallerie esistenti restano accessibili ai clienti per altri ${days(v.freeDays)}, e ogni nuova galleria per ${days(v.freeDays)} dalla creazione.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Le tue foto sono pronte: la galleria «${v.galleryTitle}» è aperta, puoi guardarle, scegliere le tue preferite e scaricarle.`,
    ]
    if (v.hasPassword) lead.push('La galleria è protetta da password: se non l’ha già fatto, il fotografo te la invierà a parte.')
    return {
      subject: `Le tue foto sono pronte — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotografo', v.photographerName]] : undefined,
      button: { label: 'Apri la galleria', url: v.url },
      after: [
        'Ricevi questa e-mail perché il fotografo ha indicato il tuo indirizzo per avvisarti quando le foto sono pronte. Se rispondi, la risposta arriverà al fotografo.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'ricompensa referral' : 'credito referral'
    return {
      subject: v.first
        ? `+${v.sum} — ${v.isAmbassador ? 'la tua prima ricompensa referral' : 'il tuo primo credito referral'}`
        : `+${v.sum} — ${v.isAmbassador ? 'la tua' : 'il tuo'} ${what}`,
      lines: [
        v.greeting,
        '',
        `Un fotografo arrivato tramite il tuo link ha appena ${v.first ? 'scelto un piano a pagamento' : 'pagato di nuovo il suo piano'}.`,
        v.isAmbassador
          ? `Hai guadagnato ${v.sum} da prelevare: il 10% del suo pagamento. Lo stesso per ciascuno dei suoi primi ${v.cap} pagamenti.`
          : `Hai guadagnato ${v.sum} di credito: il 10% del suo pagamento. E così per ogni suo pagamento.`,
        v.isAmbassador
          ? `Puoi prelevare a partire da ${v.minWithdrawal} dalla dashboard: ${v.link}`
          : `Il credito si applica automaticamente al tuo prossimo pagamento. Saldo e link: ${v.link}`,
        '',
        'Grazie per averci consigliato ai colleghi.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Nuova prenotazione: ${v.slot}`,
      lines: [
        `È appena stato prenotato un servizio per ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Cliente: ${v.clientName}`,
        `Telefono: ${v.clientPhone}`,
        `E-mail: ${v.clientEmail}`,
        '',
        'Controlla lo stato del pagamento nella dashboard.',
      ],
    }
  },
}
