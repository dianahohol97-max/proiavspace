import type { GalleryHelp } from '../help'

/** Italian — «How it works» help blocks in the dashboard. */
export const it: GalleryHelp = {
  culling: {
    title: 'Come funziona la scrematura degli scatti',
    items: [
      'Premi «Screma gli scatti»: il browser esamina le anteprime della galleria e segnala gli scatti sfocati, le ripetizioni nelle raffiche e, se l’opzione è attiva, gli occhi chiusi.',
      'Tutto avviene su questo computer: le foto non vengono inviate da nessuna parte. Per il controllo degli occhi il browser scarica una sola volta un modello dei volti (~4 MB) dal nostro server.',
      'Le segnalazioni sono solo suggerimenti. Con «Conferma lo scarto» confermi che lo scatto è da scartare, con «Rimuovi segnalazione» indichi che va bene. In ogni raffica uno scatto è indicato come il migliore: puoi sceglierne un altro.',
      'Il cliente non si accorge di nulla finché non premi «Nascondi al cliente». Le foto nascoste non vengono eliminate: le trovi nel filtro «Nascoste al cliente» e puoi renderle di nuovo visibili una per una.',
      'Mentre la scheda è nascosta, l’analisi è in pausa. Puoi annullarla: quello che è già stato controllato resta salvato, e le nuove foto si possono analizzare in seguito.',
    ],
  },
  delivery: {
    title: 'Come il cliente vede lo stato',
    items: [
      'Scegli una fase: viene salvata subito. Il cliente la vede al solito link della galleria, non serve un link a parte.',
      'Finché la galleria ha meno di due foto visibili al cliente, lui vede la schermata «Servizio → Post-produzione → Pronta». Una singola foto diventa l’anteprima sullo sfondo.',
      'Da due foto in su si apre la galleria, con la fase indicata in un banner in alto. «Pronta» e «Nessuno stato» mostrano la normale galleria senza banner.',
      'La data è facoltativa: il cliente vede «prevista entro il …». Puoi cambiarla o rimuoverla in qualsiasi momento.',
    ],
  },
  upload: {
    title: 'Cosa fare se il caricamento si interrompe',
    items: [
      'Se cade internet, non fare nulla e tieni aperta la scheda. Comparirà «Nessuna connessione» e il caricamento riprenderà da solo appena torna la rete (se torna entro 15 minuti).',
      'I file grandi (oltre 16 MB) vengono caricati in blocchi da 8 MB, quindi un’interruzione fa ripetere un solo blocco, non l’intero file.',
      'Se hai chiuso la scheda o il browser, riapri questa galleria. Sopra l’area di caricamento vedrai i file non completati: scegli proprio quelli, e i file grandi riprenderanno da dove si erano fermati, mentre quelli più piccoli verranno caricati di nuovo.',
      'Se accanto a un file compare ✕, sceglilo di nuovo. Non aggiungere di nuovo i file che sono già nella galleria qui sotto: verrebbero caricati due volte.',
    ],
  },
}
