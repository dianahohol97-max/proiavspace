import type { LandingCopy } from '../copy'

/** Italian landing copy — translation of the `en` object in ../copy.ts. */
export const it: LandingCopy = {
  nav: {
    features: 'Funzionalità',
    galleries: 'Gallerie',
    sites: 'Siti',
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
    slotPay: 'Paga il fotografo',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Storie di matrimonio',
  },
  strip: { label: 'Lavori dei fotografi' },
  products: {
    label: 'Gallerie · prenotazioni · una sola dashboard',
    titleBefore: 'Una galleria per i clienti dei fotografi, ',
    titleAccent: 'con il tuo brand',
    lede:
      'Tutto parte dalle gallerie: è lì che un fotografo incontra i clienti ogni settimana. E se vuoi che i clienti scelgano da soli l’orario e paghino subito, anche le prenotazioni sono già attive.',
    soon: 'Presto',
    items: [
      {
        no: '01 — Gallerie',
        title: 'Consegna i servizi con stile',
        text: 'Carichi le foto, il cliente riceve un bel link e scarica tutto in autonomia: niente Google Drive, niente «ma come si scarica?». Preferiti, password, scadenza, ZIP, statistiche.',
        tagStrong: 'Originali senza compressione.',
        tagRest: ' I file restano come li hai scattati',
      },
      {
        no: '02 — Prenotazioni',
        title: 'Il cliente sceglie l’orario da solo',
        text: 'E paga subito: Monobank, WayForPay, salvadanaio o bonifico. Niente doppie prenotazioni, e gli orari non pagati si liberano da soli.',
        tagStrong: 'I soldi arrivano direttamente a te.',
        tagRest: ' Non tocchiamo mai i pagamenti',
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
      payments: { label: 'Pagamenti', text: 'Direttamente sulla tua carta. Sempre.' },
      stats: { label: 'Statistiche', number: '247', text: 'visualizzazioni della galleria questa settimana' },
      themes: {
        label: 'Design della galleria',
        text: 'Tre atmosfere, cinque layout',
        chips: ['Masonry', 'Collage', 'Editoriale', 'Quadrati', 'Ritratto 3:4'],
      },
      previewPhoto: 'Anteprime senza perdere velocità',
      autoRelease: { label: 'Prenotazioni', text: 'Un orario non pagato si libera da solo dopo qualche ora' },
      video: {
        label: 'Video pesanti',
        text: 'Caricamento a blocchi: se la rete cade al 95% perdi secondi, non ore',
      },
      email: { label: 'E-mail', text: 'L’e-mail per ogni nuova prenotazione arriva subito, con i contatti del cliente' },
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
        title: 'Soldi direttamente a te',
        text: 'I pagamenti dei servizi arrivano sul tuo acquiring o sulla tua carta. La piattaforma non trattiene i tuoi soldi nemmeno per un secondo.',
      },
      {
        title: 'Originali intoccabili',
        text: 'I file vengono conservati byte per byte. Il cliente sfoglia anteprime veloci e scarica la qualità piena.',
      },
      {
        title: 'Pagato = lo dice la banca',
        text: 'Lo stato «pagato» viene impostato dopo la verifica con la banca: mai sulla parola del cliente o in base a un webhook non verificato.',
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
        note: 'Archivi grandi e un calendario pieno',
        bullets: ['Tutto del piano Plus', 'Assistenza prioritaria', '1 TB di spazio'],
      },
    },
    planCta: 'Scegli',
    siteTitle: 'Siti per fotografi',
    siteLede: 'Un sito personale con dominio personalizzato, SSL e SEO. Prova gratuita di 7 giorni.',
    sitePlans: {
      site_trial: { name: 'Prova', note: '1 sito per 7 giorni' },
      site_basic: { name: 'Base', note: '1 sito · dominio personalizzato · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2+ siti · multilingua · tutto il resto incluso' },
    },
    bundleNote: 'Pacchetto Galleria + Sito: 15% di sconto sul sito finché entrambi gli abbonamenti sono attivi.',
    soonBadge: 'Presto',
    siteComingSoon:
      'Il costruttore di siti per fotografi è in pieno sviluppo e arriverà a breve. Per ora ci concentriamo sulle gallerie: è da lì che inizia il lavoro con il cliente. Vuoi essere tra i primi a sapere del lancio? Lascia la tua e-mail con «Inizia gratis».',
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
        q: 'Da chi passano i pagamenti dei servizi?',
        a: 'Non da noi. I pagamenti vengono creati sul tuo account merchant Monobank o WayForPay; i metodi manuali sono il tuo salvadanaio o la tua carta. Noi mostriamo solo il pulsante e verifichiamo lo stato del pagamento con la banca.',
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
  },
}
