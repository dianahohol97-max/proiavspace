# Points à relire — français (fr)

Format : `clé ou emplacement — traduction — pourquoi je doute`

- billing.planFree / planBasic / pricing.plans.* — « Gratuite » / « Essentiel » / « Plus » / « Maximum » — noms d’offres : « Basic » rendu par « Essentiel » (plus vendeur que « Basique ») ; « Gratuite » s’accorde avec « offre ». À valider comme noms commerciaux, et vérifier qu’ils sont repris partout (légal, landing, tableau de bord).
- glossaire « тариф » — « offre » — on aurait pu dire « forfait » ou « abonnement » ; « offre » est courant en SaaS mais crée une petite ambiguïté avec « offre publique » (documents juridiques).
- legal oferta.title — « Offre publique (conditions générales) » — l’« offre publique » est une notion du droit ukrainien ; en France on dirait « Conditions générales de vente/d’utilisation ». J’ai gardé les deux.
- legal oferta, définition « Тариф » — « Offre tarifaire » — terme défini avec majuscule ; à vérifier par un juriste.
- legal oferta §9 — « Régime fiscal : contribuable à l’impôt unique, troisième groupe » — traduction littérale du statut ФОП ukrainien ; pas d’équivalent français.
- legal oferta §9 — « numéro d’identification fiscale RNOKPP » — transcription de РНОКПП, à confirmer.
- legal oferta §7 — « loi de l’Ukraine « Sur la protection des données personnelles » » — intitulé officiel français de cette loi à confirmer.
- legal privacy §2 — « responsable du traitement » / « sous-traitant » pour володілець / розпорядник — terminologie RGPD, la plus proche ; à valider.
- legal reviewNote — « Cette traduction est fournie à titre informatif. Seule la version ukrainienne fait foi… » — formule juridique standard, à relire.
- landing hero.titleAfter — « Tout ce qui se passe après le déclic » — « déclic » pour « shutter click » : joli mais à valider.
- landing products.titleAccent — « à votre image » — plutôt que « sous votre marque » ; nuance à valider.
- landing bento.titleAccent — « Les petits détails qui rendent le travail serein » — l’accent porte sur un adjectif en fin de phrase.
- landing principles.items[3].title — « Payé = la banque l’a confirmé » — rendu libre de « Payment = the bank’s word ».
- pages.studioTitleBefore/Accent — « Une galerie que vos clients ont envie / de partager » — découpage en deux morceaux pour l’accent visuel.
- referrals.title / referral.lede — « confrère ou consœur », « il ou elle » — écriture inclusive légère ; peut paraître lourde, on pourrait tout mettre au masculin générique.
- booking.monoLabel — « Encaissement Monobank (automatique) » — « acquiring » n’a pas d’équivalent grand public ; « encaissement » / « compte marchand ».
- booking.manualLabel — « cagnotte Monobank » pour « банка » — la « banka » Monobank est une cagnotte, mais le terme peut dérouter.
- booking.payHint / autoConfirmHint — « token » laissé en anglais — « jeton » est plus français mais moins reconnu par les photographes.
- publicBooking.payCard — « Payer par virement (coordonnées bancaires) » — la source dit « payer avec les coordonnées » (souvent un virement de carte à carte) ; à vérifier.
- culling.filterFlagged — « À écarter ? » — libellé de filtre court avec point d’interrogation ; « Rejets possibles » est l’alternative.
- culling.badgeConfirmed / keep — « Rejet confirmé » / « Garder le signalement » — terminologie du tri (brak → photo à écarter / rejet) à valider avec des photographes.
- culling.title — « Tri des photos » — « culling » ; certains disent « sélection » mais c’est déjà pris par la sélection client.
- site.momentLegend — « Photo signature » — pour « Signature frame ».
- publicSite.filmStrip — « Guirlande de lumières » — sens exact du bloc (thème nocturne) incertain sans le voir.
- publicSite.testimonials — « Ils en parlent » — titre de section chaleureux ; « Témoignages » plus neutre.
- publicSite.popular / site.priceFeatured — « La plus choisie » — badge de formule ; « La plus demandée » possible.
- designer.fontSans — « Grotesque » — gardé comme en anglais ; « Linéale » ou « Sans serif » possibles.
- designer.radiusSharp/Soft/Round — « Nets / Adoucis / Arrondis » — accord avec « Coins » ; vérifier la place dans l’interface.
- settings.watermarkLabel — « Apposer mon nom sur les aperçus (filigrane) » — longueur du libellé.
- dashboard.onboardTitle / publicGallery.madeOn — « proiav » en minuscules (la source anglaise écrit parfois « Proiav ») — uniformisé.

## Delta (release/4)

- galleryManage.picksHint — « Bibliothèque → barre de filtre (touche \) → Texte → Nom de fichier → Contient (bien « Contient », pas « Contient tout ») » — j’ai utilisé les noms de l’interface française de Lightroom Classic de mémoire ; à vérifier dans un Lightroom en français (notamment « Contient tout » et « barre de filtre »).
- galleryManage.favoritesTitle — « Sélection des clients » — « Client picks » regroupe cœurs et demandes de retouche ; « Favoris » ne suffisait plus. Risque de confusion avec « sélection des photos par le client » (fonction du tarif).
- galleryManage.clientEmailTitle — « E-mail « Vos photos sont prêtes » » — vérifier que l’objet réel de l’e-mail envoyé est bien traduit pareil.
- designer.picksMark / picksFavorite / picksRetouch — « Marque » / « cœur » / « retouche » — en-têtes et valeurs CSV ; « Marque » peut se lire comme « brand », « Type » serait une alternative.
- designer.focusGridHint — bouton cité « Couverture » — vérifier le libellé réel du bouton dans la grille (designer.cover = « Couverture », studio.setCover = « Choisir en couverture »).
- help upload.items[0] — « Pas de connexion » — ce libellé n’existe dans aucun dictionnaire (probablement en dur dans le composant d’import) ; à aligner quand il sera traduit.
- landing products.features[0].title — « Les photos ratées sont signalées, vous décidez » — « ratées » pour « rejects », un peu familier ; ailleurs « à écarter ».
- landing products.features[2].title — « Une coupure réseau ne vous oblige pas à tout recommencer » — plus long que l’anglais ; à vérifier dans la mise en page.
- landing hero.status.eta — « Prévue pour le 14 décembre » — maquette, accord féminin (la galerie).
- landing bento.cards.languages — « au choix parmi neuf » — tournure à valider.

## Delta 3 (tableau de bord)

- galleryManage.accessDownloadsCount — « {n, plural, one {# téléchargement jusqu’ici} other {# téléchargements jusqu’ici}} » — passé du style « Libellé : {n} » à une phrase avec pluriel ; « jusqu’ici » à valider (« au total » possible).
- dashboard.sortNewest / sortUpdated — « Les plus récentes » / « Modifiées récemment » — accord au féminin (galeries) ; vérifier que le libellé est bien affiché dans un menu de tri de galeries.
- galleryManage.hintGoDesign — « Personnaliser » — pour « Style it » ; l’onglet s’appelle « Design ».
- galleryManage.tabDesign — « Design » — identique à l’anglais, mot courant en français ; « Apparence » serait une alternative.
- galleryManage.shareQr — « Code QR » — « QR code » est aussi très courant en France ; changé pour ne pas rester identique à l’anglais.
- publicGallery.shareReady / shareInProgress / sharePassword — message envoyé par le photographe au client, en vouvoiement et à la première personne (« je vous l’envoie ») ; vérifier que le ton convient à des photographes qui tutoient parfois leurs clients.
- dashboard.onboardLede — « C’est l’affaire de quelques minutes » — tournure idiomatique pour « It takes a few minutes ».
