import type { ClientPolicyLocale } from '../clientPolicies'

/** Romanian — ready-made client documents for a photographer's site. */
export const ro: ClientPolicyLocale = {
  defaultName: 'Fotograful',
  render: (name, email) => {
    const to = email ? `${email}` : 'adresa de contact indicată pe site'
    return {
      privacy: {
        title: 'Politica de confidențialitate',
        blocks: [
          `Acest document explică modul în care ${name} („Fotograful”) colectează și folosește datele dumneavoastră cu caracter personal atunci când rezervați o ședință foto sau vizualizați galeria dumneavoastră online.`,
          '# Ce date colectăm',
          'Numele, datele de contact (telefon, e-mail, conturi de rețele sociale), detaliile rezervării și fotografiile realizate în timpul ședinței. Pentru accesul la galerie se pot folosi o parolă și un identificator tehnic de sesiune.',
          '# Pentru ce le folosim',
          'Pentru a realiza ședința și a vă livra fotografiile, pentru a stabili detaliile, pentru a emite factura și — cu acordul dumneavoastră — pentru a include anumite cadre în portofoliu. Nu vindem datele dumneavoastră unor terți.',
          '# Publicarea fotografiilor',
          'Fotografiile din ședința dumneavoastră nu sunt publicate în portofoliu sau pe rețelele sociale fără acordul dumneavoastră. Vă puteți retrage acordul oricând, scriindu-ne.',
          '# Păstrarea datelor',
          'Păstrăm galeria și fișierele sursă pe perioada stabilită la rezervare, după care acestea pot fi șterse. Copiile de rezervă nu sunt păstrate mai mult decât este necesar din punct de vedere tehnic.',
          '# Drepturile dumneavoastră',
          `Puteți solicita o copie a datelor dumneavoastră, rectificarea sau ștergerea lor și vă puteți retrage acordul pentru publicare. Pentru aceasta, scrieți la ${to}.`,
          '# Contact',
          `Pentru orice întrebare legată de datele dumneavoastră, contactați: ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Condiții de plată și rambursare',
        blocks: [
          `Aceste condiții se referă la avans, plată și rambursarea sumelor pentru serviciile foto oferite de ${name} („Fotograful”).`,
          '# Rezervare și avans',
          'Data ședinței vă este rezervată după achitarea avansului. Avansul confirmă rezervarea și blochează timpul respectiv în programul Fotografului.',
          '# Anularea de către client',
          'Dacă anulați ședința cu mai mult de 7 zile înainte de dată, avansul se restituie integral sau se mută pe o altă dată. În cazul unei anulări mai târzii, avansul poate fi reținut drept compensație pentru timpul rezervat.',
          '# Anulare sau forță majoră',
          'Dacă ședința nu poate avea loc din vina Fotografului sau din motive de forță majoră, puteți alege: mutarea pe o altă dată sau restituirea integrală a avansului.',
          '# Fotografiile livrate',
          'Întrucât serviciul foto este personalizat și deja prestat, plata pentru o ședință realizată și pentru fotografiile editate nu se restituie. Dacă rezultatul diferă semnificativ de ceea ce s-a convenit, vom stabili împreună ajustările necesare.',
          '# Cum solicitați o rambursare',
          `Pentru a solicita o rambursare sau mutarea ședinței, scrieți la ${to}. Sumele se restituie prin aceeași metodă prin care au fost plătite, într-un termen rezonabil.`,
        ],
      },
    }
  },
}
