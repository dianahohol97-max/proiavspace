import type { LandingCopy } from '../copy'

/** Italian landing copy — translation of the `en` object in ../copy.ts. */
export const it: LandingCopy = {
  nav: {
    features: 'Funzionalità',
    galleries: 'Gallerie',
    pricing: 'Prezzi',
    themes: 'Temi',
    blog: 'Blog',
    signIn: 'Accedi',
    ctaShort: 'Inizia gratis',
    dashboard: 'Dashboard',
  },
  hero: {
    chips: ['Matrimoni', 'Famiglie', 'Ritratti', 'Studi'],
    titleBefore: 'Tutto quello che succede ',
    titleAccent: 'dopo',
    titleAfter: ' lo scatto',
    subtitle: 'Una galleria online per i clienti dei fotografi: consegna il servizio con un unico, bellissimo link.',
    lede:
      'Gallerie in cui il cliente capisce subito come scaricare le foto: niente Google Drive, niente «ma come si scarica?». Preferiti, password e scadenza, originali senza compressione. Ovunque solo il tuo brand.',
    cta: 'Inizia gratis',
    ctaNote: '3 GB gratis, ogni galleria resta aperta 30 giorni. Nessuna carta richiesta.',
    statNumber: '30.000',
    statText: 'foto consegnate ai clienti con le gallerie proiav',
    status: { steps: ['Servizio', 'Post-produzione', 'Pronta'], now: 'ora', eta: 'Prevista entro il 14 dicembre' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Storie di matrimonio',
  },
  strip: { label: 'Lavori dei fotografi' },
  products: {
    label: 'Gallerie · scrematura · stato del servizio',
    titleBefore: 'Una galleria per i clienti dei fotografi, ',
    titleAccent: 'con il tuo brand',
    lede:
      'Tutto parte dalla galleria: è lì che un fotografo incontra i clienti ogni settimana. Novità nelle gallerie: scrematura degli scarti, stato del servizio per il cliente e caricamenti che resistono alla caduta della connessione. Qui sotto, le schermate reali.',
    gallery: {
      no: '01 — Gallerie',
      title: 'Consegna i servizi con stile',
      text: 'Carichi le foto, il cliente riceve un bel link e scarica tutto in autonomia: niente Google Drive, niente «ma come si scarica?». Preferiti, password, scadenza, ZIP, statistiche.',
      tagStrong: 'Originali senza compressione.',
      tagRest: ' I file restano come li hai scattati',
    },
    features: [
      {
        no: '02 — Scrematura con l’AI',
        title: 'Gli scarti vengono segnalati, decidi tu',
        text: 'Scatti sfocati, ripetizioni nelle raffiche e occhi chiusi vengono segnalati in automatico, e lo scatto migliore della raffica compare accanto agli altri. L’analisi avviene nel tuo browser: le foto non vengono inviate da nessuna parte.',
        tagStrong: 'Niente si nasconde da solo.',
        tagRest: ' Una foto sparisce per il cliente solo quando lo confermi tu',
        alt: 'Il pannello «Scrematura degli scatti»: segnalazioni «Ripetizione» e «Sfocata» sulle foto e il filtro «Possibili scarti»',
      },
      {
        no: '03 — Stato del servizio',
        title: 'Il cliente vede a che punto sono le sue foto',
        text: 'Finché la galleria è vuota, allo stesso link il cliente vede «Servizio → Post-produzione → Pronta» e la data prevista, se l’hai indicata. Appena le foto sono pronte, la galleria si apre proprio lì.',
        tagStrong: 'Un solo interruttore nella dashboard.',
        tagRest: ' Il cliente vede subito ogni cambiamento',
        alt: 'La schermata di stato per il cliente: «Le tue foto sono già in lavorazione», la fase «Post-produzione» e la data prevista',
      },
      {
        no: '04 — Caricamento affidabile',
        title: 'Se cade la connessione, non si riparte da zero',
        text: 'I file grandi vengono caricati in blocchi da 8 MB. Se la rete cade, il caricamento aspetta e riprende da solo. Se hai chiuso la scheda, scegli di nuovo gli stessi file e il caricamento riprende da dove si era fermato.',
        tagStrong: 'Si ripete solo il blocco incompleto,',
        tagRest: ' non l’intero file',
        alt: 'Il caricamento della galleria offline: foto già caricate, video in attesa della connessione',
      },
    ],
  },
  bento: {
    label: 'Tutto in una sola dashboard',
    titleBefore: 'I piccoli dettagli che rendono il lavoro ',
    titleAccent: 'sereno',
    cards: {
      selection: {
        label: 'Selezione',
        text: 'Il cliente segna con un cuore gli scatti da ritoccare: esporti l’elenco dei file con un clic',
      },
      galleryPhoto: 'Galleria',
      protection: { label: 'Protezione', text: 'Password e scadenza per ogni galleria' },
      archive: { label: 'Archivio', text: 'Tutto con un clic: lo ZIP si crea senza code né attese' },
      watermark: { label: 'Filigrana', text: 'Il tuo nome sulle anteprime. Gli originali restano puliti' },
      stats: { label: 'Statistiche', number: '247', text: 'visualizzazioni della galleria questa settimana' },
      themes: {
        label: 'Design della galleria',
        text: 'Tre atmosfere, cinque layout',
        chips: ['Masonry', 'Collage', 'Editoriale', 'Quadrati', 'Ritratto 3:4'],
      },
      previewPhoto: 'Anteprime senza perdere velocità',
      slideshow: { label: 'Visualizzazione', text: 'Lightbox a schermo intero e presentazione, anche da telefono' },
      video: {
        label: 'Video',
        text: 'Clip accanto alle foto nella stessa galleria, dal piano «Base»',
      },
      languages: { label: 'Lingue', text: 'Il cliente passa la galleria nella sua lingua: sono nove' },
    },
  },
  principles: {
    huge: 'Principi',
    title: 'Come è costruita la piattaforma, dall’interno',
    lede: 'Non è un elenco di funzionalità: sono scelte su cui non torniamo indietro.',
    items: [
      {
        title: 'Il tuo brand in primo piano',
        text: 'Dal primo piano a pagamento, nelle gallerie non c’è nessuna traccia di noi. Il cliente vede solo il fotografo.',
      },
      {
        title: 'Decide il fotografo',
        text: 'L’automazione si limita a suggerire. Nessuna foto viene nascosta al cliente finché non lo confermi tu.',
      },
      {
        title: 'Originali intoccabili',
        text: 'I file vengono conservati byte per byte. Il cliente sfoglia anteprime veloci e scarica la qualità piena.',
      },
      {
        title: 'Le foto non vengono spedite altrove per l’analisi',
        text: 'La scrematura avviene nel tuo browser. Le foto non vengono passate a servizi di terzi: anche il modello dei volti viene caricato dal nostro server.',
      },
    ],
  },
  pricing: {
    label: 'Prezzi',
    titleBefore: 'Prezzi della galleria online: ',
    titleAccent: 'paghi solo lo spazio',
    lede:
      'La selezione delle foto da parte del cliente è gratuita per tutti. I piani a pagamento rimuovono il nostro marchio e aggiungono video e più spazio; dal piano Plus anche le statistiche.',
    perMonth: '/ mese',
    freeLabel: 'nessuna carta',
    yearHint: (year) => `oppure ${year} ₴ all’anno: due mesi in regalo`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB di spazio` : `${gb} GB di spazio`),
    popular: 'Consigliato',
    fineprint:
      'Paghi con la carta di qualsiasi banca ucraina. Puoi disdire quando vuoi: tutto continua a funzionare per altri 14 giorni. Dopo, se superi i 3 GB gratuiti, le gallerie si chiudono ai clienti e i file vengono conservati per altri 60 giorni.',
    plans: {
      free: {
        name: 'Gratuito',
        note: 'Ogni galleria resta aperta 30 giorni: per provare',
        bullets: ['Selezione foto da parte del cliente', 'Gallerie con password e scadenza', 'Gallerie illimitate'],
      },
      basic: {
        name: 'Base',
        note: 'Il tuo brand, e solo il tuo',
        bullets: ['Senza il nostro marchio', 'Il tuo logo nelle gallerie', 'Video nelle gallerie'],
      },
      plus: {
        name: 'Plus',
        note: 'Per un’intera stagione di lavoro',
        bullets: ['Tutto del piano Base', 'Statistiche delle visualizzazioni', 'Mance dai clienti'],
      },
      pro: {
        name: 'Massimo',
        note: 'Archivi grandi e una stagione intensa',
        bullets: ['Tutto del piano Plus', 'Assistenza prioritaria', '1 TB di spazio'],
      },
    },
    planCta: 'Scegli',
  },
  referral: {
    label: 'Programma referral',
    title: 'Invita i colleghi e ricevi il 10% di ogni loro pagamento',
    lede: 'Condividi il tuo link con un fotografo. Quando sceglie un piano a pagamento, ricevi il 10% di ogni suo pagamento come credito, ogni mese. Il credito riduce automaticamente il tuo prossimo pagamento.',
    steps: [
      'Prendi il tuo link nella dashboard.',
      'Un collega si registra con il tuo link e sceglie un piano a pagamento.',
      'Ogni mese ricevi il 10% come credito, in automatico.',
    ],
    cta: 'Ottieni il tuo link',
  },
  faq: {
    label: 'Domande frequenti',
    title: 'Le cose importanti, in breve',
    items: [
      {
        q: 'I clienti vedono che la galleria è fatta con proiav?',
        a: 'Con il piano gratuito, in fondo alla galleria c’è una piccola scritta «Creato con proiav». Dal piano Base in su sparisce: nelle pagine ci sono solo il tuo nome, il tuo logo e le tue foto.',
      },
      {
        q: 'La scrematura con l’AI può nascondere o eliminare foto da sola?',
        a: 'No. Segnala soltanto i probabili scarti: scatti sfocati, ripetizioni nelle raffiche, occhi chiusi. Al cliente viene nascosto solo ciò che confermi e nascondi con l’apposito pulsante; i file non vengono eliminati e ogni foto può essere ripristinata.',
      },
      {
        q: 'Cosa vede il cliente mentre le foto sono in post-produzione?',
        a: 'Se imposti lo stato del servizio, al link della galleria il cliente vede «Servizio → Post-produzione → Pronta» e la data prevista, se l’hai indicata. Appena aggiungi le foto, la galleria si apre proprio lì.',
      },
      {
        q: 'Cosa succede ai file se disdico?',
        a: 'Per 14 giorni tutto funziona come prima. Se rientri nei 3 GB gratuiti, l’account diventa semplicemente gratuito. Altrimenti le gallerie si chiudono ai clienti e i file vengono conservati per altri 60 giorni: continui a vedere tutto, puoi scaricarlo o rinnovare il piano. Ti avvisiamo via e-mail 30, 7 e 1 giorno prima dell’eliminazione.',
      },
      {
        q: 'Le mie foto vengono compresse?',
        a: 'Gli originali vengono conservati byte per byte. Il cliente sfoglia anteprime generate apposta, ma il pulsante di download restituisce sempre l’originale.',
      },
    ],
  },
  final: {
    label: 'Inizia con una galleria',
    titleBefore: 'Consegna il tuo prossimo servizio ',
    titleAccent: 'con stile',
    cta: 'Crea un account gratuito',
  },
  footer: {
    tagline: 'Gallerie online per i clienti dei fotografi in Ucraina',
    blog: 'Blog',
    terms: 'Offerta al pubblico',
    privacy: 'Informativa sulla privacy',
    support: 'Assistenza',
  },
}
