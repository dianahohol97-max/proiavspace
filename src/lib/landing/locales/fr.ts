import type { LandingCopy } from '../copy'

/** French (France) — marketing landing. */
export const fr: LandingCopy = {
  nav: {
    features: 'Fonctionnalités',
    galleries: 'Galeries',
    sites: 'Sites',
    pricing: 'Tarifs',
    themes: 'Thèmes',
    blog: 'Blog',
    signIn: 'Se connecter',
    ctaShort: 'Commencer gratuitement',
    dashboard: 'Mon espace',
  },
  hero: {
    chips: ['Mariages', 'Familles', 'Portraits', 'Studios'],
    titleBefore: 'Tout ce qui se passe ',
    titleAccent: 'après',
    titleAfter: ' le déclic',
    subtitle: 'La galerie client en ligne pour photographes : livrez une séance avec un seul et beau lien.',
    lede:
      'Des galeries où le client comprend tout de suite comment récupérer ses photos — sans Google Drive ni « comment je télécharge ? ». Favoris d’un clic sur le cœur, mot de passe et date d’expiration, originaux sans compression. Et partout, uniquement votre marque.',
    cta: 'Commencer gratuitement',
    ctaNote: '3 Go offerts, chaque galerie reste ouverte 30 jours. Sans carte bancaire.',
    statNumber: '30 000',
    statText: 'photos livrées aux clients via les galeries proiav',
    slotPay: 'Payer le photographe',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Histoires de mariage',
  },
  strip: { label: 'Le travail des photographes' },
  products: {
    label: 'Galeries · réservations · un seul espace',
    titleBefore: 'La galerie client pour photographes — ',
    titleAccent: 'à votre image',
    lede:
      'Tout commence par les galeries — c’est là que le photographe retrouve ses clients chaque semaine. Et si vous voulez que vos clients choisissent eux-mêmes leur créneau et paient tout de suite, la réservation fonctionne déjà, elle aussi.',
    soon: 'Bientôt',
    items: [
      {
        no: '01 — Galeries',
        title: 'Livrez vos séances avec élégance',
        text: 'Vous importez les photos — le client reçoit un beau lien et télécharge lui-même, sans Google Drive ni « comment je télécharge ? ». Favoris, mot de passe, date d’expiration, archive ZIP, statistiques.',
        tagStrong: 'Originaux sans compression.',
        tagRest: ' Les fichiers tels que vous les avez pris',
      },
      {
        no: '02 — Réservations',
        title: 'Le client choisit son créneau',
        text: 'Et paie aussitôt — Monobank, WayForPay, cagnotte ou virement. Pas de double réservation, et les créneaux non payés se libèrent tout seuls.',
        tagStrong: 'L’argent vous arrive directement.',
        tagRest: ' Nous ne touchons jamais aux paiements',
      },
    ],
  },
  bento: {
    label: 'Tout dans un seul espace',
    titleBefore: 'Les petits détails qui rendent le travail ',
    titleAccent: 'serein',
    cards: {
      selection: {
        label: 'Sélection',
        text: 'D’un cœur, le client choisit les photos à retoucher — la liste des fichiers s’exporte en un clic',
      },
      galleryPhoto: 'Galerie',
      protection: { label: 'Protection', text: 'Mot de passe et date d’expiration pour chaque galerie' },
      archive: { label: 'Archive', text: 'Tout en un clic — le ZIP se prépare sans file d’attente' },
      payments: { label: 'Paiements', text: 'Directement sur votre carte. Toujours.' },
      stats: { label: 'Statistiques', number: '247', text: 'vues de la galerie cette semaine' },
      themes: {
        label: 'Design de la galerie',
        text: 'Trois ambiances, cinq mises en page',
        chips: ['Mosaïque', 'Collage', 'Éditorial', 'Carrés', 'Portrait 3:4'],
      },
      previewPhoto: 'Des aperçus qui chargent vite',
      autoRelease: { label: 'Réservations', text: 'Un créneau non payé se libère tout seul au bout de quelques heures' },
      video: {
        label: 'Vidéos lourdes',
        text: 'Envoi par morceaux : une coupure réseau à 95 % vous coûte quelques secondes, pas des heures',
      },
      email: { label: 'E-mail', text: 'Un e-mail pour chaque nouvelle réservation, aussitôt, avec les coordonnées du client' },
    },
  },
  principles: {
    huge: 'Principes',
    title: 'Comment la plateforme est pensée de l’intérieur',
    lede: 'Ce n’est pas une liste de fonctionnalités — ce sont des choix sur lesquels nous ne revenons pas.',
    items: [
      {
        title: 'Votre marque au premier plan',
        text: 'Dès la première offre payante, vos galeries ne nous mentionnent plus du tout. Le client ne voit que le photographe.',
      },
      {
        title: 'L’argent vous arrive directement',
        text: 'Les paiements des séances arrivent sur votre compte marchand ou votre carte. La plateforme ne garde jamais votre argent, pas même une seconde.',
      },
      {
        title: 'Les originaux sont intouchables',
        text: 'Les fichiers sont conservés à l’octet près. Le client parcourt des aperçus rapides et télécharge la pleine qualité.',
      },
      {
        title: 'Payé = la banque l’a confirmé',
        text: 'Le statut « payé » n’est attribué qu’après vérification auprès de la banque — jamais sur la seule parole du client ni sur un webhook non vérifié.',
      },
    ],
  },
  pricing: {
    label: 'Tarifs',
    titleBefore: 'Tarifs de la galerie en ligne : ',
    titleAccent: 'vous ne payez que l’espace',
    lede:
      'La sélection des photos par le client est gratuite pour tous. Les offres payantes retirent notre marque et ajoutent la vidéo et plus d’espace ; à partir de Plus, les statistiques.',
    perMonth: '/ mois',
    freeLabel: 'sans carte bancaire',
    yearHint: (year) => `ou ${year} ₴ par an — deux mois offerts`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} To de stockage` : `${gb} Go de stockage`),
    popular: 'Recommandée',
    fineprint:
      'Paiement par carte de n’importe quelle banque ukrainienne. Résiliable à tout moment — tout continue de fonctionner 14 jours de plus. Ensuite, si vous dépassez les 3 Go gratuits, les galeries se ferment aux clients et les fichiers sont conservés 60 jours de plus.',
    plans: {
      free: {
        name: 'Gratuite',
        note: 'Chaque galerie reste ouverte 30 jours — pour essayer',
        bullets: ['Sélection des photos par le client', 'Galeries avec mot de passe et date d’expiration', 'Galeries en nombre illimité'],
      },
      basic: {
        name: 'Essentiel',
        note: 'Votre marque — et rien d’autre',
        bullets: ['Sans notre marque', 'Votre logo dans les galeries', 'Vidéo dans les galeries'],
      },
      plus: {
        name: 'Plus',
        note: 'Pour une saison bien remplie',
        bullets: ['Tout Essentiel', 'Statistiques de consultation', 'Pourboires des clients'],
      },
      pro: {
        name: 'Maximum',
        note: 'Grosses archives et agenda chargé',
        bullets: ['Tout Plus', 'Support prioritaire', '1 To de stockage'],
      },
    },
    planCta: 'Choisir',
    siteTitle: 'Sites pour photographes',
    siteLede: 'Un site personnel avec votre propre domaine, SSL et SEO. Essai gratuit de 7 jours.',
    sitePlans: {
      site_trial: { name: 'Essai', note: '1 site pendant 7 jours' },
      site_basic: { name: 'Essentiel', note: '1 site · domaine personnalisé · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2 sites ou plus · multilingue · et tout le reste' },
    },
    bundleNote: 'Pack « Galerie + Site » — −15 % sur le site tant que les deux abonnements sont actifs.',
    soonBadge: 'Bientôt',
    siteComingSoon:
      'Le créateur de sites pour photographes est en plein développement — lancement très bientôt. Pour l’instant, tout se concentre sur les galeries : c’est là que commence le travail avec le client. Envie d’être prévenu en premier ? Laissez votre e-mail via « Commencer gratuitement ».',
  },
  referral: {
    label: 'Programme de parrainage',
    title: 'Parrainez vos confrères — recevez 10 % de chacun de leurs paiements',
    lede: 'Partagez votre lien avec un ou une photographe. Dès qu’il ou elle choisit une offre payante, vous recevez 10 % de chacun de ses paiements en crédit — tous les mois. Le crédit est déduit automatiquement de votre prochaine facture.',
    steps: [
      'Récupérez votre lien dans votre espace.',
      'Un confrère s’inscrit via ce lien et choisit une offre payante.',
      'Vous recevez 10 % en crédit chaque mois — automatiquement.',
    ],
    cta: 'Obtenir mon lien',
  },
  faq: {
    label: 'Questions fréquentes',
    title: 'L’essentiel, en bref',
    items: [
      {
        q: 'Mes clients voient-ils que la galerie est faite avec proiav ?',
        a: 'Avec l’offre Gratuite, une petite mention « Créé avec proiav » apparaît en bas de la galerie. Dès l’offre Essentiel, elle disparaît : vos pages n’affichent que votre nom, votre logo et vos photos.',
      },
      {
        q: 'Par qui passe l’argent des séances ?',
        a: 'Pas par nous. Les factures sont créées sur votre propre compte marchand Monobank ou WayForPay ; les moyens manuels, ce sont votre cagnotte ou votre carte. Nous affichons simplement le bouton au client et vérifions le statut du paiement auprès de la banque.',
      },
      {
        q: 'Que deviennent mes fichiers si je résilie ?',
        a: 'Tout continue de fonctionner pendant 14 jours. Si vous tenez dans les 3 Go gratuits, votre compte passe simplement en offre Gratuite. Sinon, les galeries se ferment aux clients et les fichiers sont conservés 60 jours de plus : vous voyez toujours tout dans votre espace, vous pouvez tout télécharger ou renouveler votre offre. Nous vous prévenons par e-mail 30, 7 et 1 jour avant la suppression.',
      },
      {
        q: 'Mes photos sont-elles compressées ?',
        a: 'Les originaux sont conservés à l’octet près. Pour un affichage rapide, le client voit des aperçus générés, mais le bouton de téléchargement fournit toujours l’original.',
      },
    ],
  },
  final: {
    label: 'Commencez par une galerie',
    titleBefore: 'Livrez votre prochaine séance ',
    titleAccent: 'avec élégance',
    cta: 'Créer un compte gratuit',
  },
  footer: {
    tagline: 'Galeries client en ligne pour les photographes d’Ukraine',
    blog: 'Blog',
    terms: 'Offre publique',
    privacy: 'Politique de confidentialité',
  },
}
