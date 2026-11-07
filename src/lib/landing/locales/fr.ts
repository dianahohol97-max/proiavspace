import type { LandingCopy } from '../copy'

/** French (France) — marketing landing. */
export const fr: LandingCopy = {
  nav: {
    features: 'Fonctionnalités',
    galleries: 'Galeries',
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
    status: { steps: ['Séance', 'Retouche', 'Prête'], now: 'en cours', eta: 'Prévue pour le 14 décembre' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Histoires de mariage',
  },
  strip: { label: 'Le travail des photographes' },
  products: {
    label: 'Galeries · tri des photos · avancement de la séance',
    titleBefore: 'La galerie client pour photographes — ',
    titleAccent: 'à votre image',
    lede:
      'Tout commence par la galerie — c’est là que le photographe retrouve ses clients chaque semaine. Nouveau dans les galeries : le tri des photos à écarter, le suivi de la séance pour le client et un import qui résiste aux coupures de connexion. Voici les vrais écrans.',
    gallery: {
      no: '01 — Galeries',
      title: 'Livrez vos séances avec élégance',
      text: 'Vous importez les photos — le client reçoit un beau lien et télécharge lui-même, sans Google Drive ni « comment je télécharge ? ». Favoris, mot de passe, date d’expiration, archive ZIP, statistiques.',
      tagStrong: 'Originaux sans compression.',
      tagRest: ' Les fichiers tels que vous les avez pris',
    },
    features: [
      {
        no: '02 — Tri par IA',
        title: 'Les photos ratées sont signalées, vous décidez',
        text: 'Images floues, répétitions dans une rafale et yeux fermés sont signalés automatiquement, et la meilleure photo de chaque rafale est mise en avant à côté des autres. L’analyse se fait dans votre navigateur — les photos ne sont envoyées nulle part.',
        tagStrong: 'Rien n’est masqué tout seul.',
        tagRest: ' Une photo ne disparaît pour le client qu’après votre confirmation',
        alt: 'Le panneau « Tri des photos » : signalements « Répétition » et « Floue » sur les photos et filtre « À écarter ? »',
      },
      {
        no: '03 — Avancement de la séance',
        title: 'Le client voit où en sont ses photos',
        text: 'Tant que la galerie est vide, le même lien montre au client « Séance → Retouche → Prête », avec une date prévue si vous l’avez indiquée. Dès que les photos sont là, la galerie s’ouvre au même endroit.',
        tagStrong: 'Un seul réglage dans votre espace.',
        tagRest: ' Le client voit les changements aussitôt',
        alt: 'L’écran d’avancement côté client : « Vos photos sont déjà en préparation », l’étape « Retouche » et une date prévue',
      },
      {
        no: '04 — Import fiable',
        title: 'Une coupure réseau ne vous oblige pas à tout recommencer',
        text: 'Les gros fichiers sont envoyés par morceaux de 8 Mo. Le réseau tombe — l’envoi attend puis reprend tout seul. L’onglet a été fermé — choisissez les mêmes fichiers et l’import reprend là où il s’était arrêté.',
        tagStrong: 'Seul le morceau inachevé est renvoyé,',
        tagRest: ' pas le fichier entier',
        alt: 'L’import de la galerie hors connexion : photos déjà envoyées, vidéos en attente du réseau',
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
      watermark: { label: 'Filigrane', text: 'Votre nom sur les aperçus. Les originaux restent intacts' },
      stats: { label: 'Statistiques', number: '247', text: 'vues de la galerie cette semaine' },
      themes: {
        label: 'Design de la galerie',
        text: 'Trois ambiances, cinq mises en page',
        chips: ['Mosaïque', 'Collage', 'Éditorial', 'Carrés', 'Portrait 3:4'],
      },
      previewPhoto: 'Des aperçus qui chargent vite',
      slideshow: { label: 'Visionnage', text: 'Visionneuse plein écran et diaporama — sur mobile aussi' },
      video: {
        label: 'Vidéo',
        text: 'Des clips à côté des photos, dans la même galerie — dès l’offre Essentiel',
      },
      languages: { label: 'Langues', text: 'Vos clients affichent la galerie dans leur langue — au choix parmi neuf' },
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
        title: 'Le photographe décide',
        text: 'L’automatisation ne fait que suggérer. Aucune photo n’est masquée au client tant que vous ne l’avez pas confirmé.',
      },
      {
        title: 'Les originaux sont intouchables',
        text: 'Les fichiers sont conservés à l’octet près. Le client parcourt des aperçus rapides et télécharge la pleine qualité.',
      },
      {
        title: 'Vos photos ne partent pas en analyse',
        text: 'Le tri se fait dans votre navigateur. Les photos ne sont transmises à aucun service tiers — même le modèle de visages est chargé depuis notre propre serveur.',
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
        note: 'Grosses archives et saison chargée',
        bullets: ['Tout Plus', 'Support prioritaire', '1 To de stockage'],
      },
    },
    planCta: 'Choisir',
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
        q: 'Le tri par IA peut-il masquer ou supprimer des photos tout seul ?',
        a: 'Non. Il se contente de signaler les photos probablement à écarter : images floues, répétitions dans une rafale, yeux fermés. Seul ce que vous confirmez et masquez avec le bouton est caché au client — les fichiers ne sont pas supprimés, et chaque photo peut être réaffichée.',
      },
      {
        q: 'Que voit le client pendant la retouche des photos ?',
        a: 'Si vous avez défini l’avancement de la séance, le lien de la galerie montre au client « Séance → Retouche → Prête », avec une date prévue si vous l’avez indiquée. Dès que vous ajoutez les photos, la galerie s’ouvre au même endroit.',
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
