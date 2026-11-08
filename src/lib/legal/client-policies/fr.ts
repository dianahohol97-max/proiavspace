import type { ClientPolicyLocale } from '../clientPolicies'

/** French (France) — the photographer's ready-made client documents. */
export const fr: ClientPolicyLocale = {
  defaultName: 'le Photographe',
  render: (name, email) => {
    const to = email ? `${email}` : 'l’adresse de contact indiquée sur le site'
    return {
      privacy: {
        title: 'Politique de confidentialité',
        blocks: [
          `Ce document explique comment ${name} (le « Photographe ») collecte et utilise vos données personnelles lorsque vous réservez une séance ou consultez votre galerie en ligne.`,
          '# Les données que nous collectons',
          'Votre nom, vos coordonnées (téléphone, e-mail, réseaux sociaux), les détails de votre commande ainsi que les photographies prises pendant la séance. L’accès à la galerie peut nécessiter un mot de passe et un identifiant technique de session.',
          '# À quoi elles servent',
          'À réaliser la séance et à vous livrer vos photographies, à convenir des détails, à établir une facture et, avec votre accord, à présenter certaines images dans un portfolio. Nous ne vendons pas vos données à des tiers.',
          '# Publication des photographies',
          'Les photos de votre séance ne sont publiées ni dans un portfolio ni sur les réseaux sociaux sans votre accord. Vous pouvez retirer votre accord à tout moment en nous écrivant.',
          '# Conservation',
          'Nous conservons la galerie et les fichiers sources pendant la durée convenue lors de la commande ; ils peuvent ensuite être supprimés. Les sauvegardes ne sont pas conservées plus longtemps que techniquement nécessaire.',
          '# Vos droits',
          `Vous pouvez demander une copie, la rectification ou la suppression de vos données, et retirer votre accord de publication. Pour cela, écrivez à ${to}.`,
          '# Contact',
          `Pour toute question concernant vos données, contactez ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Conditions de paiement et de remboursement',
        blocks: [
          `Ces conditions s’appliquent à l’acompte, au paiement et au remboursement des prestations photographiques fournies par ${name} (le « Photographe »).`,
          '# Réservation et acompte',
          'La date de votre séance vous est réservée dès le versement d’un acompte. L’acompte confirme la réservation et bloque le créneau dans l’agenda du Photographe.',
          '# Annulation par le client',
          'Si vous annulez la séance plus de 7 jours avant la date, l’acompte vous est intégralement remboursé ou reporté sur une autre date. En cas d’annulation plus tardive, l’acompte peut être conservé en compensation du temps réservé.',
          '# Annulation ou force majeure',
          'Si la séance ne peut pas avoir lieu du fait du Photographe ou en cas de force majeure, c’est vous qui choisissez : report à une autre date ou remboursement intégral de l’acompte.',
          '# Photographies livrées',
          'La prestation photographique étant personnalisée et déjà exécutée, le paiement d’une séance réalisée et des photographies retouchées n’est pas remboursable. Si le résultat diffère sensiblement de ce qui avait été convenu, nous nous entendrons sur des retouches complémentaires.',
          '# Comment obtenir un remboursement',
          `Pour demander un remboursement ou un report, écrivez à ${to}. Les sommes sont remboursées par le moyen de paiement utilisé, dans un délai raisonnable.`,
        ],
      },
    }
  },
}
