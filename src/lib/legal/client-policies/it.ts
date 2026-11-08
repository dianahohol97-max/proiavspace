import type { ClientPolicyLocale } from '../clientPolicies'

/** Italian — the photographer's ready-made client documents. */
export const it: ClientPolicyLocale = {
  defaultName: 'il Fotografo',
  render: (name, email) => {
    const to = email ? `${email}` : 'l’indirizzo di contatto indicato sul sito'
    return {
      privacy: {
        title: 'Informativa sulla privacy',
        blocks: [
          `La presente informativa spiega come ${name} (il «Fotografo») raccoglie e utilizza i tuoi dati personali quando prenoti un servizio fotografico o consulti la tua galleria online.`,
          '# Quali dati raccogliamo',
          'Il tuo nome, i tuoi recapiti (telefono, e-mail, profili social), i dettagli della prenotazione e le fotografie scattate durante il servizio. Per l’accesso alla galleria possono essere utilizzati una password e un identificativo tecnico di sessione.',
          '# Come li utilizziamo',
          'Per realizzare il servizio e consegnarti le fotografie, concordare i dettagli, emettere la fattura e, con il tuo consenso, mostrare alcuni scatti nel portfolio. Non vendiamo i tuoi dati a terzi.',
          '# Pubblicazione delle fotografie',
          'Le foto del tuo servizio non vengono pubblicate nel portfolio o sui social senza il tuo consenso. Puoi revocare il consenso in qualsiasi momento scrivendoci.',
          '# Conservazione',
          'Conserviamo la galleria e i file originali per il periodo concordato al momento della prenotazione, dopodiché possono essere eliminati. Le copie di backup vengono conservate solo per il tempo tecnicamente necessario.',
          '# I tuoi diritti',
          `Puoi richiedere una copia, la rettifica o la cancellazione dei tuoi dati, e revocare il consenso alla pubblicazione. Per farlo, scrivi a ${to}.`,
          '# Contatti',
          `Per qualsiasi domanda sui tuoi dati, rivolgiti a ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Condizioni di pagamento e rimborso',
        blocks: [
          `Le presenti condizioni regolano acconto, pagamento e rimborsi per i servizi fotografici forniti da ${name} (il «Fotografo»).`,
          '# Prenotazione e acconto',
          'La data del servizio è riservata a te dopo il versamento dell’acconto. L’acconto conferma la prenotazione e blocca il tempo nel calendario del Fotografo.',
          '# Disdetta da parte del cliente',
          'Se disdici il servizio più di 7 giorni prima della data, l’acconto viene rimborsato per intero oppure spostato su un’altra data. In caso di disdetta successiva, l’acconto può essere trattenuto a compensazione del tempo riservato.',
          '# Annullamento o forza maggiore',
          'Se il servizio non può avere luogo per causa del Fotografo o per forza maggiore, puoi scegliere tra lo spostamento a un’altra data e il rimborso integrale dell’acconto.',
          '# Fotografie consegnate',
          'Poiché il servizio fotografico è una prestazione personalizzata e già eseguita, il pagamento per un servizio realizzato e per le fotografie elaborate non è rimborsabile. Se il risultato si discosta in modo sostanziale da quanto concordato, ci accorderemo per una revisione.',
          '# Come richiedere un rimborso',
          `Per richiedere un rimborso o uno spostamento, scrivi a ${to}. Le somme vengono restituite con lo stesso metodo di pagamento utilizzato, entro un termine ragionevole.`,
        ],
      },
    }
  },
}
