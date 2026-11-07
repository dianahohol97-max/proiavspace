import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** Romanian — translation of the Ukrainian (legally binding) edition. */
export const ro: LegalCopy = {
  backToHome: '← Acasă',
  reviewNote:
    'Aceasta este o traducere pusă la dispoziție pentru comoditate. Versiunea cu valoare juridică este cea în limba ucraineană; în caz de neconcordanță, prevalează textul ucrainean. Traducerea nu creează nicio obligație în afara celor prevăzute în versiunea ucraineană.',
  oferta: {
    title: 'Ofertă publică',
    updated: `Versiunea din ${UPDATED}`,
    intro:
      `Prezentul document reprezintă propunerea publică oficială (oferta) a ${ENTITY} (denumită în continuare „Prestatorul”) de a încheia un contract de acordare a accesului la serviciul online „проЯв” (denumit în continuare „Serviciul”), în condițiile de mai jos. Prin înregistrarea în Serviciu sau prin efectuarea unei plăți, dumneavoastră (denumit în continuare „Utilizatorul”) acceptați integral și necondiționat condițiile prezentei oferte.`,
    sections: [
      {
        heading: '1. Termeni',
        paragraphs: [
          '„Serviciul” — produsul software web „проЯв” (proiav.space), care pune la dispoziția fotografilor instrumente pentru galerii online destinate clienților, site-uri personale și primirea rezervărilor.',
          '„Utilizatorul” — fotograful sau altă persoană care și-a înregistrat un cont în Serviciu.',
          '„Clientul Utilizatorului” — persoana terță căreia Utilizatorul îi oferă acces la o galerie sau la un formular de rezervare.',
          '„Planul” — setul de funcții și volumul de spațiu de stocare oferite contra cost, conform paginii cu prețuri.',
        ],
      },
      {
        heading: '2. Obiectul contractului',
        paragraphs: [
          'Prestatorul îi oferă Utilizatorului acces la funcționalitățile Serviciului în condițiile Planului ales, iar Utilizatorul se obligă să plătească acest acces (cu excepția planului gratuit) și să respecte condițiile prezentei oferte.',
          'Serviciul este oferit „ca atare”. Prestatorul dezvoltă Serviciul și poate modifica setul de funcții, anunțând din timp modificările esențiale.',
        ],
      },
      {
        heading: '3. Planuri și plată',
        paragraphs: [
          'Prețurile actuale sunt afișate pe pagina cu prețuri, în hrivne (₴). Plata se efectuează cu cardul unei bănci ucrainene, prin intermediul unui furnizor de servicii de plată (Monobank / LiqPay); Prestatorul nu stochează datele complete ale cardului de plată.',
          'Abonamentul este valabil pe durata perioadei plătite (o lună sau un an) și, dacă reînnoirea automată este activă, se reînnoiește automat până când Utilizatorul îl anulează.',
          'Reînnoirea automată se activează prin bifa „Reînnoire automată” de lângă butonul de plată de pe pagina cu prețuri; alături sunt indicate suma și frecvența debitării. Dacă bifa rămâne activă, furnizorul de servicii de plată (Monobank) păstrează un token al cardului, iar în fiecare perioadă următoare de pe card se debitează automat aceeași sumă pentru planul ales (din care se scade creditul de recomandare, dacă există). Dacă bifa este debifată, cardul nu se salvează, iar planul este valabil doar pentru perioada plătită.',
          'Cu 3 zile înainte de fiecare debitare automată, Serviciul trimite pe adresa de e-mail a Utilizatorului un mesaj cu suma, data debitării și un link de anulare. Reînnoirea automată poate fi anulată oricând din panoul de control (secțiunea „Plan”) — după aceasta cardul nu mai este debitat, iar tokenul salvat este șters.',
          'Plata prin Google Pay sau Apple Pay nu salvează cardul, de aceea pentru o astfel de plată reînnoirea automată nu este disponibilă: planul este valabil pentru perioada plătită.',
          'Plata anuală se face la prețul a zece luni (două luni sunt cadou).',
        ],
      },
      {
        heading: '4. Rambursarea sumelor',
        paragraphs: [
          'Întrucât accesul la Serviciul digital este oferit imediat, perioada plătită nu se rambursează, cu excepția cazurilor prevăzute expres de legislația Ucrainei privind protecția drepturilor consumatorilor.',
          'Reînnoirea automată poate fi anulată oricând din panoul de control; după anulare, planul rămâne valabil până la sfârșitul perioadei plătite, după care accesul complet în limita planului se păstrează încă 14 zile.',
          'Dacă, după aceste 14 zile, fișierele Utilizatorului depășesc limita planului gratuit (3 GB), galeriile se închid pentru clienții Utilizatorului, iar fișierele sunt păstrate încă 60 de zile, după care sunt șterse din spațiul de stocare fără posibilitate de recuperare. În aceste 60 de zile Utilizatorul are acces complet la fișiere în panoul de control, le poate descărca sau poate reactiva planul — caz în care galeriile se redeschid la aceleași linkuri. Serviciul anunță prin e-mail fiecare etapă (inclusiv cu 30, 7 și 1 zi înainte de ștergere). În limita sa, planul gratuit nu are termen de păstrare.',
          'Luna gratuită a planului „Basic” pentru importul unei galerii (promoție) se acordă o singură dată per cont; după încheierea ei se aplică aceleași reguli ca după expirarea perioadei plătite.',
        ],
      },
      {
        heading: '5. Drepturile și obligațiile Utilizatorului',
        paragraphs: [
          'Utilizatorul garantează că deține toate drepturile asupra conținutului (fotografii etc.) pe care îl încarcă și răspunde pentru legalitatea acestuia, inclusiv pentru existența consimțământului persoanelor fotografiate privind prelucrarea și difuzarea imaginilor lor.',
          'Utilizatorul stabilește singur scopul și volumul prelucrării datelor cu caracter personal ale Clienților săi și are calitatea de operator al acestor date; Prestatorul le prelucrează exclusiv în numele Utilizatorului (a se vedea Politica de confidențialitate).',
          'Este interzisă folosirea Serviciului pentru conținut ilegal, fraudulos sau care încalcă drepturile unor persoane terțe.',
        ],
      },
      {
        heading: '6. Răspundere',
        paragraphs: [
          'Prestatorul depune eforturi pentru funcționarea neîntreruptă a Serviciului, dar nu garantează lipsa defecțiunilor tehnice și nu răspunde pentru pierderile cauzate de forță majoră sau de acțiunile unor terți (furnizori de găzduire, de servicii de plată, de comunicații).',
          'Prestatorul nu este parte în relațiile dintre Utilizator și Clienții săi și nu răspunde pentru conținutul galeriilor, al site-urilor și nici pentru înțelegerile privind ședințele foto.',
        ],
      },
      {
        heading: '7. Date cu caracter personal',
        paragraphs: [
          'Prelucrarea datelor cu caracter personal se efectuează în conformitate cu Legea Ucrainei „Cu privire la protecția datelor cu caracter personal” și cu Politica de confidențialitate, care face parte integrantă din prezenta ofertă.',
        ],
      },
      {
        heading: '8. Durata și modificări',
        paragraphs: [
          'Oferta este valabilă pe durată nedeterminată, din momentul publicării. Prestatorul are dreptul să-i modifice condițiile, publicând o versiune nouă pe această pagină; continuarea utilizării Serviciului înseamnă acceptarea noii versiuni.',
        ],
      },
      {
        heading: '9. Datele de identificare ale Prestatorului',
        paragraphs: [
          `Denumire: ${ENTITY}`,
          `Regim de impozitare: plătitor de impozit unic, grupa a treia`,
          `Data înregistrării de stat: 04.09.2023`,
          `Sediul: Ucraina, orașul Ternopil (adresa completă — la cerere)`,
          `E-mail: ${SUPPORT_EMAIL}`,
          `Datele complete (codul fiscal РНОКПП, contul bancar) sunt indicate în factură și se oferă la cerere.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Politica de confidențialitate',
    updated: `Versiunea din ${UPDATED}`,
    intro:
      `Prezenta Politică explică ce date cu caracter personal prelucrează serviciul „проЯв” (${ENTITY}), în ce scop și pe ce temeiuri. Folosind Serviciul, sunteți de acord cu prezenta Politică.`,
    sections: [
      {
        heading: '1. Ce date prelucrăm',
        paragraphs: [
          'Datele contului: adresa de e-mail, numele/denumirea brandului, setările profilului.',
          'Conținutul încărcat de fotograf: fotografii și informații însoțitoare pentru galerii și site-uri. Aceste date pot conține imagini ale unor persoane terțe (Clienții fotografului).',
          'Date tehnice: jurnale de acces, analize anonimizate ale utilizării (Google Analytics).',
          'Datele de plată sunt prelucrate de furnizorul de servicii de plată (Monobank / LiqPay); noi primim doar statusul plății, nu și datele complete ale cardului.',
        ],
      },
      {
        heading: '2. Roluri: operator și persoană împuternicită',
        paragraphs: [
          'Pentru datele contului fotografului, operatorul este Prestatorul.',
          'Pentru datele cu caracter personal ale Clienților (inclusiv imaginile din fotografii), operatorul este fotograful însuși — el stabilește scopul prelucrării. Prestatorul acționează ca persoană împuternicită (procesator) și prelucrează aceste date exclusiv în numele fotografului și pentru funcționarea Serviciului.',
        ],
      },
      {
        heading: '3. Scopul și temeiurile prelucrării',
        paragraphs: [
          'Furnizarea funcționalităților Serviciului (executarea contractului-ofertă), procesarea plăților, asistența utilizatorilor, asigurarea securității și respectarea cerințelor legale.',
          'Temeiuri juridice: executarea contractului, consimțământul persoanei vizate, interesele legitime ale Prestatorului și îndeplinirea obligațiilor legale.',
        ],
      },
      {
        heading: '4. Transmiterea datelor și subcontractanți',
        paragraphs: [
          'Apelăm la furnizori de infrastructură de încredere: găzduirea aplicației și a bazei de date, stocarea fișierelor în cloud, furnizorul de servicii de plată și serviciul de analiză. Aceștia prelucrează datele doar în măsura necesară pentru prestarea propriilor servicii.',
          'Nu vindem date cu caracter personal unor terți.',
        ],
      },
      {
        heading: '5. Păstrarea datelor',
        paragraphs: [
          'Datele sunt păstrate cât timp există contul sau cât timp o impun scopul prelucrării ori legea. După ștergerea contului, datele sunt șterse sau anonimizate într-un termen rezonabil.',
          'Fișierele sunt păstrate într-un spațiu de stocare în cloud; originalele nu se modifică.',
        ],
      },
      {
        heading: '6. Drepturile dumneavoastră',
        paragraphs: [
          'Aveți dreptul de acces la datele dumneavoastră, de rectificare, de ștergere, de restricționare a prelucrării și de opoziție față de prelucrare, precum și dreptul de a vă retrage consimțământul.',
          `Pentru a vă exercita aceste drepturi, scrieți-ne la ${SUPPORT_EMAIL}. Dacă sunteți Client al unui fotograf, adresați-vă în primul rând fotografului, ca operator al datelor dumneavoastră.`,
        ],
      },
      {
        heading: '7. Fișiere cookie',
        paragraphs: [
          'Folosim cookie-uri necesare pentru autentificare și pentru salvarea setărilor, precum și cookie-uri de analiză pentru a înțelege cum este folosit Serviciul. Puteți gestiona cookie-urile din setările browserului.',
        ],
      },
      {
        heading: '8. Contact',
        paragraphs: [
          `Pentru întrebări privind confidențialitatea: ${SUPPORT_EMAIL}. Operator: ${ENTITY}.`,
        ],
      },
    ],
  },
}
