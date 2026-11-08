import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** Polish translation of the Ukrainian (legally binding) public offer and privacy policy. */
export const pl: LegalCopy = {
  backToHome: '← Strona główna',
  reviewNote:
    'To tłumaczenie zostało przygotowane wyłącznie dla wygody. Wiążąca prawnie jest wersja ukraińska; w razie jakichkolwiek rozbieżności pierwszeństwo ma tekst ukraiński. Tłumaczenie nie tworzy żadnych zobowiązań wykraczających poza wersję ukraińską.',
  oferta: {
    title: 'Oferta publiczna',
    updated: `Wersja z dnia ${UPDATED}`,
    intro:
      `Niniejszy dokument stanowi oficjalną publiczną propozycję (ofertę) ${ENTITY} (dalej — „Wykonawca”) zawarcia umowy o udostępnienie serwisu internetowego „проЯв” (dalej — „Serwis”) na warunkach określonych poniżej. Rejestrując się w Serwisie lub dokonując płatności, osoba korzystająca z Serwisu (dalej — „Użytkownik”) w pełni i bezwarunkowo akceptuje warunki niniejszej oferty.`,
    sections: [
      {
        heading: '1. Definicje',
        paragraphs: [
          '„Serwis” — internetowy produkt programowy „проЯв” (proiav.space), udostępniający fotografom narzędzia do prowadzenia galerii online dla klientów, osobistych stron internetowych oraz przyjmowania rezerwacji.',
          '„Użytkownik” — fotograf lub inna osoba, która zarejestrowała konto w Serwisie.',
          '„Klient Użytkownika” — osoba trzecia, której Użytkownik udostępnia galerię lub formularz rezerwacji.',
          '„Plan” — zestaw funkcji i ilość miejsca na dane udostępniane odpłatnie zgodnie ze stroną z cennikiem.',
        ],
      },
      {
        heading: '2. Przedmiot umowy',
        paragraphs: [
          'Wykonawca zapewnia Użytkownikowi dostęp do funkcji Serwisu na warunkach wybranego Planu, a Użytkownik zobowiązuje się opłacać taki dostęp (z wyjątkiem planu bezpłatnego) oraz przestrzegać warunków niniejszej oferty.',
          'Serwis jest udostępniany w stanie „takim, jaki jest”. Wykonawca rozwija Serwis i może zmieniać zakres funkcji, z wyprzedzeniem informując o istotnych zmianach.',
        ],
      },
      {
        heading: '3. Plany i płatności',
        paragraphs: [
          'Aktualne ceny podane są na stronie z cennikiem w hrywnach (₴). Płatności dokonuje się kartą ukraińskiego banku za pośrednictwem operatora płatności (Monobank / LiqPay); Wykonawca nie przechowuje pełnych danych karty płatniczej.',
          'Subskrypcja obowiązuje przez opłacony okres (miesiąc lub rok) i — jeśli włączone jest automatyczne odnawianie — odnawia się automatycznie, dopóki Użytkownik jej nie anuluje.',
          'Automatyczne odnawianie włącza się polem wyboru „Automatyczne odnawianie” obok przycisku płatności na stronie z cennikiem; obok podana jest kwota i częstotliwość obciążeń. Jeśli pole pozostaje zaznaczone, operator płatności (Monobank) przechowuje token karty i w każdym kolejnym okresie automatycznie pobiera z niej tę samą kwotę za wybrany Plan (pomniejszoną o bonus z programu poleceń, jeśli taki przysługuje). Jeśli zaznaczenie zostanie usunięte, karta nie jest zapisywana, a Plan obowiązuje wyłącznie przez opłacony okres.',
          'Na 3 dni przed każdym automatycznym obciążeniem Serwis wysyła na adres e-mail Użytkownika wiadomość z kwotą, datą obciążenia i linkiem do anulowania. Automatyczne odnawianie można anulować w dowolnym momencie w panelu (sekcja „Plan”) — karta nie jest wtedy więcej obciążana, a zapisany token zostaje usunięty.',
          'Płatność przez Google Pay lub Apple Pay nie zapisuje karty, dlatego przy takiej płatności automatyczne odnawianie jest niedostępne: Plan obowiązuje przez opłacony okres.',
          'Płatność roczna odpowiada cenie dziesięciu miesięcy (dwa miesiące gratis).',
        ],
      },
      {
        heading: '4. Zwrot środków',
        paragraphs: [
          'Ponieważ dostęp do cyfrowego Serwisu jest zapewniany natychmiast, opłacony okres nie podlega zwrotowi, z wyjątkiem przypadków wyraźnie przewidzianych w przepisach prawa Ukrainy o ochronie praw konsumentów.',
          'Automatyczne odnawianie można anulować w dowolnym momencie w panelu; po anulowaniu Plan obowiązuje do końca opłaconego okresu, a następnie przez kolejne 14 dni zachowany jest pełny dostęp w ramach limitu Planu.',
          'Jeśli po upływie tych 14 dni pliki Użytkownika przekraczają limit planu bezpłatnego (3 GB), galerie zostają zamknięte dla Klientów Użytkownika, a pliki są przechowywane jeszcze przez 60 dni, po czym zostają usunięte z magazynu danych bez możliwości odzyskania. Przez te 60 dni Użytkownik ma pełny dostęp do plików w panelu, może je pobrać lub odnowić Plan — wówczas galerie zostają ponownie otwarte pod tymi samymi linkami. O każdym etapie Serwis uprzedza wiadomością e-mail (w tym na 30, 7 i 1 dzień przed usunięciem). Plan bezpłatny w granicach swojego limitu nie ma ograniczenia okresu przechowywania.',
          'Bezpłatny miesiąc planu „Podstawowy” za import galerii (promocja) przysługuje jednorazowo na konto; po jego zakończeniu obowiązują te same zasady, co po upływie opłaconego okresu.',
        ],
      },
      {
        heading: '5. Prawa i obowiązki Użytkownika',
        paragraphs: [
          'Użytkownik gwarantuje, że posiada wszelkie prawa do przesyłanych treści (fotografii itp.) i ponosi odpowiedzialność za ich zgodność z prawem, w tym za posiadanie zgody osób przedstawionych na zdjęciach na przetwarzanie i rozpowszechnianie ich wizerunku.',
          'Użytkownik samodzielnie określa cel i zakres przetwarzania danych osobowych swoich Klientów i jest administratorem (володілець) tych danych; Wykonawca przetwarza je wyłącznie na zlecenie Użytkownika (zob. Politykę prywatności).',
          'Zabrania się korzystania z Serwisu w odniesieniu do treści niezgodnych z prawem, służących oszustwu lub naruszających prawa osób trzecich.',
        ],
      },
      {
        heading: '6. Odpowiedzialność',
        paragraphs: [
          'Wykonawca dokłada starań, aby Serwis działał nieprzerwanie, ale nie gwarantuje braku awarii technicznych i nie odpowiada za straty spowodowane siłą wyższą lub działaniami osób trzecich (dostawców hostingu, usług płatniczych, łączności).',
          'Wykonawca nie jest stroną stosunków między Użytkownikiem a jego Klientami i nie odpowiada za treść galerii, stron ani za ustalenia dotyczące sesji zdjęciowych.',
        ],
      },
      {
        heading: '7. Dane osobowe',
        paragraphs: [
          'Dane osobowe przetwarzane są zgodnie z ustawą Ukrainy „O ochronie danych osobowych” oraz Polityką prywatności, która stanowi integralną część niniejszej oferty.',
        ],
      },
      {
        heading: '8. Okres obowiązywania i zmiany',
        paragraphs: [
          'Oferta obowiązuje bezterminowo od chwili jej opublikowania. Wykonawca ma prawo zmieniać jej warunki, publikując nową wersję na tej stronie; dalsze korzystanie z Serwisu oznacza zgodę na nową wersję.',
        ],
      },
      {
        heading: '9. Dane Wykonawcy',
        paragraphs: [
          `Nazwa: ${ENTITY}`,
          `Forma opodatkowania: płatnik podatku jednolitego, grupa trzecia`,
          `Data rejestracji państwowej: 04.09.2023`,
          `Siedziba: Ukraina, Tarnopol (pełny adres — na żądanie)`,
          `E-mail: ${SUPPORT_EMAIL}`,
          `Pełne dane (numer identyfikacji podatkowej РНОКПП, rachunek bankowy) podawane są w rachunku oraz na żądanie.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Polityka prywatności',
    updated: `Wersja z dnia ${UPDATED}`,
    intro:
      `Niniejsza Polityka wyjaśnia, jakie dane osobowe przetwarza serwis „проЯв” (${ENTITY}), w jakim celu i na jakiej podstawie. Korzystanie z Serwisu oznacza zgodę na niniejszą Politykę.`,
    sections: [
      {
        heading: '1. Jakie dane przetwarzamy',
        paragraphs: [
          'Dane konta: adres e-mail, imię / nazwa marki, ustawienia profilu.',
          'Treści przesyłane przez fotografa: fotografie i towarzyszące im informacje do galerii i stron. Dane te mogą zawierać wizerunki osób trzecich (Klientów fotografa).',
          'Dane techniczne: dzienniki dostępu, zanonimizowana analityka korzystania (Google Analytics).',
          'Dane płatnicze przetwarza operator płatności (Monobank / LiqPay); otrzymujemy wyłącznie status płatności, a nie pełne dane karty.',
        ],
      },
      {
        heading: '2. Role: administrator i podmiot przetwarzający',
        paragraphs: [
          'W odniesieniu do danych konta fotografa administratorem (володілець) jest Wykonawca.',
          'W odniesieniu do danych osobowych Klientów (w tym wizerunków na zdjęciach) administratorem jest sam fotograf — to on określa cel przetwarzania. Wykonawca działa jako podmiot przetwarzający (розпорядник) i przetwarza te dane wyłącznie na zlecenie fotografa i na potrzeby działania Serwisu.',
        ],
      },
      {
        heading: '3. Cel i podstawy przetwarzania',
        paragraphs: [
          'Udostępnianie funkcji Serwisu (wykonanie umowy-oferty), obsługa płatności, wsparcie użytkowników, zapewnienie bezpieczeństwa i wypełnianie wymogów prawa.',
          'Podstawy prawne: wykonanie umowy, zgoda osoby, której dane dotyczą, prawnie uzasadnione interesy Wykonawcy oraz wypełnianie obowiązków prawnych.',
        ],
      },
      {
        heading: '4. Przekazywanie danych i podwykonawcy',
        paragraphs: [
          'Korzystamy z usług zaufanych dostawców infrastruktury: hostingu aplikacji i bazy danych, chmurowego magazynu plików, operatora płatności i usługi analitycznej. Przetwarzają oni dane wyłącznie w zakresie niezbędnym do świadczenia swoich usług.',
          'Nie sprzedajemy danych osobowych osobom trzecim.',
        ],
      },
      {
        heading: '5. Przechowywanie',
        paragraphs: [
          'Dane są przechowywane, dopóki istnieje konto lub dopóki wymaga tego cel przetwarzania albo prawo. Po usunięciu konta dane są usuwane lub anonimizowane w rozsądnym terminie.',
          'Pliki są przechowywane w chmurowym magazynie danych; oryginały nie są modyfikowane.',
        ],
      },
      {
        heading: '6. Prawa osób, których dane dotyczą',
        paragraphs: [
          'Każdej osobie przysługuje prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i wniesienia sprzeciwu wobec przetwarzania, a także prawo do wycofania zgody.',
          `Aby skorzystać z tych praw, należy napisać na adres ${SUPPORT_EMAIL}. Klienci fotografa powinni w pierwszej kolejności zwracać się do samego fotografa jako administratora swoich danych.`,
        ],
      },
      {
        heading: '7. Pliki cookie',
        paragraphs: [
          'Używamy niezbędnych plików cookie do obsługi logowania i zapamiętywania ustawień oraz analitycznych plików cookie, aby rozumieć, jak korzysta się z Serwisu. Pliki cookie można kontrolować w ustawieniach przeglądarki.',
        ],
      },
      {
        heading: '8. Kontakt',
        paragraphs: [
          `W sprawach prywatności: ${SUPPORT_EMAIL}. Administrator danych: ${ENTITY}.`,
        ],
      },
    ],
  },
}
