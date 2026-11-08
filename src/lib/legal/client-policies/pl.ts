import type { ClientPolicyLocale } from '../clientPolicies'

/** Polish client documents (privacy + payment & refund terms) for a photographer's own clients. */
export const pl: ClientPolicyLocale = {
  defaultName: 'Fotograf',
  render: (name, email) => {
    const to = email ? `${email}` : 'adres kontaktowy podany na stronie'
    return {
      privacy: {
        title: 'Polityka prywatności',
        blocks: [
          `Niniejsza informacja wyjaśnia, w jaki sposób ${name} („Fotograf”) zbiera i wykorzystuje dane osobowe Klientów podczas rezerwacji sesji oraz przeglądania galerii online.`,
          '# Jakie dane zbieramy',
          'Imię, dane kontaktowe (telefon, e-mail, media społecznościowe), szczegóły zamówienia oraz same fotografie wykonane podczas sesji. Do obsługi dostępu do galerii może być używane hasło i techniczny identyfikator sesji.',
          '# W jakim celu je wykorzystujemy',
          'Aby wykonać sesję i przekazać fotografie, uzgodnić szczegóły, wystawić rachunek oraz — za zgodą Klienta — pokazać wybrane kadry w portfolio. Nie sprzedajemy danych osobom trzecim.',
          '# Publikacja fotografii',
          'Zdjęcia z sesji nie są publikowane w portfolio ani w mediach społecznościowych bez zgody Klienta. Zgodę można wycofać w dowolnym momencie, kontaktując się z nami.',
          '# Przechowywanie',
          'Galerię i pliki źródłowe przechowujemy przez okres uzgodniony przy zamówieniu, po czym mogą zostać usunięte. Kopie zapasowe przechowujemy nie dłużej, niż jest to technicznie konieczne.',
          '# Prawa Klienta',
          `Klient może poprosić o kopię swoich danych, ich sprostowanie lub usunięcie, a także wycofać zgodę na publikację. W tym celu wystarczy napisać na ${to}.`,
          '# Kontakt',
          `We wszystkich sprawach dotyczących danych osobowych prosimy o kontakt z: ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Warunki płatności i zwrotów',
        blocks: [
          `Niniejsze warunki dotyczą zaliczek, płatności i zwrotów za usługi fotograficzne, które świadczy ${name} („Fotograf”).`,
          '# Rezerwacja i zaliczka',
          'Termin sesji zostaje zarezerwowany dla Klienta po wpłacie zaliczki. Zaliczka potwierdza rezerwację i blokuje czas w kalendarzu Fotografa.',
          '# Odwołanie sesji przez Klienta',
          'W przypadku odwołania sesji wcześniej niż 7 dni przed ustaloną datą zaliczka jest zwracana w całości lub przenoszona na inny termin. Przy późniejszym odwołaniu zaliczka może zostać zatrzymana jako rekompensata za zarezerwowany czas.',
          '# Odwołanie przez Fotografa lub siła wyższa',
          'Jeśli sesja nie może się odbyć z winy Fotografa lub z powodu siły wyższej, Klient wybiera: przeniesienie na inny termin albo pełny zwrot zaliczki.',
          '# Gotowe fotografie',
          'Ponieważ usługa fotograficzna jest wykonywana indywidualnie, opłata za przeprowadzoną sesję i obrobione fotografie nie podlega zwrotowi. Jeśli efekt w istotny sposób odbiega od ustaleń, uzgodnimy poprawki.',
          '# Jak uzyskać zwrot',
          `Aby zgłosić zwrot lub przeniesienie terminu, wystarczy napisać na ${to}. Środki zwracane są tą samą metodą, którą dokonano płatności, w rozsądnym terminie.`,
        ],
      },
    }
  },
}
