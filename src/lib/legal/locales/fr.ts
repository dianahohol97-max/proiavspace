import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** French (France) — translated from the Ukrainian (legally binding) version. */
export const fr: LegalCopy = {
  backToHome: '← Accueil',
  reviewNote:
    'Cette traduction est fournie à titre informatif. Seule la version ukrainienne fait foi ; en cas de divergence, le texte ukrainien prévaut. La traduction ne crée aucune obligation allant au-delà de la version ukrainienne.',
  oferta: {
    title: 'Offre publique (conditions générales)',
    updated: `Version du ${UPDATED}`,
    intro:
      `Le présent document constitue une proposition publique officielle (offre) de ${ENTITY} (ci-après le « Prestataire ») de conclure un contrat d’accès au service en ligne « проЯв » (ci-après le « Service ») aux conditions exposées ci-dessous. En vous inscrivant au Service ou en effectuant un paiement, vous (ci-après l’« Utilisateur ») acceptez pleinement et sans réserve les conditions de la présente offre.`,
    sections: [
      {
        heading: '1. Définitions',
        paragraphs: [
          '« Service » — le produit logiciel web « проЯв » (proiav.space), qui fournit aux photographes des outils de galeries clients en ligne, de sites personnels et de prise de réservations.',
          '« Utilisateur » — le photographe ou toute autre personne ayant créé un compte sur le Service.',
          '« Client de l’Utilisateur » — le tiers auquel l’Utilisateur donne accès à une galerie ou à un formulaire de réservation.',
          '« Offre tarifaire » — l’ensemble des fonctionnalités et le volume de stockage fournis contre paiement, conformément à la page des tarifs.',
        ],
      },
      {
        heading: '2. Objet du contrat',
        paragraphs: [
          'Le Prestataire donne à l’Utilisateur accès aux fonctionnalités du Service aux conditions de l’Offre tarifaire choisie, et l’Utilisateur s’engage à payer cet accès (sauf pour l’offre gratuite) et à respecter les conditions de la présente offre.',
          'Le Service est fourni « en l’état ». Le Prestataire fait évoluer le Service et peut modifier l’ensemble de ses fonctionnalités, en informant à l’avance des changements importants.',
        ],
      },
      {
        heading: '3. Offres tarifaires et paiement',
        paragraphs: [
          'Les prix en vigueur sont indiqués sur la page des tarifs, en hryvnias (₴). Le paiement s’effectue par carte d’une banque ukrainienne via un prestataire de paiement (Monobank / LiqPay) ; le Prestataire ne conserve pas les données complètes de la carte de paiement.',
          'L’abonnement est valable pendant la période payée (un mois ou un an) et, si le renouvellement automatique est activé, se renouvelle automatiquement jusqu’à ce que l’Utilisateur le résilie.',
          'Le renouvellement automatique s’active au moyen de la case « Renouvellement automatique » située à côté du bouton de paiement sur la page des tarifs ; le montant et la périodicité du prélèvement sont indiqués à côté. Si la case reste cochée, le prestataire de paiement (Monobank) conserve un jeton (token) de la carte, et chaque période suivante, le même montant correspondant à l’Offre tarifaire choisie est prélevé automatiquement sur cette carte (déduction faite du crédit de parrainage, le cas échéant). Si la case est décochée, la carte n’est pas enregistrée et l’Offre tarifaire n’est valable que pour la période payée.',
          'Trois jours avant chaque prélèvement automatique, le Service envoie à l’adresse e-mail de l’Utilisateur un message indiquant le montant, la date du prélèvement et un lien de résiliation. Le renouvellement automatique peut être résilié à tout moment depuis l’espace personnel (rubrique « Offre ») ; la carte n’est alors plus débitée et le jeton enregistré est supprimé.',
          'Un paiement via Google Pay ou Apple Pay n’enregistre pas la carte ; le renouvellement automatique n’est donc pas disponible pour ce mode de paiement : l’Offre tarifaire est valable pour la période payée.',
          'Le paiement annuel est proposé au prix de dix mois (deux mois offerts).',
        ],
      },
      {
        heading: '4. Remboursement',
        paragraphs: [
          'L’accès au Service numérique étant fourni immédiatement, la période payée n’est pas remboursable, sauf dans les cas expressément prévus par la législation ukrainienne relative à la protection des droits des consommateurs.',
          'Le renouvellement automatique peut être résilié à tout moment depuis l’espace personnel ; après résiliation, l’Offre tarifaire reste valable jusqu’à la fin de la période payée, puis l’accès complet est maintenu pendant 14 jours supplémentaires dans la limite de l’Offre tarifaire.',
          'Si, à l’issue de ces 14 jours, les fichiers de l’Utilisateur dépassent la limite de l’offre gratuite (3 Go), les galeries sont fermées aux clients de l’Utilisateur, et les fichiers sont conservés 60 jours de plus, puis supprimés du stockage sans possibilité de récupération. Pendant ces 60 jours, l’Utilisateur dispose d’un accès complet à ses fichiers dans son espace personnel, peut les télécharger ou renouveler son Offre tarifaire — les galeries sont alors rouvertes aux mêmes liens. Le Service prévient l’Utilisateur par e-mail à chaque étape (notamment 30, 7 et 1 jour avant la suppression). Dans la limite de son plafond, l’offre gratuite n’a pas de durée de conservation.',
          'Le mois gratuit de l’offre « Essentiel » accordé pour l’import d’une galerie (promotion) est octroyé une seule fois par compte ; à son terme, les mêmes règles s’appliquent qu’à la fin d’une période payée.',
        ],
      },
      {
        heading: '5. Droits et obligations de l’Utilisateur',
        paragraphs: [
          'L’Utilisateur garantit qu’il détient tous les droits sur le contenu (photographies, etc.) qu’il importe, et il est responsable de sa licéité, notamment de l’existence du consentement des personnes représentées au traitement et à la diffusion de leur image.',
          'L’Utilisateur détermine lui-même la finalité et l’étendue du traitement des données personnelles de ses Clients et agit en qualité de responsable du traitement de ces données ; le Prestataire les traite exclusivement sur instruction de l’Utilisateur (voir la Politique de confidentialité).',
          'Il est interdit d’utiliser le Service pour un contenu illégal, frauduleux ou portant atteinte aux droits de tiers.',
        ],
      },
      {
        heading: '6. Responsabilité',
        paragraphs: [
          'Le Prestataire s’efforce d’assurer le fonctionnement ininterrompu du Service, mais ne garantit pas l’absence de défaillances techniques et n’est pas responsable des pertes causées par un cas de force majeure ou par les actions de tiers (prestataires d’hébergement, de paiement, de télécommunications).',
          'Le Prestataire n’est pas partie aux relations entre l’Utilisateur et ses Clients et n’est pas responsable du contenu des galeries et des sites, ni des accords relatifs aux séances photo.',
        ],
      },
      {
        heading: '7. Données personnelles',
        paragraphs: [
          'Les données personnelles sont traitées conformément à la loi de l’Ukraine « Sur la protection des données personnelles » et à la Politique de confidentialité, qui fait partie intégrante de la présente offre.',
        ],
      },
      {
        heading: '8. Durée et modifications',
        paragraphs: [
          'L’offre est valable pour une durée indéterminée à compter de sa publication. Le Prestataire a le droit d’en modifier les conditions en publiant une nouvelle version sur cette page ; la poursuite de l’utilisation du Service vaut acceptation de la nouvelle version.',
        ],
      },
      {
        heading: '9. Coordonnées du Prestataire',
        paragraphs: [
          `Dénomination : ${ENTITY}`,
          `Régime fiscal : contribuable à l’impôt unique, troisième groupe`,
          `Date d’immatriculation : 04.09.2023`,
          `Siège : Ukraine, Ternopil (adresse complète sur demande)`,
          `E-mail : ${SUPPORT_EMAIL}`,
          `Les coordonnées complètes (numéro d’identification fiscale RNOKPP, compte bancaire) figurent sur la facture et sont communiquées sur demande.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    updated: `Version du ${UPDATED}`,
    intro:
      `La présente Politique explique quelles données personnelles le service « проЯв » (${ENTITY}) traite, dans quel but et sur quels fondements. En utilisant le Service, vous acceptez la présente Politique.`,
    sections: [
      {
        heading: '1. Les données que nous traitons',
        paragraphs: [
          'Données du compte : adresse e-mail, nom/nom de marque, paramètres du profil.',
          'Contenu importé par le photographe : photographies et informations associées aux galeries et aux sites. Ces données peuvent contenir l’image de tiers (les Clients du photographe).',
          'Données techniques : journaux d’accès, statistiques d’utilisation anonymisées (Google Analytics).',
          'Les données de paiement sont traitées par le prestataire de paiement (Monobank / LiqPay) ; nous ne recevons que le statut du paiement, et non les coordonnées complètes de la carte.',
        ],
      },
      {
        heading: '2. Rôles : responsable du traitement et sous-traitant',
        paragraphs: [
          'Pour les données du compte du photographe, le Prestataire est le responsable du traitement.',
          'Pour les données personnelles des Clients (notamment leur image sur les photos), le responsable du traitement est le photographe lui-même — c’est lui qui détermine la finalité du traitement. Le Prestataire agit en qualité de sous-traitant et traite ces données exclusivement sur instruction du photographe et pour le fonctionnement du Service.',
        ],
      },
      {
        heading: '3. Finalités et fondements du traitement',
        paragraphs: [
          'Fourniture des fonctionnalités du Service (exécution du contrat d’offre), traitement des paiements, assistance aux utilisateurs, sécurité et respect des obligations légales.',
          'Fondements juridiques : exécution du contrat, consentement de la personne concernée, intérêts légitimes du Prestataire et respect d’obligations légales.',
        ],
      },
      {
        heading: '4. Transmission et sous-traitants',
        paragraphs: [
          'Nous faisons appel à des fournisseurs d’infrastructure fiables : hébergement de l’application et de la base de données, stockage de fichiers dans le cloud, prestataire de paiement et service de mesure d’audience. Ils ne traitent les données que dans la mesure nécessaire à la fourniture de leurs services.',
          'Nous ne vendons pas de données personnelles à des tiers.',
        ],
      },
      {
        heading: '5. Conservation',
        paragraphs: [
          'Les données sont conservées tant que le compte existe ou aussi longtemps que l’exige la finalité du traitement ou la loi. Après la suppression du compte, les données sont supprimées ou anonymisées dans un délai raisonnable.',
          'Les fichiers sont conservés dans un stockage cloud ; les originaux ne sont pas modifiés.',
        ],
      },
      {
        heading: '6. Vos droits',
        paragraphs: [
          'Vous avez le droit d’accéder à vos données, de les faire rectifier ou supprimer, de demander la limitation de leur traitement et de vous opposer au traitement, ainsi que le droit de retirer votre consentement.',
          `Pour exercer ces droits, écrivez à ${SUPPORT_EMAIL}. Si vous êtes Client d’un photographe, adressez-vous en priorité au photographe lui-même, en tant que responsable du traitement de vos données.`,
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Nous utilisons des cookies nécessaires au fonctionnement de l’authentification et à l’enregistrement des paramètres, ainsi que des cookies de mesure d’audience pour comprendre l’utilisation du Service. Vous pouvez gérer les cookies dans les paramètres de votre navigateur.',
        ],
      },
      {
        heading: '8. Contact',
        paragraphs: [
          `Pour toute question relative à la confidentialité : ${SUPPORT_EMAIL}. Responsable du traitement : ${ENTITY}.`,
        ],
      },
    ],
  },
}
