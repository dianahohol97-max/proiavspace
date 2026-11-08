import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** German — translation of the Ukrainian (legally binding) edition. */
export const de: LegalCopy = {
  backToHome: '← Startseite',
  reviewNote:
    'Diese Übersetzung dient nur der besseren Verständlichkeit. Rechtsverbindlich ist die ukrainische Fassung; bei Abweichungen hat der ukrainische Text Vorrang. Die Übersetzung begründet keine Verpflichtungen, die über die ukrainische Fassung hinausgehen.',
  oferta: {
    title: 'Öffentliches Angebot (Nutzungsbedingungen)',
    updated: `Fassung vom ${UPDATED}`,
    intro:
      `Dieses Dokument ist das offizielle öffentliche Angebot (Oferta) von ${ENTITY} (im Folgenden „Anbieter“) zum Abschluss eines Vertrags über den Zugang zum Online-Dienst „проЯв“ (im Folgenden „Dienst“) zu den nachstehenden Bedingungen. Indem Sie sich beim Dienst registrieren oder eine Zahlung leisten, nehmen Sie (im Folgenden „Nutzer“) die Bedingungen dieses Angebots vollständig und vorbehaltlos an.`,
    sections: [
      {
        heading: '1. Begriffe',
        paragraphs: [
          '„Dienst“ — das webbasierte Softwareprodukt „проЯв“ (proiav.space), das Fotografen Werkzeuge für Online-Kundengalerien, persönliche Websites und die Annahme von Buchungen bereitstellt.',
          '„Nutzer“ — ein Fotograf oder eine andere Person, die ein Konto beim Dienst registriert hat.',
          '„Kunde des Nutzers“ — eine dritte Person, der der Nutzer Zugang zu einer Galerie oder einem Buchungsformular gewährt.',
          '„Tarif“ — ein Paket von Funktionen und Speicherplatz, das gemäß der Preisseite gegen Entgelt bereitgestellt wird.',
        ],
      },
      {
        heading: '2. Vertragsgegenstand',
        paragraphs: [
          'Der Anbieter gewährt dem Nutzer Zugang zu den Funktionen des Dienstes zu den Bedingungen des gewählten Tarifs; der Nutzer verpflichtet sich, diesen Zugang zu bezahlen (ausgenommen den kostenlosen Tarif) und die Bedingungen dieses Angebots einzuhalten.',
          'Der Dienst wird „wie besehen“ bereitgestellt. Der Anbieter entwickelt den Dienst weiter und kann den Funktionsumfang ändern; über wesentliche Änderungen informiert er rechtzeitig im Voraus.',
        ],
      },
      {
        heading: '3. Tarife und Zahlung',
        paragraphs: [
          'Die aktuellen Preise sind auf der Preisseite in ukrainischen Hrywnja (₴) angegeben. Die Zahlung erfolgt mit der Karte einer ukrainischen Bank über einen Zahlungsdienstleister (Monobank / LiqPay); der Anbieter speichert keine vollständigen Zahlungskartendaten.',
          'Ein Abonnement gilt für den bezahlten Zeitraum (Monat oder Jahr) und verlängert sich bei aktivierter automatischer Verlängerung automatisch, bis der Nutzer es kündigt.',
          'Die automatische Verlängerung wird über das Kontrollkästchen „Automatische Verlängerung“ neben dem Zahlungsbutton auf der Preisseite aktiviert; daneben sind der Betrag und die Häufigkeit der Abbuchung angegeben. Bleibt das Kontrollkästchen aktiviert, speichert der Zahlungsdienstleister (Monobank) einen Karten-Token, und in jedem folgenden Zeitraum wird derselbe Betrag für den gewählten Tarif automatisch von der Karte abgebucht (abzüglich eines etwaigen Empfehlungsguthabens). Wird das Kontrollkästchen deaktiviert, wird die Karte nicht gespeichert und der Tarif gilt nur für den bezahlten Zeitraum.',
          '3 Tage vor jeder automatischen Abbuchung sendet der Dienst dem Nutzer eine E-Mail mit dem Betrag, dem Abbuchungsdatum und einem Link zur Kündigung. Die automatische Verlängerung kann jederzeit im Dashboard (Bereich „Tarif“) gekündigt werden — danach wird die Karte nicht mehr belastet und der gespeicherte Token gelöscht.',
          'Bei Zahlung über Google Pay oder Apple Pay wird die Karte nicht gespeichert, daher ist für solche Zahlungen keine automatische Verlängerung möglich: Der Tarif gilt für den bezahlten Zeitraum.',
          'Die jährliche Zahlung wird zum Preis von zehn Monaten angeboten (zwei Monate geschenkt).',
        ],
      },
      {
        heading: '4. Rückerstattung',
        paragraphs: [
          'Da der Zugang zum digitalen Dienst sofort gewährt wird, ist ein bezahlter Zeitraum nicht erstattungsfähig, außer in den Fällen, die die Verbraucherschutzgesetzgebung der Ukraine ausdrücklich vorsieht.',
          'Die automatische Verlängerung kann jederzeit im Dashboard gekündigt werden; nach der Kündigung gilt der Tarif bis zum Ende des bezahlten Zeitraums, danach bleibt der volle Zugang im Rahmen des Tariflimits noch 14 Tage erhalten.',
          'Überschreiten die Dateien des Nutzers nach diesen 14 Tagen das Limit des kostenlosen Tarifs (3 GB), werden die Galerien für die Kunden des Nutzers geschlossen; die Dateien werden noch 60 Tage aufbewahrt und danach unwiderruflich aus dem Speicher gelöscht. Während dieser 60 Tage hat der Nutzer vollen Zugriff auf die Dateien im Dashboard, kann sie herunterladen oder den Tarif wiederherstellen — dann werden die Galerien unter denselben Links wieder geöffnet. Über jede Phase informiert der Dienst per E-Mail (insbesondere 30, 7 und 1 Tag vor dem Löschen). Innerhalb seines Limits ist die Speicherdauer im kostenlosen Tarif nicht begrenzt.',
          'Der kostenlose Monat im Tarif „Basis“ für den Import einer Galerie (Aktion) wird einmal pro Konto gewährt; nach seinem Ablauf gelten dieselben Regeln wie nach dem Ende eines bezahlten Zeitraums.',
        ],
      },
      {
        heading: '5. Rechte und Pflichten des Nutzers',
        paragraphs: [
          'Der Nutzer sichert zu, dass er alle Rechte an den von ihm hochgeladenen Inhalten (Fotos usw.) besitzt, und ist für deren Rechtmäßigkeit verantwortlich, insbesondere für das Vorliegen der Einwilligung der abgebildeten Personen in die Verarbeitung und Verbreitung ihrer Abbildungen.',
          'Der Nutzer bestimmt Zweck und Umfang der Verarbeitung personenbezogener Daten seiner Kunden selbst und ist Verantwortlicher (Inhaber) dieser Daten; der Anbieter verarbeitet sie ausschließlich im Auftrag des Nutzers (siehe Datenschutzerklärung).',
          'Es ist untersagt, den Dienst für rechtswidrige oder betrügerische Inhalte oder für Inhalte zu nutzen, die Rechte Dritter verletzen.',
        ],
      },
      {
        heading: '6. Haftung',
        paragraphs: [
          'Der Anbieter bemüht sich um einen störungsfreien Betrieb des Dienstes, garantiert jedoch nicht die Abwesenheit technischer Störungen und haftet nicht für Verluste, die durch höhere Gewalt oder durch Handlungen Dritter (Hosting-, Zahlungs- oder Kommunikationsdienstleister) verursacht werden.',
          'Der Anbieter ist nicht Partei der Beziehungen zwischen dem Nutzer und seinen Kunden und haftet nicht für den Inhalt von Galerien und Websites oder für Vereinbarungen über Shootings.',
        ],
      },
      {
        heading: '7. Personenbezogene Daten',
        paragraphs: [
          'Personenbezogene Daten werden gemäß dem Gesetz der Ukraine „Über den Schutz personenbezogener Daten“ und der Datenschutzerklärung verarbeitet, die ein untrennbarer Bestandteil dieses Angebots ist.',
        ],
      },
      {
        heading: '8. Laufzeit und Änderungen',
        paragraphs: [
          'Das Angebot gilt ab seiner Veröffentlichung auf unbestimmte Zeit. Der Anbieter ist berechtigt, seine Bedingungen zu ändern, indem er eine neue Fassung auf dieser Seite veröffentlicht; die weitere Nutzung des Dienstes gilt als Zustimmung zur neuen Fassung.',
        ],
      },
      {
        heading: '9. Angaben zum Anbieter',
        paragraphs: [
          `Bezeichnung: ${ENTITY}`,
          `Steuergruppe: Zahler der Einheitssteuer, dritte Gruppe`,
          `Datum der staatlichen Registrierung: 04.09.2023`,
          `Sitz: Ukraine, Ternopil (vollständige Adresse auf Anfrage)`,
          `E-Mail: ${SUPPORT_EMAIL}`,
          `Vollständige Angaben (Steuernummer RNOKPP, Bankkonto) werden in der Rechnung und auf Anfrage mitgeteilt.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Datenschutzerklärung',
    updated: `Fassung vom ${UPDATED}`,
    intro:
      `Diese Erklärung beschreibt, welche personenbezogenen Daten der Dienst „проЯв“ (${ENTITY}) verarbeitet, zu welchem Zweck und auf welcher Grundlage. Mit der Nutzung des Dienstes stimmen Sie dieser Erklärung zu.`,
    sections: [
      {
        heading: '1. Welche Daten wir verarbeiten',
        paragraphs: [
          'Kontodaten: E-Mail-Adresse, Name/Markenname, Profileinstellungen.',
          'Vom Fotografen hochgeladene Inhalte: Fotos und begleitende Informationen zu Galerien und Websites. Diese Daten können Abbildungen Dritter (der Kunden des Fotografen) enthalten.',
          'Technische Daten: Zugriffsprotokolle, anonymisierte Nutzungsanalysen (Google Analytics).',
          'Zahlungsdaten verarbeitet der Zahlungsdienstleister (Monobank / LiqPay); wir erhalten nur den Zahlungsstatus, nicht die vollständigen Kartendaten.',
        ],
      },
      {
        heading: '2. Rollen: Verantwortlicher und Auftragsverarbeiter',
        paragraphs: [
          'Für die Kontodaten des Fotografen ist der Anbieter der Verantwortliche.',
          'Für die personenbezogenen Daten der Kunden (insbesondere Abbildungen auf Fotos) ist der Fotograf selbst der Verantwortliche — er bestimmt den Zweck der Verarbeitung. Der Anbieter handelt als Auftragsverarbeiter und verarbeitet diese Daten ausschließlich im Auftrag des Fotografen und für den Betrieb des Dienstes.',
        ],
      },
      {
        heading: '3. Zweck und Rechtsgrundlagen der Verarbeitung',
        paragraphs: [
          'Bereitstellung der Funktionen des Dienstes (Erfüllung des Vertrags gemäß Angebot), Zahlungsabwicklung, Nutzersupport, Gewährleistung der Sicherheit und Erfüllung gesetzlicher Anforderungen.',
          'Rechtsgrundlagen: Vertragserfüllung, Einwilligung der betroffenen Person, berechtigte Interessen des Anbieters und Erfüllung rechtlicher Verpflichtungen.',
        ],
      },
      {
        heading: '4. Weitergabe und Unterauftragsverarbeiter',
        paragraphs: [
          'Wir arbeiten mit zuverlässigen Infrastrukturanbietern zusammen: Hosting der Anwendung und der Datenbank, Cloud-Dateispeicher, ein Zahlungsdienstleister und ein Analysedienst. Sie verarbeiten Daten nur in dem Umfang, der für die Erbringung ihrer Leistungen erforderlich ist.',
          'Wir verkaufen keine personenbezogenen Daten an Dritte.',
        ],
      },
      {
        heading: '5. Speicherung',
        paragraphs: [
          'Daten werden gespeichert, solange das Konto besteht oder solange der Verarbeitungszweck oder das Gesetz es erfordert. Nach dem Löschen des Kontos werden die Daten innerhalb einer angemessenen Frist gelöscht oder anonymisiert.',
          'Dateien werden in einem Cloud-Speicher abgelegt; Originale werden nicht verändert.',
        ],
      },
      {
        heading: '6. Ihre Rechte',
        paragraphs: [
          'Sie haben das Recht auf Auskunft über Ihre Daten, auf Berichtigung, Löschung, Einschränkung der Verarbeitung und Widerspruch gegen die Verarbeitung sowie das Recht, eine Einwilligung zu widerrufen.',
          `Um Ihre Rechte auszuüben, schreiben Sie an ${SUPPORT_EMAIL}. Wenn Sie Kunde eines Fotografen sind, wenden Sie sich bitte zuerst an den Fotografen selbst als Verantwortlichen für Ihre Daten.`,
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Wir verwenden notwendige Cookies für die Anmeldung und das Speichern von Einstellungen sowie Analyse-Cookies, um die Nutzung des Dienstes zu verstehen. Sie können Cookies in den Einstellungen Ihres Browsers verwalten.',
        ],
      },
      {
        heading: '8. Kontakt',
        paragraphs: [
          `Bei Fragen zum Datenschutz: ${SUPPORT_EMAIL}. Verantwortlicher: ${ENTITY}.`,
        ],
      },
    ],
  },
}
