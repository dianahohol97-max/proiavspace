import type { GalleryHelp } from '../help'

/** French (France) — « How it works » blocks in the dashboard. */
export const fr: GalleryHelp = {
  culling: {
    title: 'Comment fonctionne le tri des photos',
    items: [
      'Cliquez sur « Trier les photos » : le navigateur parcourt les aperçus de la galerie et signale les images floues, les répétitions dans une rafale et, si l’option est activée, les yeux fermés.',
      'Tout se calcule sur cet ordinateur — les photos ne sont envoyées nulle part. Pour détecter les yeux fermés, le navigateur télécharge une seule fois un modèle de visages (environ 4 Mo) depuis notre propre serveur.',
      'Les signalements ne sont que des suggestions. « Garder le signalement » confirme le rejet, « Retirer le signalement » indique que la photo est bonne. Dans chaque rafale, une photo est marquée comme la meilleure — vous pouvez en choisir une autre.',
      'Le client ne remarque rien tant que vous n’avez pas cliqué sur « Masquer au client ». Les photos masquées ne sont pas supprimées : elles se trouvent dans le filtre « Masquées au client », et chacune peut être réaffichée.',
      'Tant que l’onglet est masqué, l’analyse est en pause. Vous pouvez l’annuler — ce qui a déjà été vérifié est conservé, et les nouvelles photos pourront être analysées plus tard.',
    ],
  },
  delivery: {
    title: 'Comment le client voit l’avancement',
    items: [
      'Choisissez une étape — elle est enregistrée immédiatement. Le client la voit via le lien habituel de la galerie ; aucun lien séparé n’est nécessaire.',
      'Tant que la galerie contient moins de deux photos visibles par le client, il voit l’écran « Séance → Retouche → Prête ». Une photo unique sert alors d’avant-première en arrière-plan.',
      'À partir de deux photos, la galerie s’ouvre et l’étape s’affiche dans un bandeau en haut. « Prête » et « Aucun statut » affichent la galerie normale, sans bandeau.',
      'La date est facultative : le client voit « prévue pour le … ». Vous pouvez la modifier ou la supprimer à tout moment.',
    ],
  },
  upload: {
    title: 'Que faire si l’import est interrompu',
    items: [
      'Plus d’internet — ne faites rien et gardez l’onglet ouvert. Le message « Pas de connexion » s’affiche, et l’import reprend tout seul dès que le réseau revient (s’il revient dans les 15 minutes).',
      'Les gros fichiers (plus de 16 Mo) sont envoyés par morceaux de 8 Mo : une coupure ne fait renvoyer qu’un morceau, pas le fichier entier.',
      'L’onglet ou le navigateur a été fermé — rouvrez cette galerie. Au-dessus de la zone de dépôt, vous verrez la liste des fichiers inachevés : choisissez exactement ceux-là ; les gros reprendront là où ils s’étaient arrêtés, les plus petits seront renvoyés en entier.',
      'Un fichier affiche ✕ — choisissez ce fichier à nouveau. N’ajoutez pas une seconde fois les fichiers déjà présents dans la galerie ci-dessous : ils seraient importés en double.',
    ],
  },
}
