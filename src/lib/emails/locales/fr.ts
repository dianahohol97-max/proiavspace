import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** French (France). Vouvoiement, as in the dashboard. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'fr')
const galleries = (count: number) => n(count, '{n, plural, one {# galerie} other {# galeries}}')
const files = (count: number) => n(count, '{n, plural, one {# fichier} other {# fichiers}}')
const days = (count: number) => n(count, '{n, plural, one {# jour} other {# jours}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Ou supprimez depuis votre espace ce dont vous n’avez plus besoin pour tenir dans les ${freeGb} Go gratuits — rien ne disparaîtra : ${then}`

const SIGN = '— proiav'

export const fr: EmailCopy = {
  hello: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
  helloClient: 'Bonjour,',
  footerQuestions: 'Questions et factures',
  planNames: {
    free: 'Gratuite',
    basic: 'Essentiel',
    plus: 'Plus',
    pro: 'Maximum',
    site_basic: 'Site Essentiel',
    site_plus: 'Site Plus',
  },
  units: { mb: 'Mo', gb: 'Go', tb: 'To' },
  includes: {
    storage: (volume) => `${volume} de stockage pour les galeries`,
    galleries: 'Galeries clients avec mot de passe, sélection des photos et téléchargement en ZIP',
    video: 'Vidéo dans les galeries',
    noBranding: 'Sans la mention « proiav » dans les galeries',
    logo: 'Votre logo dans les galeries',
    stats: 'Statistiques des vues et des téléchargements',
    support: 'Support prioritaire',
    noExpiry: 'Galeries sans date limite tant que l’offre est active',
    sites: (count) => `${count} sites portfolio`,
    site: 'Site portfolio',
    domain: 'Domaine personnalisé',
  },

  receipt(v) {
    const credit = v.credit ? ` (dont ${v.credit} de crédit de parrainage)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Le renouvellement automatique est activé : prochain prélèvement le ${v.nextChargeAt}, ${v.nextChargeAmount}. Nous vous enverrons un rappel 3 jours avant. Vous pouvez le résilier à tout moment depuis votre espace — la période payée reste active jusqu’à son terme.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Le renouvellement automatique n’a pas pu être activé : un paiement via ${v.wallet} n’enregistre pas la carte. L’offre est active jusqu’au ${v.periodEnd}. Pour un renouvellement automatique la prochaine fois, payez par carte en cochant « Renouvellement automatique ».`
    } else {
      renewal = `Le renouvellement automatique est désactivé : l’offre est active jusqu’au ${v.periodEnd}, puis vous gardez un accès complet pendant encore ${days(v.graceDays)} ; ensuite, le compte passe en offre Gratuite.`
    }
    return {
      subject: `Reçu : ${v.amount} — offre « ${v.plan} », proiav`,
      lead: ['Paiement reçu. Merci de votre confiance !'],
      rows: [
        ['Offre', `« ${v.plan} »${v.volume ? `, ${v.volume}` : ''}`],
        ['Montant', `${v.amount}${credit}`],
        ['Date du paiement', v.paidAt],
        ['Période', `${v.period === 'year' ? 'un an' : 'un mois'}, du ${v.periodStart} au ${v.periodEnd}`],
        ['Active jusqu’au', v.periodEnd],
        ['Moyen de paiement', v.wallet ? `${v.wallet} (${v.provider})` : `carte, ${v.provider}`],
        ['Commande', v.orderId],
      ],
      list: { title: 'Ce qui est inclus', items: v.includes },
      after: [renewal, `${v.provider} vous envoie le reçu bancaire séparément.`],
      button: { label: 'Ouvrir mon espace', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Dans ${days(v.days)} — renouvellement automatique de l’offre « ${v.plan} », ${v.amount}`,
      lead: [
        `Le ${v.chargeAt}, nous prélèverons ${v.amount} sur votre carte enregistrée — renouvellement automatique de l’offre « ${v.plan} »${v.volume ? ` (${v.volume})` : ''} pour ${v.period === 'year' ? 'un an' : 'un mois'}.`,
      ],
      rows: [
        ['Offre', `« ${v.plan} »`],
        ['Montant', v.amount],
        ['Date du prélèvement', v.chargeAt],
      ],
      after: [
        'Si vous disposez d’un crédit de parrainage, nous en tiendrons compte — le prélèvement sera moins élevé.',
        'Vous ne souhaitez pas renouveler ? Résiliez le renouvellement automatique avant la date du prélèvement : la période payée reste active jusqu’à son terme et la carte ne sera plus débitée.',
      ],
      button: { label: 'Résilier le renouvellement automatique', url: `${v.billingUrl}#autopay` },
      link: { label: 'Espace et offres', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · échec du prélèvement de ${v.amount} pour l’offre « ${v.plan} »`,
      lines: [
        v.greeting,
        '',
        `Aujourd’hui, nous avons tenté de prélever ${v.amount} pour l’offre « ${v.plan} », mais la banque a refusé le paiement`,
        '(le plus souvent, la carte a expiré ou le solde était insuffisant).',
        '',
        `Rien ne disparaît. Jusqu’au ${v.graceUntil}, tout fonctionne comme avant :`,
        `les galeries restent ouvertes aux clients${v.volume ? `, limite de ${v.volume}` : ''}.`,
        '',
        `Pour conserver l’offre sans interruption, mettez à jour votre carte d’ici le ${v.graceUntil} :`,
        v.billingUrl,
        '',
        'Sinon :',
        `– à partir du ${v.graceUntil}, les galeries ne seront plus accessibles aux clients (vous les voyez toujours et pouvez les télécharger) ;`,
        `– à partir du ${v.deletesAt}, les fichiers seront supprimés du stockage.`,
        '',
        'Nous vous préviendrons 30, 7 et 1 jour avant la suppression.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo
      ? 'Votre mois gratuit de l’offre « Essentiel » obtenu grâce à l’import'
      : `La période payée de l’offre « ${v.plan} »`
    return {
      subject: `proiav · votre offre « ${v.plan} » a pris fin — tout fonctionne comme avant pendant ${days(v.graceDays)}`,
      lines: [
        v.greeting,
        '',
        `${what} a pris fin le ${v.endedAt}.`,
        '',
        `Jusqu’au ${v.closesAt}, rien ne change : les galeries restent ouvertes aux clients,`,
        `${v.volume ? `la limite reste de ${v.volume}, ` : ''}les vidéos restent en place.`,
        '',
        'Ensuite, si l’offre n’est pas renouvelée :',
        `– le ${v.closesAt} : les galeries se ferment aux clients. Vous voyez toujours tout dans votre espace`,
        '  et pouvez télécharger n’importe quelle galerie en ZIP ;',
        `– le ${v.deletesAt} : les fichiers sont définitivement supprimés du stockage.`,
        '',
        'Un seul paiement suffit pour renouveler l’offre, et tout se rouvre immédiatement :',
        v.billingUrl,
        '',
        `Vous ne comptez pas payer ? Téléchargez les galeries dont vous avez besoin avant le ${v.deletesAt} — c’est gratuit.`,
        fitIntoFree(v.freeGb, 'le compte passe en offre Gratuite et les galeries restent ouvertes aux clients.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · galeries fermées aux clients, fichiers conservés jusqu’au ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `La période de transition après la fin de l’offre « ${v.plan} » s’est terminée aujourd’hui. ${v.galleryCount === 1 ? 'Votre galerie est fermée' : `Vos ${galleries(v.galleryCount)} sont fermées`}`,
        'aux clients : à leur lien, ils voient « Cette galerie est temporairement indisponible » —',
        'dans leur propre langue, celle dans laquelle ils ont ouvert la galerie.',
        '',
        'Pour vous, rien n’a disparu : toutes les galeries et tous les fichiers sont dans votre espace. Vous pouvez',
        'télécharger gratuitement l’archive de n’importe quelle galerie.',
        '',
        `Les fichiers sont conservés jusqu’au ${v.deletesAt}. Après cette date, ils seront supprimés`,
        'du stockage et ne pourront pas être récupérés.',
        '',
        'Pour rouvrir les galeries, payez une offre ; elles seront accessibles aux mêmes',
        'liens, et les mots de passe comme les sélections des clients seront conservés :',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'les fichiers restants sont conservés, le compte passe en offre Gratuite et les galeries se rouvrent aux clients.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · vos fichiers seront supprimés demain — dernier rappel'
        : `proiav · vos fichiers seront supprimés dans ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Demain' : `Dans ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, le ${v.deletesAt}, nous supprimerons du stockage les fichiers`,
        `de vos galeries : ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Ceci est le dernier rappel.'] : []),
        '',
        'C’est définitif — une fois supprimés, les fichiers ne peuvent pas être récupérés.',
        '',
        'Trois façons de ne rien perdre :',
        '1. Payez une offre — les galeries se rouvrent aussitôt aux clients et les fichiers sont conservés :',
        `   ${v.billingUrl}`,
        `2. Téléchargez les galeries en ZIP avant le ${v.deletesAt} — gratuitement, depuis votre espace :`,
        `   ${v.dashboardUrl}`,
        `3. Supprimez ce dont vous n’avez plus besoin pour tenir dans les ${v.freeGb} Go gratuits — les fichiers restants sont conservés et les galeries se rouvrent aux clients.`,
        `   ${v.dashboardUrl}`,
        '',
        'Si vous n’avez plus besoin de ces fichiers, vous n’avez rien à faire.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · votre mois gratuit de l’offre « Essentiel » se termine le ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Votre mois gratuit de l’offre « Essentiel », obtenu grâce à l’import d’une galerie, se termine le ${v.endsAt}.`,
        '',
        `Pour rester sur « Essentiel » (${v.storageGb} Go, ${v.price}/mois), activez le paiement automatique :`,
        `nous prélevons ${v.price} maintenant, et le mois payé commence le ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Sans paiement automatique, après le ${v.endsAt}, tout fonctionne comme avant pendant ${days(v.graceDays)}, puis les galeries`,
        `se ferment aux clients, et ${days(v.retentionDays)} plus tard, les fichiers sont supprimés du stockage.`,
        'Nous vous préviendrons à l’avance.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'demain' : `dans ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} se ferment ${when}`
        : `proiav · la galerie « ${v.galleries[0].title} » se ferme ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `Avec l’offre Gratuite, une galerie reste ouverte ${days(v.freeDays)}. ${When}, celles-ci se fermeront aux clients :`
          : `Avec l’offre Gratuite, une galerie reste ouverte ${days(v.freeDays)}. ${When}, celle-ci se fermera aux clients :`,
        ...v.galleries.map((g) => `• « ${g.title} » — ${g.closesAt}`),
        '',
        `Une fois la galerie fermée, le client voit « Cette galerie est fermée. Contactez votre photographe. » Vous la voyez toujours dans votre espace, et ${days(v.purgeDays)} après la fermeture, les fichiers sont supprimés.`,
        '',
        `Pour garder vos galeries ouvertes sans limite de durée, passez à l’offre « Essentiel » : ${v.basicPrice}/mois, ${v.basicGb} Go, vidéo. La limite de durée est levée sur toutes les galeries dès le paiement :`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · votre période partenaire se termine le ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Merci de travailler avec nous ! Votre période partenaire sur l’offre « ${v.plan} » se termine le ${v.endsAt}.`,
        '',
        `Pour rester sur « ${v.plan} » sans interruption, souscrivez l’offre avec paiement automatique : ${v.priceMonth}/mois ou ${v.priceYear}/an (deux mois offerts). Vous pouvez aussi choisir une autre offre, à partir de « Essentiel » à ${v.basicPrice}/mois.`,
        v.billingUrl,
        '',
        `Si vous ne faites rien, le compte passe en offre Gratuite (${v.freeGb} Go) : les galeries existantes restent accessibles aux clients pendant encore ${days(v.freeDays)}, et chaque nouvelle galerie pendant ${days(v.freeDays)} à partir de sa création.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Vos photos sont prêtes : la galerie « ${v.galleryTitle} » est ouverte — vous pouvez les regarder, choisir vos préférées et les télécharger.`,
    ]
    if (v.hasPassword) lead.push('La galerie est protégée par un mot de passe — le photographe vous l’enverra séparément, s’il ne l’a pas déjà fait.')
    return {
      subject: `Vos photos sont prêtes — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Photographe', v.photographerName]] : undefined,
      button: { label: 'Ouvrir la galerie', url: v.url },
      after: [
        'Vous recevez cet e-mail parce que le photographe a indiqué votre adresse pour vous prévenir quand les photos seraient prêtes. Si vous y répondez, votre réponse parviendra au photographe.',
      ],
    }
  },

  referralReward(v) {
    const subject = v.isAmbassador
      ? `+${v.sum} — ${v.first ? 'votre première récompense de parrainage' : 'récompense de parrainage'}`
      : `+${v.sum} — ${v.first ? 'votre premier crédit de parrainage' : 'crédit de parrainage'}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `Un ou une photographe venu(e) par votre lien vient ${v.first ? 'de choisir une offre payante' : 'de renouveler son offre'}.`,
        v.isAmbassador
          ? `Vous gagnez ${v.sum} à retirer — 10 % de son paiement. Il en sera de même pour chacun de ses ${v.cap} premiers paiements.`
          : `Vous gagnez ${v.sum} de crédit — 10 % de son paiement. Et ainsi à chacun de ses paiements.`,
        v.isAmbassador
          ? `Retrait possible à partir de ${v.minWithdrawal} depuis votre espace : ${v.link}`
          : `Le crédit est déduit automatiquement de votre prochaine facture. Solde et lien : ${v.link}`,
        '',
        'Merci de nous recommander à vos confrères.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Nouvelle réservation : ${v.slot}`,
      lines: [
        `Une séance vient d’être réservée pour le ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Client : ${v.clientName}`,
        `Téléphone : ${v.clientPhone}`,
        `E-mail : ${v.clientEmail}`,
        '',
        'Vérifiez le statut du paiement dans votre espace.',
      ],
    }
  },
}
