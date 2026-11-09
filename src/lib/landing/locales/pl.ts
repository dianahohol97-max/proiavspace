import type { LandingCopy } from '../copy'

/** Polish marketing landing (translated from the `en` object of ../copy). */
export const pl: LandingCopy = {
  nav: {
    features: 'Możliwości',
    galleries: 'Galerie',
    pricing: 'Cennik',
    themes: 'Motywy',
    blog: 'Blog',
    signIn: 'Zaloguj się',
    ctaShort: 'Zacznij za darmo',
    dashboard: 'Panel',
  },
  hero: {
    chips: ['Śluby', 'Rodziny', 'Portrety', 'Studia'],
    titleBefore: 'Wszystko, co dzieje się ',
    titleAccent: 'po',
    titleAfter: ' kliknięciu migawki',
    subtitle: 'Galeria online dla fotografa: zdjęcia z sesji trafiają do klienta jednym pięknym linkiem.',
    lede:
      'Galerie, w których klient od razu wie, jak odebrać zdjęcia — bez Dysku Google i pytań „a jak to pobrać?”. Ulubione zaznaczane serduszkiem, hasło i data ważności, oryginały bez kompresji. Wszędzie tylko marka fotografa.',
    cta: 'Zacznij za darmo',
    ctaNote: '3 GB za darmo, każda galeria otwarta przez 30 dni. Bez karty.',
    statNumber: '30 000',
    statText: 'zdjęć przekazanych klientom przez galerie proiav',
    status: { steps: ['Sesja', 'Obróbka', 'Gotowe'], now: 'teraz', eta: 'Planowo do 14 grudnia' },
    galleryTitles: ['Ślubne historie', 'Rodzinne historie', 'Portrety', 'Sesje studyjne'],
  },
  strip: { label: 'Prace fotografów' },
  products: {
    label: 'Galerie · selekcja · status sesji',
    titleBefore: 'Galeria dla klientów fotografa — ',
    titleAccent: 'pod własną marką',
    lede:
      'Wszystko zaczyna się od galerii — to tam fotograf co tydzień spotyka się z klientami. Nowości w galeriach: selekcja odrzutów, status sesji dla klienta i przesyłanie, które nie boi się zerwanego połączenia. Poniżej prawdziwe ekrany.',
    gallery: {
      no: '01 — Galerie',
      title: 'Piękne przekazanie zdjęć',
      text: 'Wystarczy przesłać zdjęcia — klient dostaje piękny link i sam pobiera pliki, bez Dysku Google i pytań „a jak to pobrać?”. Ulubione, hasło, data ważności, archiwum ZIP, statystyki.',
      tagStrong: 'Oryginały bez kompresji.',
      tagRest: ' Pliki dokładnie takie, jak z aparatu',
    },
    features: [
      {
        no: '02 — Selekcja AI',
        title: 'Odrzuty są oznaczone, decyzja należy do fotografa',
        text: 'Nieostre kadry, powtórzenia w seriach i zamknięte oczy oznaczają się automatycznie, a najlepszy kadr z serii widać obok pozostałych. Analiza działa w przeglądarce — zdjęcia nigdzie nie są wysyłane.',
        tagStrong: 'Nic nie znika samo.',
        tagRest: ' Zdjęcie zostaje ukryte przed klientem dopiero po potwierdzeniu',
        alt: 'Panel „Selekcja zdjęć”: oznaczenia „Powtórzenie” i „Nieostre” na zdjęciach oraz filtr „Możliwe odrzuty”',
      },
      {
        no: '03 — Status sesji',
        title: 'Klient widzi, na jakim etapie są zdjęcia',
        text: 'Dopóki galeria jest pusta, pod tym samym linkiem klient widzi „Sesja → Obróbka → Gotowe” i przewidywaną datę, jeśli została ustawiona. Gdy zdjęcia są już na miejscu, galeria otwiera się właśnie tam.',
        tagStrong: 'Jeden przełącznik w panelu.',
        tagRest: ' Klient od razu widzi zmiany',
        alt: 'Ekran statusu dla klienta: „Zdjęcia są już w przygotowaniu”, etap „Obróbka” i przewidywana data',
      },
      {
        no: '04 — Niezawodne przesyłanie',
        title: 'Zerwane połączenie nie oznacza zaczynania od nowa',
        text: 'Duże pliki wysyłane są w częściach po 8 MB. Gdy sieć zniknie, przesyłanie czeka i samo rusza dalej. Gdy karta zostanie zamknięta, wystarczy wybrać te same pliki — przesyłanie wznowi się tam, gdzie się zatrzymało.',
        tagStrong: 'Powtarzana jest tylko niedokończona część,',
        tagRest: ' a nie cały plik',
        alt: 'Przesyłanie do galerii bez internetu: zdjęcia już przesłane, filmy czekają na połączenie',
      },
    ],
  },
  bento: {
    label: 'Wszystko w jednym panelu',
    titleBefore: 'Drobiazgi, dzięki którym praca jest ',
    titleAccent: 'spokojna',
    cards: {
      selection: {
        label: 'Wybór',
        text: 'Klient zaznacza serduszkiem kadry do retuszu — listę plików eksportuje się jednym kliknięciem',
      },
      galleryPhoto: 'Galeria',
      protection: { label: 'Ochrona', text: 'Hasło i data ważności dla każdej galerii' },
      archive: { label: 'Archiwum', text: 'Wszystko jednym przyciskiem — ZIP powstaje bez kolejek i czekania' },
      watermark: { label: 'Znak wodny', text: 'Nazwa fotografa na podglądach. Oryginały pozostają czyste' },
      stats: { label: 'Statystyki', number: '247', text: 'wyświetleń galerii w tym tygodniu' },
      themes: {
        label: 'Wygląd galerii',
        text: 'Trzy nastroje, pięć układów',
        chips: ['Mozaika', 'Kolaż', 'Editorial', 'Kwadraty', 'Portret 3:4'],
      },
      previewPhoto: 'Podglądy bez utraty szybkości',
      slideshow: { label: 'Przeglądanie', text: 'Pełnoekranowa przeglądarka i pokaz slajdów — także na telefonie' },
      video: {
        label: 'Wideo',
        text: 'Filmy obok zdjęć w tej samej galerii — od planu Podstawowego',
      },
      languages: { label: 'Języki', text: 'Klienci przełączają galerię na swój język — do wyboru jest dziewięć' },
    },
  },
  principles: {
    huge: 'Zasady',
    title: 'Jak platforma działa od środka',
    lede: 'To nie lista funkcji — to decyzje, do których nie wracamy.',
    items: [
      {
        title: 'Marka fotografa na pierwszym planie',
        text: 'Od pierwszego płatnego planu galerie w ogóle o nas nie wspominają. Klient widzi tylko fotografa.',
      },
      {
        title: 'Decyduje fotograf',
        text: 'Automatyka tylko podpowiada. Żadne zdjęcie nie zostanie ukryte przed klientem bez potwierdzenia fotografa.',
      },
      {
        title: 'Oryginały są nietykalne',
        text: 'Pliki są przechowywane bajt w bajt. Klient przegląda szybkie podglądy, a pobiera pełną jakość.',
      },
      {
        title: 'Zdjęcia nie są nigdzie wysyłane do analizy',
        text: 'Selekcja działa w przeglądarce. Zdjęcia nie trafiają do zewnętrznych serwisów — nawet model twarzy ładuje się z naszego własnego serwera.',
      },
    ],
  },
  pricing: {
    label: 'Cennik',
    titleBefore: 'Cennik galerii online: ',
    titleAccent: 'płatność tylko za miejsce',
    lede:
      'Wybór zdjęć przez klienta jest bezpłatny dla wszystkich. Płatne plany usuwają nasz branding i dodają wideo oraz więcej miejsca, a od planu Plus — statystyki.',
    perMonth: '/ miesiąc',
    freeLabel: 'bez karty',
    yearHint: (year) => `lub ${year} ₴ rocznie — dwa miesiące gratis`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB miejsca` : `${gb} GB miejsca`),
    popular: 'Polecamy',
    fineprint:
      'Płatność kartą dowolnego ukraińskiego banku. Rezygnacja w każdej chwili — przez kolejne 14 dni wszystko działa bez zmian. Potem, jeśli darmowe 3 GB są przekroczone, galerie zamykają się dla klientów, a pliki są przechowywane jeszcze przez 60 dni.',
    plans: {
      free: {
        name: 'Darmowy',
        note: 'Każda galeria otwarta przez 30 dni — na start',
        bullets: ['Wybór zdjęć przez klienta', 'Galerie z hasłem i datą ważności', 'Bez limitu liczby galerii'],
      },
      basic: {
        name: 'Podstawowy',
        note: 'Marka fotografa — i tylko ona',
        bullets: ['Bez naszego brandingu', 'Własne logo w galeriach', 'Wideo w galeriach'],
      },
      plus: {
        name: 'Plus',
        note: 'Na pełny sezon pracy',
        bullets: ['Wszystko z planu Podstawowego', 'Statystyki wyświetleń', 'Napiwki od klientów'],
      },
      pro: {
        name: 'Maksymalny',
        note: 'Duże archiwa i intensywny sezon',
        bullets: ['Wszystko z planu Plus', 'Priorytetowe wsparcie', '1 TB miejsca'],
      },
    },
    planCta: 'Wybieram',
  },
  referral: {
    label: 'Program poleceń',
    title: 'Polecaj proiav znajomym fotografom — 10% od każdej ich płatności',
    lede: 'Wystarczy przesłać link komuś z branży. Gdy ta osoba wybierze płatny plan, od każdej jej płatności naliczane jest 10% bonusu — co miesiąc. Bonus automatycznie obniża kolejny rachunek.',
    steps: [
      'Link polecający czeka w panelu.',
      'Znajomy fotograf rejestruje się przez ten link i wybiera płatny plan.',
      'Co miesiąc wpada 10% bonusu — automatycznie.',
    ],
    cta: 'Odbierz link',
  },
  faq: {
    label: 'Najczęstsze pytania',
    title: 'Najważniejsze w skrócie',
    items: [
      {
        q: 'Czy klienci widzą, że galeria powstała w proiav?',
        a: 'W planie Darmowym na dole galerii widnieje mały podpis „Stworzono w proiav”. Od planu Podstawowego go nie ma: na stronach jest tylko nazwa fotografa, jego logo i jego zdjęcia.',
      },
      {
        q: 'Czy selekcja AI może sama ukryć lub usunąć zdjęcia?',
        a: 'Nie. Tylko oznacza prawdopodobne odrzuty: nieostre kadry, powtórzenia w serii, zamknięte oczy. Przed klientem ukryte zostaje wyłącznie to, co fotograf potwierdzi i ukryje przyciskiem — pliki nie są usuwane, a każde zdjęcie można przywrócić.',
      },
      {
        q: 'Co widzi klient, gdy zdjęcia są w obróbce?',
        a: 'Jeśli ustawiony jest status sesji, pod linkiem do galerii klient widzi „Sesja → Obróbka → Gotowe” i przewidywaną datę, jeśli została podana. Po dodaniu zdjęć galeria otwiera się właśnie tam.',
      },
      {
        q: 'Co się stanie z plikami po rezygnacji z subskrypcji?',
        a: 'Przez 14 dni wszystko działa jak dotąd. Jeśli pliki mieszczą się w darmowych 3 GB, konto po prostu przechodzi na plan Darmowy. Jeśli nie — galerie zamykają się dla klientów, a pliki są przechowywane jeszcze przez 60 dni: wszystko nadal widać w panelu, można je pobrać albo odnowić plan. Przed usunięciem wysyłamy e-mail na 30, 7 i 1 dzień wcześniej.',
      },
      {
        q: 'Czy zdjęcia są kompresowane?',
        a: 'Oryginały są przechowywane bajt w bajt, dokładnie tak, jak zostały przesłane. Do szybkiego przeglądania klient widzi wygenerowane podglądy, ale przycisk pobierania zawsze oddaje oryginał.',
      },
    ],
  },
  final: {
    label: 'Na początek — jedna galeria',
    titleBefore: 'Niech następna sesja trafi do klienta ',
    titleAccent: 'pięknie',
    cta: 'Załóż darmowe konto',
  },
  footer: {
    tagline: 'Galerie online dla fotografów z Ukrainy',
    blog: 'Blog',
    terms: 'Oferta publiczna',
    privacy: 'Polityka prywatności',
    support: 'Pomoc',
  },
}
