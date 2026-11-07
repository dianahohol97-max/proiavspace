import type { LandingCopy } from '../copy'

/** German — full translation of the `en` landing copy. */
export const de: LandingCopy = {
  nav: {
    features: 'Funktionen',
    galleries: 'Galerien',
    sites: 'Websites',
    pricing: 'Preise',
    themes: 'Themes',
    blog: 'Blog',
    signIn: 'Anmelden',
    ctaShort: 'Kostenlos starten',
    dashboard: 'Dashboard',
  },
  hero: {
    chips: ['Hochzeiten', 'Familien', 'Porträts', 'Studios'],
    titleBefore: 'Alles, was ',
    titleAccent: 'nach',
    titleAfter: ' dem Auslösen passiert',
    subtitle: 'Die Online-Kundengalerie für Fotografen: Übergeben Sie ein Shooting mit einem einzigen schönen Link.',
    lede:
      'Galerien, in denen Ihre Kunden sofort wissen, wie sie an ihre Fotos kommen — ohne Google Drive und ohne „Wie lade ich das herunter?“. Favoriten, Passwort und Ablaufdatum, Originale ohne Komprimierung. Überall nur Ihre Marke.',
    cta: 'Kostenlos starten',
    ctaNote: '3 GB kostenlos, jede Galerie bleibt 30 Tage online. Keine Kreditkarte nötig.',
    statNumber: '30.000',
    statText: 'Fotos wurden über proiav-Galerien an Kunden übergeben',
    slotPay: 'An den Fotografen zahlen',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Hochzeitsgeschichten',
  },
  strip: { label: 'Arbeiten von Fotografen' },
  products: {
    label: 'Galerien · Buchung · ein Dashboard',
    titleBefore: 'Die Kundengalerie für Fotografen — ',
    titleAccent: 'unter Ihrer Marke',
    lede:
      'Alles beginnt mit Galerien — dort begegnen Fotografen ihren Kunden jede Woche. Und wenn Ihre Kunden selbst einen Termin wählen und gleich bezahlen sollen: Auch die Buchung funktioniert schon.',
    soon: 'Bald',
    items: [
      {
        no: '01 — Galerien',
        title: 'Shootings schön übergeben',
        text: 'Sie laden die Fotos hoch — Ihre Kunden bekommen einen schönen Link und laden selbst herunter, ohne Google Drive und ohne „Wie lade ich das herunter?“. Favoriten, Passwort, Ablaufdatum, ZIP-Archiv, Statistik.',
        tagStrong: 'Originale ohne Komprimierung.',
        tagRest: ' Dateien genau so, wie Sie sie aufgenommen haben',
      },
      {
        no: '02 — Buchung',
        title: 'Kunden wählen ihren Termin selbst',
        text: 'Und zahlen sofort — über Monobank, WayForPay, eine Monobank-Sammeldose oder per Überweisung. Keine Doppelbuchungen, unbezahlte Reservierungen werden automatisch wieder frei.',
        tagStrong: 'Das Geld geht direkt an Sie.',
        tagRest: ' Wir berühren keine Zahlungen',
      },
    ],
  },
  bento: {
    label: 'Alles in einem Dashboard',
    titleBefore: 'Die kleinen Dinge, die die Arbeit ',
    titleAccent: 'entspannt machen',
    cards: {
      selection: {
        label: 'Auswahl',
        text: 'Kunden markieren Bilder für die Retusche mit einem Herz — die Dateiliste exportieren Sie mit einem Klick',
      },
      galleryPhoto: 'Galerie',
      protection: { label: 'Schutz', text: 'Passwort und Ablaufdatum für jede Galerie' },
      archive: { label: 'Archiv', text: 'Alles mit einem Klick — das ZIP-Archiv entsteht ohne Warteschlange' },
      payments: { label: 'Zahlungen', text: 'Direkt auf Ihre Karte. Immer.' },
      stats: { label: 'Statistik', number: '247', text: 'Galerieaufrufe diese Woche' },
      themes: {
        label: 'Galeriedesign',
        text: 'Drei Stimmungen, fünf Layouts',
        chips: ['Masonry','Collage', 'Editorial', 'Quadrate', 'Hochformat 3:4'],
      },
      previewPhoto: 'Vorschaubilder ohne Tempoverlust',
      autoRelease: { label: 'Buchung', text: 'Ein unbezahlter Termin wird nach ein paar Stunden automatisch wieder frei' },
      video: {
        label: 'Große Videos',
        text: 'Upload in Teilen: Bricht die Verbindung bei 95 % ab, kostet das Sekunden statt Stunden',
      },
      email: { label: 'E-Mail', text: 'Die E-Mail zur neuen Buchung kommt sofort — mit den Kontaktdaten der Kunden' },
    },
  },
  principles: {
    huge: 'Prinzipien',
    title: 'Wie die Plattform im Inneren gebaut ist',
    lede: 'Keine Funktionsliste — sondern Entscheidungen, an denen wir nicht rütteln.',
    items: [
      {
        title: 'Ihre Marke im Vordergrund',
        text: 'Ab dem ersten bezahlten Tarif erwähnen die Galerien uns mit keinem Wort. Ihre Kunden sehen nur Sie.',
      },
      {
        title: 'Das Geld fließt direkt',
        text: 'Zahlungen für Shootings gehen auf Ihr Händlerkonto oder Ihre Karte. Die Plattform hält Ihr Geld keine Sekunde lang fest.',
      },
      {
        title: 'Originale bleiben unangetastet',
        text: 'Dateien werden Byte für Byte gespeichert. Kunden sehen schnelle Vorschaubilder und laden die volle Qualität herunter.',
      },
      {
        title: 'Bezahlt = von der Bank bestätigt',
        text: 'Der Status „bezahlt“ wird erst nach Prüfung bei der Bank gesetzt — nie auf Zuruf der Kunden oder durch einen ungeprüften Webhook.',
      },
    ],
  },
  pricing: {
    label: 'Preise',
    titleBefore: 'Preise für Online-Galerien: ',
    titleAccent: 'Sie zahlen nur für Speicher',
    lede:
      'Die Bildauswahl durch Kunden ist für alle kostenlos. Bezahlte Tarife entfernen unser Branding und bringen Videos und mehr Speicher, ab „Plus“ auch Statistiken.',
    perMonth: '/ Monat',
    freeLabel: 'ohne Kreditkarte',
    yearHint: (year) => `oder ${year} ₴ pro Jahr — zwei Monate geschenkt`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB Speicher` : `${gb} GB Speicher`),
    popular: 'Empfohlen',
    fineprint:
      'Zahlung mit der Karte jeder ukrainischen Bank. Jederzeit kündbar — danach funktioniert noch 14 Tage lang alles weiter. Überschreiten Sie anschließend die kostenlosen 3 GB, werden die Galerien für Kunden geschlossen und die Dateien noch 60 Tage aufbewahrt.',
    plans: {
      free: {
        name: 'Kostenlos',
        note: 'Jede Galerie bleibt 30 Tage online — zum Ausprobieren',
        bullets: ['Bildauswahl durch Kunden', 'Galerien mit Passwort und Ablaufdatum', 'Unbegrenzt viele Galerien'],
      },
      basic: {
        name: 'Basis',
        note: 'Ihre Marke — und nur Ihre',
        bullets: ['Ohne unser Branding', 'Ihr Logo in den Galerien', 'Videos in Galerien'],
      },
      plus: {
        name: 'Plus',
        note: 'Für eine volle Saison',
        bullets: ['Alles aus „Basis“', 'Aufrufstatistik', 'Trinkgeld von Kunden'],
      },
      pro: {
        name: 'Maximum',
        note: 'Große Archive und ein voller Kalender',
        bullets: ['Alles aus „Plus“', 'Bevorzugter Support', '1 TB Speicher'],
      },
    },
    planCta: 'Auswählen',
    siteTitle: 'Websites für Fotografen',
    siteLede: 'Eine persönliche Website mit eigener Domain, SSL und SEO. 7 Tage kostenlos testen.',
    sitePlans: {
      site_trial: { name: 'Test', note: '1 Website für 7 Tage' },
      site_basic: { name: 'Basis', note: '1 Website · eigene Domain · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2+ Websites · mehrsprachig · alles andere wie gehabt' },
    },
    bundleNote: 'Paket „Galerie + Website“ — 15 % Rabatt auf die Website, solange beide Abos aktiv sind.',
    soonBadge: 'Bald',
    siteComingSoon:
      'Der Website-Baukasten für Fotografen ist in Arbeit und startet in Kürze. Bis dahin liegt der Fokus auf Galerien: Dort beginnt die Arbeit mit Ihren Kunden. Sie möchten als Erste vom Start erfahren? Hinterlassen Sie Ihre E-Mail-Adresse über „Kostenlos starten“.',
  },
  referral: {
    label: 'Empfehlungsprogramm',
    title: 'Laden Sie Kollegen ein — und erhalten Sie 10 % jeder ihrer Zahlungen',
    lede: 'Teilen Sie Ihren Link mit anderen Fotografen. Sobald jemand einen bezahlten Tarif abschließt, erhalten Sie 10 % jeder Zahlung als Guthaben — jeden Monat. Das Guthaben wird automatisch mit Ihrer nächsten Rechnung verrechnet.',
    steps: [
      'Holen Sie sich Ihren Link im Dashboard.',
      'Ein Kollege registriert sich darüber und schließt einen bezahlten Tarif ab.',
      'Sie erhalten jeden Monat 10 % als Guthaben — automatisch.',
    ],
    cta: 'Link holen',
  },
  faq: {
    label: 'Häufige Fragen',
    title: 'Das Wichtigste in Kürze',
    items: [
      {
        q: 'Sehen meine Kunden, dass die Galerie mit proiav erstellt wurde?',
        a: 'Im kostenlosen Tarif steht unten in der Galerie ein kleiner Hinweis „Erstellt mit proiav“. Ab „Basis“ ist er verschwunden: Auf den Seiten stehen nur Ihr Name, Ihr Logo und Ihre Fotos.',
      },
      {
        q: 'Über wen laufen die Zahlungen für Shootings?',
        a: 'An uns vorbei. Rechnungen werden über Ihr eigenes Monobank- oder WayForPay-Händlerkonto erstellt; manuelle Zahlungen gehen auf Ihre Monobank-Sammeldose oder Ihre Karte. Wir zeigen nur den Button an und prüfen den Zahlungsstatus bei der Bank.',
      },
      {
        q: 'Was passiert mit meinen Dateien, wenn ich kündige?',
        a: '14 Tage lang funktioniert alles wie gewohnt. Passen Sie in die kostenlosen 3 GB, wird Ihr Konto einfach kostenlos. Wenn nicht, werden die Galerien für Kunden geschlossen und die Dateien noch 60 Tage aufbewahrt: Sie sehen weiterhin alles, können es herunterladen oder den Tarif verlängern. Wir erinnern Sie 30, 7 und 1 Tag vor dem Löschen per E-Mail.',
      },
      {
        q: 'Werden meine Fotos komprimiert?',
        a: 'Originale werden Byte für Byte gespeichert. Kunden sehen beim Durchblättern generierte Vorschaubilder, der Download-Button liefert aber immer das Original.',
      },
    ],
  },
  final: {
    label: 'Fangen Sie mit einer Galerie an',
    titleBefore: 'Übergeben Sie Ihr nächstes Shooting ',
    titleAccent: 'mit Stil',
    cta: 'Kostenloses Konto erstellen',
  },
  footer: {
    tagline: 'Online-Kundengalerien für Fotografen in der Ukraine',
    blog: 'Blog',
    terms: 'Öffentliches Angebot',
    privacy: 'Datenschutzerklärung',
  },
}
