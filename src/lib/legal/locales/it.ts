import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** Italian — translation of the Ukrainian (legally binding) `uk` object in ../copy.ts. */
export const it: LegalCopy = {
  backToHome: '← Home',
  reviewNote:
    'Questa traduzione è fornita per comodità. La versione giuridicamente vincolante è quella in lingua ucraina: in caso di discrepanze prevale il testo ucraino. La traduzione non crea obblighi ulteriori rispetto alla versione ucraina.',
  oferta: {
    title: 'Offerta al pubblico',
    updated: `Versione del ${UPDATED}`,
    intro:
      `Il presente documento costituisce l’offerta ufficiale al pubblico (di seguito «Offerta») di ${ENTITY} (di seguito «Fornitore») a concludere un contratto per l’accesso al servizio online «проЯв» (di seguito «Servizio») alle condizioni indicate di seguito. Registrandoti al Servizio o effettuando un pagamento, tu (di seguito «Utente») accetti integralmente e senza riserve le condizioni della presente Offerta.`,
    sections: [
      {
        heading: '1. Definizioni',
        paragraphs: [
          '«Servizio»: il prodotto software web «проЯв» (proiav.space), che mette a disposizione dei fotografi strumenti per gallerie online per i clienti, siti personali e la ricezione di prenotazioni.',
          '«Utente»: il fotografo o altra persona che ha registrato un account nel Servizio.',
          '«Cliente dell’Utente»: il terzo a cui l’Utente concede l’accesso a una galleria o a un modulo di prenotazione.',
          '«Piano»: l’insieme di funzionalità e lo spazio di archiviazione forniti a pagamento secondo quanto indicato nella pagina dei piani.',
        ],
      },
      {
        heading: '2. Oggetto del contratto',
        paragraphs: [
          'Il Fornitore concede all’Utente l’accesso alle funzionalità del Servizio alle condizioni del Piano scelto, e l’Utente si impegna a pagare tale accesso (salvo il piano gratuito) e a rispettare le condizioni della presente Offerta.',
          'Il Servizio è fornito «così com’è». Il Fornitore sviluppa il Servizio e può modificarne le funzionalità, comunicando in anticipo le modifiche sostanziali.',
        ],
      },
      {
        heading: '3. Piani e pagamento',
        paragraphs: [
          'I prezzi aggiornati sono indicati nella pagina dei piani in grivnie ucraine (₴). Il pagamento avviene con carta di una banca ucraina tramite un fornitore di servizi di pagamento (Monobank / LiqPay); il Fornitore non conserva i dati completi della carta di pagamento.',
          'L’abbonamento è valido per il periodo pagato (un mese o un anno) e, se il rinnovo automatico è attivo, si rinnova automaticamente finché l’Utente non lo disdice.',
          'Il rinnovo automatico si attiva con la casella «Rinnovo automatico» accanto al pulsante di pagamento nella pagina dei piani, dove sono indicati l’importo e la frequenza dell’addebito. Se la casella resta selezionata, il fornitore di servizi di pagamento (Monobank) conserva un token della carta e a ogni periodo successivo viene addebitato automaticamente lo stesso importo per il Piano scelto (al netto dell’eventuale credito referral). Se la casella viene deselezionata, la carta non viene salvata e il Piano è valido solo per il periodo pagato.',
          'Tre giorni prima di ogni addebito automatico il Servizio invia all’indirizzo e-mail dell’Utente un messaggio con l’importo, la data dell’addebito e un link per disdire. Il rinnovo automatico può essere disattivato in qualsiasi momento nella dashboard (sezione «Piano»): da quel momento la carta non viene più addebitata e il token salvato viene eliminato.',
          'Il pagamento tramite Google Pay o Apple Pay non salva la carta, quindi per tali pagamenti il rinnovo automatico non è disponibile: il Piano è valido per il periodo pagato.',
          'Il pagamento annuale ha il prezzo di dieci mesi (due mesi in regalo).',
        ],
      },
      {
        heading: '4. Rimborsi',
        paragraphs: [
          'Poiché l’accesso al Servizio digitale viene fornito immediatamente, il periodo pagato non è rimborsabile, salvo i casi espressamente previsti dalla legislazione ucraina in materia di tutela dei diritti dei consumatori.',
          'Il rinnovo automatico può essere disattivato in qualsiasi momento nella dashboard; dopo la disattivazione il Piano resta valido fino alla fine del periodo pagato, dopodiché l’accesso completo nei limiti del Piano viene mantenuto per altri 14 giorni.',
          'Se, trascorsi questi 14 giorni, i file dell’Utente superano il limite del piano gratuito (3 GB), le gallerie vengono chiuse ai clienti dell’Utente e i file vengono conservati per altri 60 giorni, dopodiché vengono eliminati dallo spazio di archiviazione senza possibilità di recupero. Durante questi 60 giorni l’Utente ha pieno accesso ai file nella dashboard, può scaricarli o rinnovare il Piano: in tal caso le gallerie vengono riaperte agli stessi link. Il Servizio avvisa via e-mail di ogni fase (in particolare 30, 7 e 1 giorno prima dell’eliminazione). Il piano gratuito, entro il proprio limite, non prevede un termine di conservazione.',
          'Il mese gratuito del piano «Base» per l’importazione di una galleria (promozione) viene concesso una sola volta per account; al suo termine si applicano le stesse regole previste alla scadenza del periodo pagato.',
        ],
      },
      {
        heading: '5. Diritti e obblighi dell’Utente',
        paragraphs: [
          'L’Utente garantisce di essere titolare di tutti i diritti sui contenuti (fotografie, ecc.) che carica ed è responsabile della loro liceità, compresa la presenza del consenso delle persone ritratte al trattamento e alla diffusione delle loro immagini.',
          'L’Utente determina autonomamente le finalità e la portata del trattamento dei dati personali dei propri Clienti e ne è il titolare; il Fornitore li tratta esclusivamente su incarico dell’Utente (si veda l’Informativa sulla privacy).',
          'È vietato utilizzare il Servizio per contenuti illeciti, fraudolenti o che violano i diritti di terzi.',
        ],
      },
      {
        heading: '6. Responsabilità',
        paragraphs: [
          'Il Fornitore si impegna a garantire il funzionamento continuo del Servizio, ma non garantisce l’assenza di malfunzionamenti tecnici e non risponde delle perdite causate da forza maggiore o da azioni di terzi (fornitori di hosting, servizi di pagamento, comunicazioni).',
          'Il Fornitore non è parte dei rapporti tra l’Utente e i suoi Clienti e non risponde del contenuto delle gallerie e dei siti né degli accordi relativi ai servizi fotografici.',
        ],
      },
      {
        heading: '7. Dati personali',
        paragraphs: [
          'Il trattamento dei dati personali avviene in conformità alla Legge dell’Ucraina «Sulla protezione dei dati personali» e all’Informativa sulla privacy, che costituisce parte integrante della presente Offerta.',
        ],
      },
      {
        heading: '8. Durata e modifiche',
        paragraphs: [
          'L’Offerta è valida a tempo indeterminato dal momento della pubblicazione. Il Fornitore ha il diritto di modificarne le condizioni pubblicando una nuova versione su questa pagina; continuare a utilizzare il Servizio significa accettare la nuova versione.',
        ],
      },
      {
        heading: '9. Dati del Fornitore',
        paragraphs: [
          `Denominazione: ${ENTITY}`,
          `Regime fiscale: contribuente in regime d’imposta unica, terzo gruppo`,
          `Data di registrazione statale: 04.09.2023`,
          `Sede: Ucraina, Ternopil (indirizzo completo su richiesta)`,
          `E-mail: ${SUPPORT_EMAIL}`,
          `I dati completi (codice fiscale RNOKPP, conto bancario) sono indicati in fattura e forniti su richiesta.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Informativa sulla privacy',
    updated: `Versione del ${UPDATED}`,
    intro:
      `La presente Informativa spiega quali dati personali tratta il servizio «проЯв» (${ENTITY}), per quali finalità e su quali basi. Utilizzando il Servizio, accetti la presente Informativa.`,
    sections: [
      {
        heading: '1. Quali dati trattiamo',
        paragraphs: [
          'Dati dell’account: indirizzo e-mail, nome/nome del brand, impostazioni del profilo.',
          'Contenuti caricati dal fotografo: fotografie e informazioni di accompagnamento per gallerie e siti. Questi dati possono contenere immagini di terzi (i Clienti del fotografo).',
          'Dati tecnici: log di accesso, analisi anonimizzate dell’utilizzo (Google Analytics).',
          'I dati di pagamento sono trattati dal fornitore di servizi di pagamento (Monobank / LiqPay); noi riceviamo solo lo stato del pagamento, non i dati completi della carta.',
        ],
      },
      {
        heading: '2. Ruoli: titolare e responsabile del trattamento',
        paragraphs: [
          'Per i dati dell’account del fotografo, il titolare del trattamento è il Fornitore.',
          'Per i dati personali dei Clienti (comprese le immagini nelle foto), il titolare del trattamento è il fotografo stesso, che ne determina le finalità. Il Fornitore agisce come responsabile del trattamento (processor) e tratta tali dati esclusivamente su incarico del fotografo e per il funzionamento del Servizio.',
        ],
      },
      {
        heading: '3. Finalità e basi del trattamento',
        paragraphs: [
          'Fornitura delle funzionalità del Servizio (esecuzione del contratto-offerta), elaborazione dei pagamenti, assistenza agli utenti, sicurezza e adempimento degli obblighi di legge.',
          'Basi giuridiche: esecuzione del contratto, consenso dell’interessato, legittimi interessi del Fornitore e adempimento di obblighi legali.',
        ],
      },
      {
        heading: '4. Comunicazione dei dati e subfornitori',
        paragraphs: [
          'Ci avvaliamo di fornitori di infrastruttura affidabili: hosting dell’applicazione e del database, archiviazione cloud dei file, fornitore di servizi di pagamento e servizio di analisi. Trattano i dati solo nella misura necessaria a fornire i propri servizi.',
          'Non vendiamo dati personali a terzi.',
        ],
      },
      {
        heading: '5. Conservazione',
        paragraphs: [
          'I dati vengono conservati finché esiste l’account o finché lo richiedono la finalità del trattamento o la legge. Dopo l’eliminazione dell’account, i dati vengono cancellati o anonimizzati entro un termine ragionevole.',
          'I file sono conservati in uno spazio di archiviazione cloud; gli originali non vengono modificati.',
        ],
      },
      {
        heading: '6. I tuoi diritti',
        paragraphs: [
          'Hai diritto di accedere ai tuoi dati, di rettificarli, di cancellarli, di limitarne il trattamento e di opporti al trattamento, nonché di revocare il consenso.',
          `Per esercitare questi diritti, scrivi a ${SUPPORT_EMAIL}. Se sei un Cliente di un fotografo, rivolgiti innanzitutto al fotografo stesso, in quanto titolare del trattamento dei tuoi dati.`,
        ],
      },
      {
        heading: '7. Cookie',
        paragraphs: [
          'Utilizziamo cookie necessari per l’autenticazione e il salvataggio delle impostazioni, e cookie analitici per capire come viene utilizzato il Servizio. Puoi gestire i cookie nelle impostazioni del browser.',
        ],
      },
      {
        heading: '8. Contatti',
        paragraphs: [
          `Per domande sulla privacy: ${SUPPORT_EMAIL}. Titolare del trattamento: ${ENTITY}.`,
        ],
      },
    ],
  },
}
