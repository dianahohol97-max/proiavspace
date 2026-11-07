import type { LandingCopy } from '../copy'

/** German — full translation of the `en` landing copy. */
export const de: LandingCopy = {
  nav: {
    features: 'Funktionen',
    galleries: 'Galerien',
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
    status: { steps: ['Shooting', 'Bearbeitung', 'Fertig'], now: 'aktuell', eta: 'Voraussichtlich bis 14. Dezember' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Hochzeitsgeschichten',
  },
  strip: { label: 'Arbeiten von Fotografen' },
  products: {
    label: 'Galerien · Bildsichtung · Shooting-Status',
    titleBefore: 'Die Kundengalerie für Fotografen — ',
    titleAccent: 'unter Ihrer Marke',
    lede:
      'Alles beginnt mit der Galerie — dort begegnen Fotografen ihren Kunden jede Woche. Neu in den Galerien: Sichtung von Ausschuss, ein Shooting-Status für Ihre Kunden und Uploads, die einen Verbindungsabbruch überstehen. Unten sehen Sie die echten Bildschirme.',
    gallery: {
      no: '01 — Galerien',
      title: 'Shootings schön übergeben',
      text: 'Sie laden die Fotos hoch — Ihre Kunden bekommen einen schönen Link und laden selbst herunter, ohne Google Drive und ohne „Wie lade ich das herunter?“. Favoriten, Passwort, Ablaufdatum, ZIP-Archiv, Statistik.',
      tagStrong: 'Originale ohne Komprimierung.',
      tagRest: ' Dateien genau so, wie Sie sie aufgenommen haben',
    },
    features: [
      {
        no: '02 — KI-Bildsichtung',
        title: 'Ausschuss wird markiert, Sie entscheiden',
        text: 'Unscharfe Bilder, Wiederholungen innerhalb einer Serie und geschlossene Augen werden automatisch markiert, und das beste Bild einer Serie steht direkt neben den anderen. Die Analyse läuft in Ihrem Browser — die Fotos werden nirgendwohin gesendet.',
        tagStrong: 'Nichts wird von selbst ausgeblendet.',
        tagRest: ' Ein Foto verschwindet für Ihre Kunden erst, wenn Sie es bestätigen',
        alt: 'Das Panel „Bildsichtung“: Markierungen „Wiederholung“ und „Unscharf“ auf Fotos und der Filter „Möglicher Ausschuss“',
      },
      {
        no: '03 — Shooting-Status',
        title: 'Kunden sehen, wo ihre Fotos gerade sind',
        text: 'Solange die Galerie leer ist, zeigt derselbe Link Ihren Kunden „Shooting → Bearbeitung → Fertig“ und, falls Sie eines festlegen, ein voraussichtliches Datum. Sobald die Fotos da sind, öffnet sich genau dort die Galerie.',
        tagStrong: 'Ein Schalter im Dashboard.',
        tagRest: ' Ihre Kunden sehen Änderungen sofort',
        alt: 'Der Statusbildschirm für Kunden: „Ihre Fotos sind bereits in Arbeit“, der Schritt „Bearbeitung“ und ein voraussichtliches Datum',
      },
      {
        no: '04 — Zuverlässiger Upload',
        title: 'Ein Verbindungsabbruch heißt nicht: alles von vorn',
        text: 'Große Dateien werden in Teilen zu 8 MB hochgeladen. Bricht das Netz ab, wartet der Upload und macht von selbst weiter. Wurde der Tab geschlossen, wählen Sie dieselben Dateien erneut — es geht dort weiter, wo es aufgehört hat.',
        tagStrong: 'Wiederholt wird nur der unfertige Teil,',
        tagRest: ' nicht die ganze Datei',
        alt: 'Der Galerie-Upload offline: Fotos bereits hochgeladen, Videos warten auf die Verbindung',
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
      watermark: { label: 'Wasserzeichen', text: 'Ihr Name auf den Vorschaubildern. Die Originale bleiben unverändert' },
      stats: { label: 'Statistik', number: '247', text: 'Galerieaufrufe diese Woche' },
      themes: {
        label: 'Galeriedesign',
        text: 'Drei Stimmungen, fünf Layouts',
        chips: ['Masonry', 'Collage', 'Editorial', 'Quadrate', 'Hochformat 3:4'],
      },
      previewPhoto: 'Vorschaubilder ohne Tempoverlust',
      slideshow: { label: 'Ansicht', text: 'Vollbildansicht und Diashow — auch auf dem Smartphone' },
      video: {
        label: 'Video',
        text: 'Clips neben den Fotos in derselben Galerie — ab dem Tarif „Basis“',
      },
      languages: { label: 'Sprachen', text: 'Kunden stellen die Galerie auf ihre Sprache um — neun stehen zur Wahl' },
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
        title: 'Sie haben das letzte Wort',
        text: 'Die Automatik macht nur Vorschläge. Kein Foto wird vor Ihren Kunden ausgeblendet, bevor Sie es bestätigen.',
      },
      {
        title: 'Originale bleiben unangetastet',
        text: 'Dateien werden Byte für Byte gespeichert. Kunden sehen schnelle Vorschaubilder und laden die volle Qualität herunter.',
      },
      {
        title: 'Ihre Fotos bleiben bei Ihnen',
        text: 'Die Bildsichtung läuft in Ihrem Browser. Fotos werden nicht an Drittanbieter weitergegeben — selbst das Gesichtsmodell kommt von unserem eigenen Server.',
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
        note: 'Große Archive und eine volle Saison',
        bullets: ['Alles aus „Plus“', 'Bevorzugter Support', '1 TB Speicher'],
      },
    },
    planCta: 'Auswählen',
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
        q: 'Kann die KI-Bildsichtung Fotos selbstständig ausblenden oder löschen?',
        a: 'Nein. Sie markiert nur wahrscheinlichen Ausschuss: unscharfe Bilder, Wiederholungen innerhalb einer Serie, geschlossene Augen. Vor Ihren Kunden ausgeblendet wird nur, was Sie bestätigen und per Button ausblenden — die Dateien werden nicht gelöscht, und jedes Foto lässt sich wieder einblenden.',
      },
      {
        q: 'Was sehen meine Kunden, während die Fotos bearbeitet werden?',
        a: 'Wenn Sie einen Shooting-Status festlegen, zeigt der Galerie-Link Ihren Kunden „Shooting → Bearbeitung → Fertig“ und, falls Sie eines angeben, ein voraussichtliches Datum. Sobald Sie die Fotos hinzufügen, öffnet sich genau dort die Galerie.',
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
