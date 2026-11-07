import type { ClientPolicyLocale } from '../clientPolicies'

/** German — the photographer's ready-made documents for their own clients. */
export const de: ClientPolicyLocale = {
  defaultName: 'der Fotograf',
  render: (name, email) => {
    const to = email ? `${email}` : 'die auf der Website angegebene Kontaktadresse'
    return {
      privacy: {
        title: 'Datenschutzerklärung',
        blocks: [
          `Diese Erklärung beschreibt, wie ${name} („Fotograf“) Ihre personenbezogenen Daten erhebt und verwendet, wenn Sie ein Shooting buchen oder Ihre Online-Galerie ansehen.`,
          '# Welche Daten wir erheben',
          'Ihren Namen, Ihre Kontaktdaten (Telefon, E-Mail, Social-Media-Profile), die Details Ihrer Buchung sowie die Fotos, die beim Shooting entstehen. Für den Zugang zur Galerie können ein Passwort und eine technische Sitzungskennung verwendet werden.',
          '# Wofür wir sie verwenden',
          'Um das Shooting durchzuführen und Ihnen die Fotos zu übergeben, Details abzustimmen, eine Rechnung zu stellen und — mit Ihrer Einwilligung — ausgewählte Bilder im Portfolio zu zeigen. Wir verkaufen Ihre Daten nicht an Dritte.',
          '# Veröffentlichung von Fotos',
          'Fotos aus Ihrem Shooting werden ohne Ihre Einwilligung weder im Portfolio noch in sozialen Netzwerken veröffentlicht. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie uns schreiben.',
          '# Speicherung',
          'Wir speichern die Galerie und die Ausgangsdateien für den bei der Buchung vereinbarten Zeitraum; danach können sie gelöscht werden. Sicherungskopien werden nicht länger aufbewahrt, als es technisch erforderlich ist.',
          '# Ihre Rechte',
          `Sie können eine Kopie, die Berichtigung oder die Löschung Ihrer Daten verlangen und Ihre Einwilligung zur Veröffentlichung widerrufen. Schreiben Sie dazu an ${to}.`,
          '# Kontakt',
          `Ansprechpartner für alle Fragen zu Ihren Daten: ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Zahlungs- und Rückerstattungsbedingungen',
        blocks: [
          `Diese Bedingungen regeln Anzahlung, Zahlung und Rückerstattung für die Fotografie-Leistungen, die ${name} („Fotograf“) erbringt.`,
          '# Buchung und Anzahlung',
          'Ihr Shooting-Termin ist fest für Sie reserviert, sobald die Anzahlung eingegangen ist. Die Anzahlung bestätigt die Buchung und reserviert die Zeit im Kalender des Fotografen.',
          '# Stornierung durch Sie',
          'Wenn Sie das Shooting mehr als 7 Tage vor dem Termin absagen, wird die Anzahlung vollständig erstattet oder auf einen anderen Termin übertragen. Bei einer späteren Absage kann die Anzahlung als Ausgleich für die reservierte Zeit einbehalten werden.',
          '# Absage oder höhere Gewalt',
          'Kann das Shooting aus Gründen, die beim Fotografen liegen, oder wegen höherer Gewalt nicht stattfinden, haben Sie die Wahl: Verschiebung auf einen anderen Termin oder vollständige Erstattung der Anzahlung.',
          '# Fertige Fotos',
          'Da die Fotografie eine individuelle, bereits erbrachte Leistung ist, wird die Zahlung für ein durchgeführtes Shooting und bearbeitete Fotos nicht erstattet. Weicht das Ergebnis wesentlich von der Vereinbarung ab, vereinbaren wir eine Nachbesserung.',
          '# So beantragen Sie eine Rückerstattung',
          `Um eine Rückerstattung oder Terminverschiebung zu veranlassen, schreiben Sie an ${to}. Das Geld wird innerhalb einer angemessenen Frist auf demselben Weg zurückgezahlt, auf dem es gezahlt wurde.`,
        ],
      },
    }
  },
}
