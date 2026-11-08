# Review — Spanish (es-ES): phrases to check with a native speaker

Format: `key or location — translation — why unsure`

- glossary / everywhere — «porfolio» (not «portafolio» / «portfolio») — RAE/Spain form; some Spanish photographers write «portfolio» in English. Earlier es.ts used «Portafolio» (Latin American).
- glossary / everywhere — «pack» for пакет / package — very common among Spanish photographers («pack de boda»), but «paquete» is the neutral alternative.
- glossary / everywhere — «señal» for deposit — standard in Spain; check it reads right next to «Reserva y señal».
- booking.slotsTitle, addSlot, reopen… — «Huecos», «Añadir hueco» — natural colloquial Spain term for a free slot; «franjas horarias» would be more formal.
- cullingLabels (all) / pages.cullingDemoTitle — «Criba de fotos», «Cribar fotos», «descarte» — no fixed Spanish term for "culling"; «criba» is used by some photographers, others just say «selección» or keep «culling».
- booking.monoLabel, landing principles/FAQ — «TPV virtual de Monobank» for "acquiring" — Spain's usual term for online card acquiring; check it is not confusing for a Ukrainian bank.
- booking.manualLabel, landing products.items[1].text — «hucha de Mono» for Monobank «банка» (Jar) — literal; the product is unknown in Spain.
- site.themeOpivnich — «Opivnich (Tysha de noche)» — theme names kept transliterated as in English; maybe they should be translated (Silencio, Medianoche, Aire, Película, Revista, Galería, Archivo, Producción).
- site.momentHint — «(tema «Тиша»)» — kept the Cyrillic theme name exactly as in the English source; nested «» quotes look odd, maybe should be «Tysha».
- publicSite.leadTitle / site.optLeadFormHint — «Deja tu mensaje» — chosen instead of literal «Deja una solicitud» (sounds bureaucratic). Must stay identical in both keys.
- publicSite.leadSent — «…el fotógrafo se pondrá en contacto contigo muy pronto.» — third person on the photographer's own site; first person («te responderé») may sound more natural.
- publicSite.process / site.processLegend — «Cómo trabajamos» — mix of «Sobre mí» (I) and «trabajamos» (we) on one site, as in the source.
- publicSite.testimonials — «Palabras bonitas» — free rendering of "Kind words"; «Opiniones» is safer.
- publicSite.filmStrip — «Hilera de luces» — theme-specific decorative label, context unclear.
- publicSite.dayInLight — «Un día en la luz» — poetic slogan, literal.
- publicSite.bookEvening — «Reservar una tarde» — "evening" in Spain is usually «tarde» until ~21:00; «noche» possible depending on the theme.
- publicSite.editorLetter — «Carta del editor» — magazine theme; could be «Editorial» or «Carta de la editora» (gender).
- publicSite.photographer / heroRole — «Fotógrafo» as generic default — gender; many users may be women («Fotógrafa»).
- landing.hero.titleAfter — «Todo lo que pasa después del disparo» — slogan; alternatives «…después de la sesión».
- landing.bento.titleBefore/titleAccent — «Los pequeños detalles que hacen tu trabajo más tranquilo» — accent word split; check it reads well.
- landing.final.titleAccent / products.items[0].title — «con estilo» for "beautifully" — sounds natural, but loses the "beautiful" word used elsewhere («enlace precioso»).
- landing.hero.statNumber — «30.000» — Spain uses a dot for thousands in common use; RAE prefers a thin space («30 000»).
- referrals / billing.creditNotice — «saldo» for referral credit — clearer than «crédito» (which in Spain suggests a loan).
- dashboard.partnerUntil, billing.partnerHint — «Partner», «periodo de partner» — left as an English loanword; «socio» sounds odd here.
- billing.planPro — «Máximo» — literal plan name; check it works as a product name.
- importer.progress — «{done} de {total} pasados» — "transferred"; «transferidos» is an alternative.
- legal oferta 9 — «número de identificación fiscal RNOKPP», «contribuyente del impuesto único, tercer grupo» — Ukrainian tax concepts with no Spanish equivalent; check wording.
- legal oferta intro — «propuesta pública oficial (oferta)», «el Prestador» for Виконавець — legal register; «el Proveedor» is an alternative.
- legal privacy 2 — «responsable / encargado del tratamiento» for володілець / розпорядник — GDPR terms used for Ukrainian law concepts; close but not identical legally.
- client-policies refund — «lo hablaremos y haremos los ajustes necesarios» for "we will arrange a revision" — softened; check it doesn't over-promise.
- designer.fontSans — «Grotesca» — typographic term; «Sans serif» may be clearer to users.
- designer.radiusSharp — «Rectas» for sharp corners — «En ángulo» / «Sin redondear» alternatives.

## Delta pass (release/4)

- galleryManage.picksHint — «Biblioteca (Library) → … → Texto (Text) → Nombre de archivo (Filename) → Contiene (Contains; no «Contiene todo» / Contains All)» — I'm not 100 % sure of the exact Spanish Lightroom Classic labels (especially «Contiene todo» vs «Contiene todos»), so the English names are kept in brackets.
- galleryManage.favoritesTitle — «Selección del cliente» — now covers hearts + retouch requests; «Favoritos y retoques del cliente» would be more explicit but longer.
- galleryManage.clientEmailTitle / clientEmailSentAt — «Correo «Tus fotos están listas»» — nested «» quotes; check how it looks in the UI.
- galleryManage.clientEmailWaitReady — «…pase a «Lista»» — status label is feminine («la galería está lista»); check it reads well next to «el estado».
- landing hero.status.steps — «Sesión / Edición / Lista» — must match the client status screen; «Lista» without a noun may feel abrupt.
- landing products.features[0].no — «02 — Criba con IA» — "AI culling"; «Selección con IA» is an alternative.
- landing products.features[2].alt — «El cargador de la galería» for "uploader" — «la herramienta de subida» may be more natural.
- landing pricing.plans.pro.note — «Archivos grandes y temporada a tope» — colloquial «a tope» for "busy season"; check register.
- landing bento.slideshow — label «Visualización», text «Visor a pantalla completa…» — "lightbox" rendered as «visor».
- designer.picksFavorite / picksRetouch — «corazón» / «retoque» — lowercase values in a table/export, context unclear.

## Delta pass 2 (help blocks)

- gallery/help-locales/es.ts upload[0] — «Sin conexión» — I couldn't find the uploader's "No connection" label in any dictionary, so I translated it freely; it must match the real label in the uploader.
- gallery/help-locales/es.ts delivery[2] — «franja» for the status banner on top — «banda» / «aviso» are alternatives.
- gallery/help-locales/es.ts delivery[1] — «el adelanto de fondo» for teaser — consistent with galleryManage.deliveryTeaserHint («foto de adelanto»).

## Delta pass 3 (dashboard redesign)

- galleryManage.hintGoDesign / hintUploaded — «Darle estilo» — button label for going to the Design tab; «Diseñar» or «Ir a Diseño» are shorter alternatives.
- dashboard.sortUpdated — «Modificadas recientemente» — feminine (galerías); check in the sort dropdown.
- galleryManage.uploadProgress — «{done} de {total} subidos» — masculine (archivos); no noun shown, so gender is a guess.
- galleryManage.sharePublished — «Publicada ✓ El enlace ya funciona.» — feminine agreement with «galería» assumed.
- galleryManage.shareEmail — «Correo» — short button label next to Telegram/Viber/WhatsApp; «Email» is also common in Spain.
- publicGallery.shareInProgress — «Ahora mismo estoy editando las fotos» — written by the other session in the photographer's first person; I kept it because it reads naturally as a personal message.
