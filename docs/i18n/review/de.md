# Review — Deutsch (de)

Phrases I am not fully sure about. Format: `key or location — translation — why unsure`.

- generic gender (whole UI) — „der Fotograf“, „Kunden“, „Ihren Fotografen“ — generic masculine used throughout; many users are women. Decide whether to switch to neutral forms („Fotograf:in“) or keep as is.
- landing `hero.titleBefore/titleAccent/titleAfter` — „Alles, was **nach** dem Auslösen passiert“ — slogan; the accent word is only „nach“, check it reads well with the highlight.
- landing `final.titleAccent` — „Übergeben Sie Ihr nächstes Shooting **mit Stil**“ — chose „mit Stil“ over a literal „schön“; check tone.
- landing `bento.titleBefore/titleAccent` — „Die kleinen Dinge, die die Arbeit **entspannt machen**“ — accent spans two words; check layout.
- landing `principles.items[3].title` — „Bezahlt = von der Bank bestätigt“ — rephrased from „Payment = the bank’s word“.
- landing `principles.lede` — „Entscheidungen, an denen wir nicht rütteln“ — idiom, confirm it feels natural and not too casual.
- jar (Monobank „банка“) — „Monobank-Sammeldose“ — no established German term; German-speaking clients may not know the feature.
- `booking.cardLabel` / `publicBooking.payCard` — „Kartendaten (als Text)“ / „Per Überweisung zahlen“ — source means paying to card requisites (card-to-card transfer); „Überweisung“ may suggest IBAN transfer.
- `billing.planBasic` etc. — plan names „Kostenlos / Basis / Plus / Maximum“, site trial „Test“ — „Basis“ vs keeping „Basic“; „Test“ vs „Testphase“.
- `billing.autoRenewCancel` — „Kündigen“ — label is short; context is cancelling auto-renewal, not the whole account.
- `billing.storage` — „Speicher“ — rendered after a number („10 GB Speicher“); check concatenation.
- `designer.columnsShort` — „{n} Sp.“ — abbreviation for columns; may be unclear, „{n} Spalten“ if space allows.
- `designer.theme` — „Farbschema“ — designer “Theme” (light/dark/cream) translated as colour scheme, while site themes stay „Theme“.
- `designer.fontTheme` / `accentTheme` — „Wie im Theme“ — interpreted as “use the theme’s default”; verify.
- `designer.fontSans` — „Grotesk“ — typographic term; „Serifenlos“ may be clearer for non-designers.
- `studio.heroPhoto` / `heroPick` — „Aufmacherfoto“ / „Als Aufmacher verwenden“ — editorial term; „Titelfoto“ would clash with gallery „Titelbild“.
- `site.heroLegend` — „Startbereich“ — for the hero block; alternatives „Header“, „Hero“.
- `publicSite.filmStrip` — „Lichterkette“ — source “Strip of lights” is a theme-specific decorative label; context unclear.
- `publicSite.spread` / `editorLetter` — „Die Doppelseite“ / „Editorial“ — magazine theme (Zhurnal) labels.
- `publicSite.testimonials` — „Liebe Worte“ — warm but slightly unusual; „Kundenstimmen“ is the standard.
- `publicSite.madeOn` / `publicGallery.madeOn` — „Website mit proiav“ / „Erstellt mit proiav“ — the gallery string previously used „Proiav“ (capitalized); unified to lowercase „proiav“.
- `referrals.ambassadorBadge` — „Botschafter“ — maybe keep „Ambassador“ (common in German marketing).
- `stats.mrr` — „Umsatz/Monat (geschätzt)“ — internal admin label.
- culling `title` — „Bildsichtung“ — chose the German photographers’ term over „Culling“/„Aussortieren“; reject = „Ausschuss“.
- legal `oferta.title` — „Öffentliches Angebot (Nutzungsbedingungen)“ — „Oferta“ has no exact German equivalent.
- legal oferta §9 — „Steuergruppe: Zahler der Einheitssteuer, dritte Gruppe“ — Ukrainian simplified tax system; wording should be checked by a lawyer.
- legal oferta §5 — „Verantwortlicher (Inhaber) dieser Daten“ — Ukrainian „володілець“ vs GDPR „Verantwortlicher“; kept both.
- legal oferta §2 — „wie besehen“ — legal rendering of “as is”.
- client policies `defaultName` — „der Fotograf“ — inserted mid-sentence, e.g. „wie der Fotograf („Fotograf“) …“; sentences were rephrased so the name is always nominative, but read once with the default.
- client policies refund — „Nachbesserung“ — legal term for revision; may sound formal.

## Delta (release/4)

- `galleryManage.picksHint` — „Bibliothek → Bibliotheksfilter (Taste \) → Text → Dateiname → Enthält (… nicht „Enthält alle“)“ — Lightroom Classic menu names taken from the German UI as I remember it; please verify against a German Lightroom Classic install.
- `galleryManage.favoritesTitle` — „Auswahl der Kunden“ — now covers both hearts and retouch requests; „Favoriten“ alone would be too narrow.
- `galleryManage.clientEmailLabel/Consent` — „E-Mail-Adresse des Kunden“ / „Der Kunde ist … einverstanden“ — generic masculine again.
- `designer.picksFavorite` / `picksRetouch` — „Herz“ / „Retusche“ — values in a CSV export column; check they read well as cell values.
- `designer.focusGridHint` — the “Cover” button is referred to as „Titelbild“; verify the actual button label in the designer grid.
- help `upload.items[0]` — „Keine Verbindung“ — I could not find this label in any dictionary (it may be hardcoded or not yet added); make sure the real UI label matches.
- landing `products.features[0].no` — „02 — KI-Bildsichtung“ — “AI culling”; „KI“ is the standard German abbreviation.
- landing `principles.items[3].title` — „Ihre Fotos bleiben bei Ihnen“ — free rendering of “Photos are not shipped off for analysis”.
- landing `pricing.plans.pro.note` — „Große Archive und eine volle Saison“ — “a busy season” is now close to the Plus note („Für eine volle Saison“); consider „… und viel Betrieb in der Hochsaison“.
- landing `hero.status.eta` — „Voraussichtlich bis 14. Dezember“ — mock date in the hero card.

## Delta 3 (dashboard redesign)

- `galleryManage.tabClient` — „Kunde“ — tab label; singular to keep it short, „Kunden“ would match the rest of the UI.
- `galleryManage.tabDesign` — „Design“ — identical to English, but the standard German word.
- `galleryManage.hintGoDesign` — „Gestalten“ — button for “Style it”; check it fits next to „Teilen“.
- `dashboard.galleriesCount` — `{n, plural, one {# Galerie} other {# Galerien}}` — changed from the “Label: {n}” style to a plural; confirm the layout still works without a label.
- `galleryManage.accessDownloadsCount` — „Bisher # Download(s)“ — plural form, “Downloads so far”.
- `galleryManage.shareQrHint` — „… öffnen Sie die Galerie damit auf dem Smartphone“ — source is ambiguous (scan with a phone vs open from a phone).
- `publicGallery.shareInProgress/sharePassword` — the message the photographer sends uses „Sie“ and first person („schicke ich Ihnen“); some photographers write to clients with „du“. Should this be configurable?
- `dashboard.onboardStep3` — „Link teilen — per Telegram, Viber, WhatsApp oder E-Mail“ — the messenger list is Ukraine-oriented; kept as is.
