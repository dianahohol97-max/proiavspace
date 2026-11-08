import type { GalleryHelp } from '../help'

/** German — «How it works» help blocks in the dashboard. */
export const de: GalleryHelp = {
  culling: {
    title: 'So funktioniert die Bildsichtung',
    items: [
      'Klicken Sie auf „Bilder sichten“: Der Browser geht die Vorschaubilder der Galerie durch und markiert unscharfe Bilder, Wiederholungen innerhalb einer Serie und — falls aktiviert — geschlossene Augen.',
      'Alles läuft auf diesem Computer — die Fotos werden nirgendwohin gesendet. Für die Augenprüfung lädt der Browser einmalig ein Gesichtsmodell (ca. 4 MB) von unserem eigenen Server.',
      'Markierungen sind nur Vorschläge. „Markierung behalten“ bestätigt Ausschuss, „Markierung entfernen“ bedeutet: Das Foto ist in Ordnung. In jeder Serie ist ein Foto als bestes markiert — Sie können ein anderes wählen.',
      'Ihre Kunden merken nichts, bis Sie auf „Vor Kunden ausblenden“ klicken. Ausgeblendete Fotos werden nicht gelöscht: Sie finden sie im Filter „Vor Kunden ausgeblendet“ und können jedes wieder einblenden.',
      'Solange der Tab im Hintergrund ist, pausiert die Analyse. Sie können sie abbrechen — was bereits geprüft wurde, bleibt erhalten, und neue Fotos lassen sich später nachträglich analysieren.',
    ],
  },
  delivery: {
    title: 'So sehen Ihre Kunden den Status',
    items: [
      'Wählen Sie einen Schritt — er wird sofort gespeichert. Ihre Kunden sehen ihn unter dem gewohnten Galerie-Link; ein eigener Link ist nicht nötig.',
      'Solange die Galerie weniger als zwei für Kunden sichtbare Fotos enthält, sehen Ihre Kunden den Bildschirm „Shooting → Bearbeitung → Fertig“. Ein einzelnes Foto wird dort zum Vorschaubild im Hintergrund.',
      'Ab zwei Fotos öffnet sich die Galerie, und der Schritt erscheint in einem Banner oben. Bei „Fertig“ und „Kein Status“ sehen Ihre Kunden die normale Galerie ohne Banner.',
      'Das Datum ist optional: Ihre Kunden sehen „voraussichtlich bis …“. Sie können es jederzeit ändern oder entfernen.',
    ],
  },
  upload: {
    title: 'Was tun, wenn ein Upload abbricht',
    items: [
      'Das Internet ist weg — tun Sie nichts und lassen Sie den Tab geöffnet. Sie sehen „Keine Verbindung“, und der Upload läuft von selbst weiter, sobald das Netz wieder da ist (sofern innerhalb von 15 Minuten).',
      'Große Dateien (über 16 MB) werden in Teilen zu 8 MB hochgeladen — bei einem Abbruch wird also nur ein Teil wiederholt, nicht die ganze Datei.',
      'Tab oder Browser wurden geschlossen — öffnen Sie diese Galerie erneut. Über dem Upload-Feld sehen Sie die unvollständigen Dateien: Wählen Sie genau diese aus, dann machen große Dateien dort weiter, wo sie aufgehört haben, und kleinere werden neu hochgeladen.',
      'Neben einer Datei steht ✕ — wählen Sie diese Datei noch einmal aus. Fügen Sie Dateien, die unten bereits in der Galerie sind, nicht erneut hinzu: Sie würden doppelt hochgeladen.',
    ],
  },
}
