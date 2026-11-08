import type { LandingCopy } from '../copy'

/** Romanian — marketing landing page. */
export const ro: LandingCopy = {
  nav: {
    features: 'Funcții',
    galleries: 'Galerii',
    pricing: 'Prețuri',
    themes: 'Teme',
    blog: 'Blog',
    signIn: 'Autentificare',
    ctaShort: 'Începeți gratuit',
    dashboard: 'Panou',
  },
  hero: {
    chips: ['Nunți', 'Familii', 'Portrete', 'Studiouri'],
    titleBefore: 'Tot ce urmează ',
    titleAccent: 'după',
    titleAfter: ' declanșare',
    subtitle: 'Galerie online pentru clienții fotografilor: livrați ședința printr-un singur link frumos.',
    lede:
      'Galerii în care clientul înțelege din prima cum își ia fotografiile — fără Google Drive și fără „cum le descarc?”. Favorite, parolă și termen de valabilitate, originale necomprimate. Peste tot doar brandul dumneavoastră.',
    cta: 'Începeți gratuit',
    ctaNote: '3 GB gratuit, fiecare galerie rămâne deschisă 30 de zile. Fără card.',
    statNumber: '30.000',
    statText: 'de fotografii livrate clienților prin galeriile proiav',
    status: { steps: ['Ședința', 'Editare', 'Gata'], now: 'acum', eta: 'Estimat până la 14 decembrie' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Povești de nuntă',
  },
  strip: { label: 'Lucrări ale fotografilor' },
  products: {
    label: 'Galerii · triere · stadiul ședinței',
    titleBefore: 'Galerie pentru clienți — ',
    titleAccent: 'sub brandul dumneavoastră',
    lede:
      'Totul începe cu galeria — acolo se întâlnește fotograful cu clienții în fiecare săptămână. Nou în galerii: trierea rebuturilor, stadiul ședinței pentru client și încărcări care rezistă la căderea conexiunii. Mai jos — ecranele reale.',
    gallery: {
      no: '01 — Galerii',
      title: 'Livrați ședințele frumos',
      text: 'Încărcați fotografiile — clientul primește un link frumos și le descarcă singur, fără Google Drive și fără „cum le descarc?”. Favorite, parolă, termen de valabilitate, zip, statistici.',
      tagStrong: 'Originale necomprimate.',
      tagRest: ' Fișierele exact cum au fost făcute',
    },
    features: [
      {
        no: '02 — Triere cu AI',
        title: 'Rebuturile sunt marcate, decizia e a dumneavoastră',
        text: 'Cadrele neclare, repetările din rafale și ochii închiși sunt marcate automat, iar cel mai bun cadru din rafală stă lângă celelalte. Analiza rulează în browserul dumneavoastră — fotografiile nu sunt trimise nicăieri.',
        tagStrong: 'Nimic nu se ascunde de la sine.',
        tagRest: ' O fotografie dispare pentru client doar după ce o confirmați',
        alt: 'Panoul „Trierea cadrelor”: marcajele „Repetare” și „Neclar” pe fotografii și filtrul „Posibile rebuturi”',
      },
      {
        no: '03 — Stadiul ședinței',
        title: 'Clientul vede unde sunt fotografiile lui',
        text: 'Cât timp galeria e goală, același link îi arată clientului „Ședința → Editare → Gata” și data estimată, dacă ați setat-o. Când fotografiile sunt încărcate, galeria se deschide chiar acolo.',
        tagStrong: 'Un singur comutator în panou.',
        tagRest: ' Clientul vede schimbările imediat',
        alt: 'Ecranul de stadiu pentru client: „Fotografiile dumneavoastră sunt deja în lucru”, etapa „Editare” și data estimată',
      },
      {
        no: '04 — Încărcare sigură',
        title: 'O conexiune căzută nu înseamnă să o luați de la capăt',
        text: 'Fișierele mari se încarcă în bucăți de 8 MB. Cade rețeaua — încărcarea așteaptă și continuă singură. S-a închis fila — alegeți aceleași fișiere, iar încărcarea continuă de unde s-a oprit.',
        tagStrong: 'Se repetă doar partea neterminată,',
        tagRest: ' nu tot fișierul',
        alt: 'Încărcarea în galerie fără conexiune: fotografiile deja încărcate, clipurile video așteaptă conexiunea',
      },
    ],
  },
  bento: {
    label: 'Totul într-un singur panou',
    titleBefore: 'Detaliile mărunte care fac munca ',
    titleAccent: 'liniștită',
    cards: {
      selection: {
        label: 'Selecție',
        text: 'Clientul marchează cu o inimă cadrele pentru retuș — exportați lista de fișiere dintr-un clic',
      },
      galleryPhoto: 'Galerie',
      protection: { label: 'Protecție', text: 'Parolă și termen de valabilitate pentru fiecare galerie' },
      archive: { label: 'Arhivă', text: 'Totul dintr-un clic — zipul se creează fără cozi și fără așteptare' },
      watermark: { label: 'Filigran', text: 'Numele dumneavoastră pe previzualizări. Originalele rămân curate' },
      stats: { label: 'Statistici', number: '247', text: 'vizualizări ale galeriei săptămâna aceasta' },
      themes: {
        label: 'Designul galeriei',
        text: 'Trei stări, cinci aranjări',
        chips: ['Mozaic', 'Colaj', 'Editorial', 'Pătrate', 'Portret 3:4'],
      },
      previewPhoto: 'Previzualizări fără pierdere de viteză',
      slideshow: { label: 'Vizualizare', text: 'Vizualizare pe tot ecranul și prezentare — și pe telefon' },
      video: {
        label: 'Video',
        text: 'Clipuri lângă fotografii, în aceeași galerie — de la planul Basic',
      },
      languages: { label: 'Limbi', text: 'Clienții pot afișa galeria în limba lor — nouă limbi la alegere' },
    },
  },
  principles: {
    huge: 'Principii',
    title: 'Cum este construită platforma pe dinăuntru',
    lede: 'Nu o listă de funcții — ci decizii asupra cărora nu revenim.',
    items: [
      {
        title: 'Brandul dumneavoastră în prim-plan',
        text: 'Începând cu primul plan plătit, galeriile nu ne mai menționează deloc. Clientul îl vede doar pe fotograf.',
      },
      {
        title: 'Decide fotograful',
        text: 'Automatizarea doar sugerează. Nicio fotografie nu este ascunsă de client până nu o confirmați.',
      },
      {
        title: 'Originalele rămân neatinse',
        text: 'Fișierele sunt păstrate byte cu byte. Clienții răsfoiesc previzualizări rapide și descarcă la calitate maximă.',
      },
      {
        title: 'Fotografiile nu pleacă la analiză',
        text: 'Trierea rulează în browserul dumneavoastră. Fotografiile nu sunt transmise unor servicii terțe — chiar și modelul pentru fețe se încarcă de pe serverul nostru.',
      },
    ],
  },
  pricing: {
    label: 'Prețuri',
    titleBefore: 'Prețurile galeriei online: ',
    titleAccent: 'plătiți doar pentru spațiu',
    lede:
      'Selecția fotografiilor de către client este gratuită pentru toți. Planurile plătite elimină brandingul nostru și adaugă video și mai mult spațiu; de la Plus — și statistici.',
    perMonth: '/ lună',
    freeLabel: 'fără card',
    yearHint: (year) => `sau ${year} ₴ pe an — două luni cadou`,
    storage: (gb) =>
      gb >= 1024 ? `${gb / 1024} TB spațiu de stocare` : `${gb} GB spațiu de stocare`,
    popular: 'Recomandat',
    fineprint:
      'Plata se face cu cardul oricărei bănci ucrainene. Puteți anula oricând — totul mai funcționează încă 14 zile. Apoi, dacă depășiți cei 3 GB gratuiți, galeriile se închid pentru clienți, iar fișierele sunt păstrate încă 60 de zile.',
    plans: {
      free: {
        name: 'Gratuit',
        note: 'Fiecare galerie rămâne deschisă 30 de zile — ca să încercați',
        bullets: ['Selecția fotografiilor de către client', 'Galerii cu parolă și termen de valabilitate', 'Galerii nelimitate'],
      },
      basic: {
        name: 'Basic',
        note: 'Brandul dumneavoastră — și doar el',
        bullets: ['Fără brandingul nostru', 'Logoul dumneavoastră în galerii', 'Video în galerii'],
      },
      plus: {
        name: 'Plus',
        note: 'Pentru un sezon plin de lucru',
        bullets: ['Tot ce include Basic', 'Statistici de vizualizare', 'Bacșiș de la clienți'],
      },
      pro: {
        name: 'Maxim',
        note: 'Arhive mari și un sezon aglomerat',
        bullets: ['Tot ce include Plus', 'Asistență prioritară', '1 TB spațiu de stocare'],
      },
    },
    planCta: 'Aleg',
  },
  referral: {
    label: 'Program de recomandare',
    title: 'Invitați colegi — primiți 10% din fiecare plată a lor',
    lede: 'Trimiteți linkul unui fotograf. Când acesta alege un plan plătit, primiți credit de 10% din fiecare plată a lui — în fiecare lună. Creditul vă reduce automat următoarea factură.',
    steps: [
      'Luați-vă linkul din panoul de control.',
      'Un coleg se înregistrează prin el și alege un plan plătit.',
      'Primiți lunar credit de 10% — automat.',
    ],
    cta: 'Obțineți linkul',
  },
  faq: {
    label: 'Întrebări frecvente',
    title: 'Pe scurt, ce contează',
    items: [
      {
        q: 'Văd clienții că galeria e făcută pe proiav?',
        a: 'Pe planul gratuit, în partea de jos a galeriei apare o mică mențiune „Creat cu proiav”. Începând cu Basic, aceasta dispare: paginile poartă doar numele, logoul și fotografiile dumneavoastră.',
      },
      {
        q: 'Poate trierea cu AI să ascundă sau să șteargă fotografii de la sine?',
        a: 'Nu. Ea doar marchează posibilele rebuturi: cadre neclare, repetări din rafale, ochi închiși. Clientului i se ascunde doar ce confirmați și ascundeți cu butonul — fișierele nu se șterg, iar orice fotografie poate fi readusă.',
      },
      {
        q: 'Ce vede clientul cât timp fotografiile sunt în editare?',
        a: 'Dacă setați stadiul ședinței, linkul galeriei îi arată clientului „Ședința → Editare → Gata” și data estimată, dacă ați setat-o. Când adăugați fotografiile, galeria se deschide chiar acolo.',
      },
      {
        q: 'Ce se întâmplă cu fișierele dacă anulez abonamentul?',
        a: 'Totul funcționează încă 14 zile. Dacă vă încadrați în cei 3 GB gratuiți, contul devine pur și simplu gratuit. Dacă nu, galeriile se închid pentru clienți, iar fișierele sunt păstrate încă 60 de zile: vedeți în continuare totul, le puteți descărca sau puteți reînnoi planul. Vă scriem pe e-mail cu 30, 7 și 1 zi înainte de ștergere.',
      },
      {
        q: 'Fotografiile mele sunt comprimate?',
        a: 'Originalele sunt păstrate byte cu byte. Clienții răsfoiesc previzualizări generate, dar butonul de descărcare livrează mereu originalul.',
      },
    ],
  },
  final: {
    label: 'Începeți cu o singură galerie',
    titleBefore: 'Livrați următoarea ședință ',
    titleAccent: 'frumos',
    cta: 'Creați un cont gratuit',
  },
  footer: {
    tagline: 'Galerii online pentru fotografii din Ucraina',
    blog: 'Blog',
    terms: 'Ofertă publică',
    privacy: 'Politica de confidențialitate',
    support: 'Asistență',
  },
}
