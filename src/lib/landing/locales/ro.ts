import type { LandingCopy } from '../copy'

/** Romanian — marketing landing page. */
export const ro: LandingCopy = {
  nav: {
    features: 'Funcții',
    galleries: 'Galerii',
    sites: 'Site-uri',
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
    slotPay: 'Plătiți fotografului',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Povești de nuntă',
  },
  strip: { label: 'Lucrări ale fotografilor' },
  products: {
    label: 'Galerii · rezervări · un singur panou',
    titleBefore: 'Galerie pentru clienți — ',
    titleAccent: 'sub brandul dumneavoastră',
    lede:
      'Totul începe cu galeriile — acolo se întâlnește fotograful cu clienții în fiecare săptămână. Iar dacă vreți ca clienții să-și aleagă singuri ora și să plătească pe loc, rezervările funcționează deja.',
    soon: 'În curând',
    items: [
      {
        no: '01 — Galerii',
        title: 'Livrați ședințele frumos',
        text: 'Încărcați fotografiile — clientul primește un link frumos și le descarcă singur, fără Google Drive și fără „cum le descarc?”. Favorite, parolă, termen de valabilitate, zip, statistici.',
        tagStrong: 'Originale necomprimate.',
        tagRest: ' Fișierele exact cum au fost făcute',
      },
      {
        no: '02 — Rezervări',
        title: 'Clientul își alege singur ora',
        text: 'Și plătește pe loc — Monobank, WayForPay, „pușculiță” sau transfer bancar. Fără rezervări duble, iar rezervările neplătite se eliberează singure.',
        tagStrong: 'Banii ajung direct la dumneavoastră.',
        tagRest: ' Noi nu atingem plățile',
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
      payments: { label: 'Plăți', text: 'Direct pe cardul dumneavoastră. Mereu.' },
      stats: { label: 'Statistici', number: '247', text: 'vizualizări ale galeriei săptămâna aceasta' },
      themes: {
        label: 'Designul galeriei',
        text: 'Trei stări, cinci aranjări',
        chips: ['Mozaic', 'Colaj', 'Editorial', 'Pătrate', 'Portret 3:4'],
      },
      previewPhoto: 'Previzualizări fără pierdere de viteză',
      autoRelease: { label: 'Rezervări', text: 'Un interval neplătit se eliberează singur după câteva ore' },
      video: {
        label: 'Clipuri video mari',
        text: 'Încărcare pe bucăți: o cădere a rețelei la 95% costă secunde, nu ore',
      },
      email: { label: 'E-mail', text: 'E-mailul despre o rezervare nouă sosește imediat, cu datele clientului' },
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
        title: 'Banii merg direct',
        text: 'Plățile pentru ședințe ajung în contul dumneavoastră de acceptare a plăților sau pe card. Platforma nu vă ține banii nicio secundă.',
      },
      {
        title: 'Originalele rămân neatinse',
        text: 'Fișierele sunt păstrate byte cu byte. Clienții răsfoiesc previzualizări rapide și descarcă la calitate maximă.',
      },
      {
        title: 'Plata = cuvântul băncii',
        text: 'Statusul „plătit” se setează după verificarea la bancă — niciodată pe cuvântul clientului sau pe baza unui webhook neverificat.',
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
        note: 'Arhive mari și un calendar plin',
        bullets: ['Tot ce include Plus', 'Asistență prioritară', '1 TB spațiu de stocare'],
      },
    },
    planCta: 'Aleg',
    siteTitle: 'Site-uri pentru fotografi',
    siteLede: 'Un site personal cu domeniu propriu, SSL și SEO. Perioadă de probă gratuită de 7 zile.',
    sitePlans: {
      site_trial: { name: 'De probă', note: '1 site pentru 7 zile' },
      site_basic: { name: 'Basic', note: '1 site · domeniu propriu · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2+ site-uri · mai multe limbi · restul la fel' },
    },
    bundleNote: 'Pachetul Galerie + Site — 15% reducere la site cât timp ambele abonamente sunt active.',
    soonBadge: 'În curând',
    siteComingSoon:
      'Constructorul de site-uri pentru fotografi este în plină dezvoltare și se lansează în curând. Deocamdată ne concentrăm pe galerii: de acolo începe lucrul cu clientul. Vreți să aflați primii de lansare? Lăsați-ne adresa de e-mail prin „Începeți gratuit”.',
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
        q: 'Prin cine trec plățile pentru ședințe?',
        a: 'Pe lângă noi. Facturile se creează în contul dumneavoastră de acceptare a plăților Monobank sau WayForPay, iar metodele manuale sunt propria „pușculiță” sau propriul card. Noi doar afișăm butonul și verificăm statusul plății la bancă.',
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
  },
}
