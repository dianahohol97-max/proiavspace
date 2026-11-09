# Da rivedere — italiano (it)

Frasi su cui non sono del tutto sicuro. Formato: `chiave o posizione — traduzione — perché ho dubbi`.

- landing `hero.titleBefore/titleAccent/titleAfter` — «Tutto quello che succede **dopo** lo scatto» — slogan; «dopo lo scatto» è naturale, ma va verificato che regga come H1 e che il ritmo funzioni con l’accento su «dopo».
- landing `bento.titleBefore/titleAccent` — «I piccoli dettagli che rendono il lavoro **sereno**» — «sereno» per «calm»: alternative «tranquillo», «senza stress».
- landing `products.items[0].title` / `final.titleAccent` — «Consegna i servizi con stile» / «con stile» — «beautifully» reso con «con stile»; valutare «in bellezza».
- termine generale — «servizio» per «зйомка/shoot» — è l’uso comune tra fotografi italiani, ma in contesti come «Prenota un servizio» potrebbe confondersi con «il servizio» (la piattaforma). Nei testi legali la piattaforma è «Servizio» con maiuscola.
- culling (tutto il pannello) — «Scrematura degli scatti» per «culling» — molti fotografi italiani dicono semplicemente «culling» o «selezione»; da confermare la scelta.
- culling `keep` — «Conferma lo scarto» (sorgente: «Keep flag» / «Залишити позначку») — ho reso il significato (confermare che è uno scarto) invece della lettera; il testo `hideNothing` lo cita tra «».
- dictionary `booking.manualLabel` — «salvadanaio Monobank» per «банка / jar» — traduzione del nome della funzione Monobank; potrebbe non essere riconoscibile per un pubblico italiano.
- dictionary `booking.payHint` / landing — «acquiring» lasciato in inglese — in Italia si usa anche «servizio di acquiring» o «POS virtuale»; da verificare il termine più chiaro per i fotografi.
- dictionary `site.heroLegend` — «Apertura» per il blocco hero — in ambito web si dice spesso «hero» o «sezione principale».
- dictionary `site.momentLegend` — «Scatto simbolo» per «Signature frame» — alternativa «Scatto firma» / «Lo scatto del cuore».
- dictionary `site.momentText` — «Anche il silenzio tra uno scatto e l’altro racconta una storia» — frase poetica, da far valutare.
- dictionary `publicSite.filmStrip` — «Una scia di luci» — contesto (tema «Opivnich») poco chiaro; il sorgente è «Strip of lights».
- dictionary `publicSite.spread` — «Il servizio» (tema «Zhurnal», rivista) — «The spread» in senso editoriale; in italiano «servizio» è il termine giornalistico, ma si sovrappone a «servizio fotografico».
- dictionary `publicSite.testimonials` / `site.testimonialsLegend` — «Dicono di me» / «Recensioni» — prima persona singolare: va bene per fotografi singoli, meno per studi.
- dictionary `publicSite.about` / `process` — «Chi sono» / «Come lavoro» — come sopra, singolare; per gli studi sarebbe «Chi siamo» / «Come lavoriamo».
- dictionary `billing.planPro` — «Massimo» — nome del piano; potrebbe suonare strano, alternativa «Max».
- dictionary `billing.featureNoBranding` — «Senza il nostro marchio» — «branding» reso con «marchio»; verificare lunghezza nelle card.
- dictionary `stats.mrr` — «Ricavi/mese (stima)» — etichetta interna, verifica lunghezza.
- dictionary `publicGallery.tip` / `contactPhotographer` — «Ringrazia il fotografo» / «Contatta il fotografo» — maschile generico; per una fotografa servirebbe «la fotografa» (non abbiamo il genere a disposizione).
- dictionary `dashboard.onboardTitle` — «Ti diamo il benvenuto su proiav 👋» — scelto per evitare «Benvenuto/Benvenuta»; un po’ più formale.
- dictionary `site.heroRole` — «Chi sei, es. «Fotografa» (se vuoto → «Fotografo»)» — il valore di default reale mostrato sul sito potrebbe non essere «Fotografo»: da verificare con il codice.
- dictionary `site.heroCity` — «Kyiv · disponibile in tutta l’Ucraina» — in italiano si usa ancora spesso «Kiev»; ho tenuto «Kyiv». Per Lviv invece ho usato l’esonimo «Leopoli» (`pages.demoCity`).
- dictionary `designer.fontSans` — «Grottesco» — termine tipografico corretto, ma molti utenti conoscono solo «Sans serif».
- dictionary `designer.columnsShort` — «{n} col.» — abbreviazione, verificare spazio.
- legal `oferta.title` — «Offerta al pubblico» — termine del codice civile italiano (art. 1336); il concetto ucraino di «публічна оферта» non coincide perfettamente.
- legal `oferta.sections[8]` — «contribuente in regime d’imposta unica, terzo gruppo» — traduzione descrittiva di «платник єдиного податку третьої групи», regime fiscale ucraino senza equivalente italiano.
- legal `oferta.sections[8]` — «codice fiscale RNOKPP» — ho aggiunto la sigla ucraina per chiarezza; verificare se va bene.
- legal `privacy.sections[1]` — «responsabile del trattamento (processor)» — «розпорядник» reso con la terminologia GDPR italiana; la legge ucraina usa termini propri.
- legal (tutto) — dare del «tu» nei testi legali è insolito in Italia (di solito «Lei» o impersonale); scelto per coerenza come da brief.
- client policies `refund` — «acconto» per «передоплата» — scelto apposta al posto di «caparra», che in Italia ha conseguenze giuridiche specifiche (art. 1385 c.c.).

## Delta (release/4)

- dictionary `galleryManage.picksHint` — «Libreria → barra dei filtri (tasto \) → Testo → Nome file → Contiene (… non Contiene tutto)» — ho usato i nomi dell’interfaccia italiana di Lightroom Classic a memoria; «Contiene tutto» potrebbe essere «Contiene tutti» nella versione italiana. Da verificare su un Lightroom in italiano.
- dictionary `galleryManage.favoritesTitle` — «Scelte dei clienti» — per «Client picks» (preferiti + ritocco); alternativa «Selezioni dei clienti».
- dictionary `designer.picksMark` — «Segno» — intestazione di colonna CSV (cuore/ritocco); forse meglio «Tipo» o «Contrassegno».
- dictionary `galleryManage.clientEmailHint` / `clientEmailWaitReady` — lo stato è citato come «Pronta» (femminile, riferito alla galleria), mentre l’e-mail dice «Le tue foto sono pronte»; verificare che il genere non stoni.
- landing `products.features[2].title` — «Se cade la connessione, non si riparte da zero» — slogan, controllare lunghezza.
- landing `principles.items[3].title` — «Le foto non vengono spedite altrove per l’analisi» — un po’ lungo per un titolo.
- landing `bento.cards.languages.text` — «Il cliente passa la galleria nella sua lingua: sono nove» — formulazione da rivedere.
- help `upload.items[0]` — «Nessuna connessione» — l’etichetta dell’uploader non è (ancora) localizzata nei dizionari, quindi la traduzione citata è un’ipotesi.

## Delta 3 (dashboard)

- dictionary `dashboard.onboardStep2` — «Carica le foto: trascinale semplicemente nella finestra» — «finestra» per «window»; forse meglio «nel riquadro».
- dictionary `galleryManage.hintGoDesign` — «Personalizza» — per «Style it»; alternativa «Scegli lo stile».
- dictionary `galleryManage.tabDesign` — «Design» lasciato uguale all’inglese (comune in italiano); alternativa «Aspetto».
- dictionary `galleryManage.shareVia` — «Invia con» — seguito dai nomi delle app; verificare con il layout (alternativa «Invia tramite»).
- dictionary `galleryManage.shareQrHint` — «Stampalo su un biglietto…» — «biglietto» per «card» (biglietto da visita / cartoncino).
- dictionary `publicGallery.shareInProgress` — «Sto ancora lavorando alle foto» — prima persona singolare del fotografo; per gli studi servirebbe il plurale.

## Листи

- emails `hello` — «Ciao Olena,» / «Ciao,» — saluto da e-mail con il «tu»; alternativa più formale «Buongiorno Olena,».
- emails `helloClient` — «Buongiorno!» — scelto per il cliente del fotografo (meno confidenziale di «Ciao!»), ma il resto della mail dà del «tu».
- emails `footerQuestions` — «Domande e fatture» — il sorgente ucraino parla di «рахунок для ФОП» (fattura per l’impresa individuale); verificare.
- emails `includes.galleries` — «download in ZIP» — verificare la lunghezza nella ricevuta.
- emails `closed` — «Le tue gallerie (3 gallerie)» — costruzione per evitare l’accordo del numero; un po’ ripetitiva.
- emails date con articolo — «il 01.12.2026», «dal 01.12.2026» — in italiano con una data numerica è corretto ma suona burocratico; dipende dal formato delle date passate dal codice.
- emails `referralReward` — «credito referral» / «ricompensa referral» — anglicismo «referral», coerente con la UI.
- emails `bookingNotify` — «prenotato un servizio per 20.07.2026 · 14:00» — manca l’articolo davanti allo slot formattato; alternativa «per il giorno …».
