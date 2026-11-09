# Do sprawdzenia przez native speakera — polski (pl)

Format: `klucz / miejsce — tłumaczenie — dlaczego niepewne`

- glossary: передоплата → „zaliczka” (wszędzie: site.termsPrepayment, publicSite.termsPrepayment, client-policies refund) — zaliczka, a nie „zadatek” — wielu polskich fotografów mówi „zadatek”, ale zadatek (art. 394 KC) ma inne skutki prawne niż opisane w regulaminie zwrotów; proszę potwierdzić wybór.
- glossary: кредит (referral) → „bonus” (referrals.creditTitle, billing.creditNotice, landing referral) — „bonus” / „bonus za polecenie” — „kredyt” brzmi jak pożyczka; może lepiej „środki z poleceń” lub „saldo”?
- glossary: тариф → „plan”, nazwy „Darmowy / Podstawowy / Plus / Maksymalny” — nazwy planów przetłumaczone (jak w uk), a nie zostawione po angielsku — czy nie lepiej „Free / Basic / Plus / Max” jako nazwy własne?
- site.themeTysha … themeProdakshn — „Tysha”, „Opivnich”, „Povitria”… pozostawione w transliteracji z en — dla Polaka nic nie znaczą; alternatywa: „Cisza”, „Północ”, „Powietrze”, „Klisza”, „Magazyn”, „Galeria”, „Archiwum”, „Produkcja”.
- landing.hero titleBefore/titleAccent/titleAfter — „Wszystko, co dzieje się po kliknięciu migawki” — gra słów z akcentem na „po”; czy brzmi naturalnie jako hasło na hero?
- landing.pricing.titleAccent — „płatność tylko za miejsce” — unikam formy „płacisz”; brzmi nieco sucho.
- landing.final titleBefore + titleAccent — „Niech następna sesja trafi do klienta pięknie” — szyk z akcentem na końcu; może „…trafi do klienta w pięknej formie”?
- landing.bento.titleBefore/titleAccent — „Drobiazgi, dzięki którym praca jest spokojna” — dosłowne „calm”; może „…praca idzie spokojnie”?
- landing.referral.steps[2] — „Co miesiąc wpada 10% bonusu — automatycznie.” — potoczne „wpada”; czy pasuje do tonu?
- landing.faq.items[1].a — „Z pominięciem nas.” — odpowiedź na „Przez kogo przechodzą płatności?”; oryginał „Past us.” — może „Nie przez nas.”?
- referrals.title / landing.referral.title — „Polecaj proiav fotografom — 10% od każdej ich płatności” — tryb rozkazujący w nagłówku (forma „Ty”), traktowany jak CTA; zgodne z zasadą?
- auth.forgotLink — „Zapomniane hasło?” — wybrane zamiast typowego „Nie pamiętasz hasła?” (forma „Ty”); czy brzmi naturalnie?
- publicGallery.selected, pages.demoPicked, designer.picked — „w ulubionych” — w UI stoi „♥ 5 w ulubionych”; obejście braku odmiany liczebnika („wybrane/wybranych”).
- galleryManage.deliveryShot — „Po sesji” — status „Shoot done”; alternatywa „Sesja zrobiona”.
- publicGallery.deliveryEta / deliveryBannerEta — „Planowo do {date}” — zależy od formatu daty (dopełniacz „do 12 listopada”); proszę sprawdzić na żywo.
- dashboard.freePurgeOn — „pliki zostaną usunięte {date}” — bez przyimka przed datą; sprawdzić z formatem daty.
- billing.storage — „miejsca” — łączone w kodzie jako „100 ГБ miejsca” (jednostka może zostać po ukraińsku — to kwestia kodu, nie tłumaczenia).
- booking.monoLabel / monoTokenLabel — „Acquiring Monobank”, „Token acquiringu Monobank” — anglicyzm „acquiring”; czy fotograf go zrozumie, czy lepiej „płatności kartą online”?
- booking.manualLabel — „skarbonka Mono” — tłumaczenie funkcji „банка” Monobank; nazwa w polskim interfejsie Monobank może być inna.
- legal oferta 3 — „operator płatności” (платіжний провайдер) i „pole wyboru” (позначка) — terminologia prawnicza do weryfikacji.
- legal oferta 5 / privacy 2 — „administrator (володілець)”, „podmiot przetwarzający (розпорядник)” — pojęcia z ukraińskiej ustawy oddane terminami bliskimi RODO, z oryginałem w nawiasie; proszę ocenić, czy nie wprowadza to w błąd.
- legal oferta 9 — „płatnik podatku jednolitego, grupa trzecia” — ukraiński „єдиний податок” nie ma polskiego odpowiednika.
- legal privacy 6 heading — „Prawa osób, których dane dotyczą” — w uk „Ваші права”; zmienione na formę bezosobową zgodnie z zasadą adresowania.
- legal reviewNote — sformułowanie zastrzeżenia o wiążącej wersji ukraińskiej — do weryfikacji przez prawnika.
- client-policies refund „# Gotowe fotografie” — „Ponieważ usługa fotograficzna jest wykonywana indywidualnie, opłata … nie podlega zwrotowi” — skrócone „bespoke, performed service”; sprawdzić sens prawny.
- client-policies privacy last block — „prosimy o kontakt z: {name}” — dwukropek, by uniknąć odmiany imienia fotografa; brzmi trochę urzędowo.
- culling.title / start — „Selekcja zdjęć”, „Rozpocznij selekcję” — „culling” jako „selekcja”, odrzuty jako „odrzut”; czy to słownictwo branżowe?
- culling.paused — „Wstrzymano: karta jest ukryta — analiza wznowi się po powrocie” — długość etykiety.
- pages.studioTitleBefore/Accent — „Galeria, którą klienci chcą pokazywać dalej” — luźne oddanie „love to share”.
- designer.fontSans — „Groteska” — termin typograficzny; może zwykłe „Bezszeryfowa”?

## Delta (release/4)

- galleryManage.picksHint — nazwy menu Lightroom Classic (Library → Text → Filename → Contains) zostawione po angielsku — nie mam pewności, czy istnieje polska wersja interfejsu Lightroom Classic i jak brzmią w niej te pozycje.
- galleryManage.favoritesTitle — „Wybór klienta” — „Client picks” (ulubione + retusz); czy nie myli się z funkcją „wybór zdjęć przez klienta”?
- galleryManage.clientEmailTitle / clientEmailSentAt — „Zdjęcia są gotowe” — temat wiadomości w polskiej wersji maila może brzmieć inaczej; warto zsynchronizować z faktycznym szablonem e-maila.
- galleryManage.picksLineLabel — „Linia dla Lightrooma · nazwy: {n}” — „linia” vs „wiersz”.
- landing.hero.status.eta — „Planowo do 14 grudnia” — data na sztywno w makiecie.
- landing.products.features[2].title — „Zerwane połączenie nie oznacza zaczynania od nowa” — dość długi nagłówek.
- landing.bento.cards.languages — „do wyboru jest dziewięć” — brzmienie.
- help upload item 1 — „Brak połączenia” — etykieta, której nie znalazłem w słowniku (prawdopodobnie zaszyta w komponencie przesyłania); trzeba zsynchronizować z rzeczywistym tekstem.
- designer.picksFavorite / picksRetouch — „serduszko”, „retusz” — małe litery, bo trafiają do eksportu CSV/TXT („serduszko + retusz”).

## Delta 3 (redesign panelu)

- publicGallery.shareReady / shareInProgress / shareSubject — wiadomość fotografa do klienta przerobiona na bezosobową („Galeria „{title}” jest gotowa”) zamiast „Twoja galeria”; w prywatnej wiadomości może brzmieć zbyt oficjalnie — może „Pana/Pani galeria”?
- publicGallery.sharePassword — „hasło wyślę w osobnej wiadomości” — pierwsza osoba (fotograf), jak w oryginale.
- dashboard.galleriesCount — „{n} galeria / galerie / galerii” — zmieniono styl z „Galerie: {n}” na odmianę liczebnika; sprawdzić w nagłówku listy.
- galleryManage.accessDownloadsCount — „Dotąd 5 pobrań” — szyk; alternatywa „Pobrania do tej pory: {n}” (bez odmiany).
- galleryManage.tabDesign / hintGoDesign — „Wygląd” / „Dopracuj wygląd” — „Design” jako „Wygląd”; czy zakładka nie powinna nazywać się „Projekt”/„Styl”?
- galleryManage.shareQrHint — „Można go wydrukować na kartce albo otworzyć galerię na telefonie” — dość luźne oddanie oryginału.
- dashboard.onboardStep2 / onboardStep3 — tryb rozkazujący w krokach onboardingu („Prześlij…”, „Udostępnij…”) — traktowane jak przyciski/kroki.

## Листи

- emails hello / helloClient — „Dzień dobry, {name}!” / „Dzień dobry!” — standardowe powitanie w mailu serwisowym; czy nie lepiej „Witamy”?
- emails receipt lead — „Dziękujemy, że jesteście z nami!” — forma „wy” (zbiorowa), jedyne odstępstwo od bezosobowości; alternatywa „Dziękujemy za zaufanie!”.
- emails planNames.site_basic / site_plus — „Strona · Podstawowy”, „Strona · Plus” — w słowniku UI plany stron nazywają się po prostu „Podstawowy”/„Plus”; w mailu potrzebne rozróżnienie od planów galerii.
- emails footerQuestions — „Pytania i rachunki” — oryginał uk „Питання й рахунок для ФОП”.
- emails receipt subject — „Potwierdzenie płatności” zamiast „Paragon/Pokwitowanie” — „paragon” w Polsce ma znaczenie fiskalne.
- emails closed — „Galerie na koncie (5 galerii) są zamknięte” — konstrukcja z nawiasem, by uniknąć uzgadniania liczebnika z orzeczeniem.
- emails freeExpiry subject — „za 7 dni 5 galerii zostanie zamkniętych” — szyk z okolicznikiem na początku.
- emails freeExpiry — cytuje komunikat z galerii „Ta galeria jest już zamknięta. Prosimy o kontakt z fotografem.” dosłownie — kropka przed zamykającym cudzysłowem i po nim.
- emails referralReward — „nagroda za polecenie” (ambasador) vs „bonus za polecenie” — rodzaj żeński/męski w „pierwsza/pierwszy”.
- emails ready.after — „fotograf podał ten adres, aby powiadomić o gotowych zdjęciach” — sformułowanie RODO-podobne, do sprawdzenia.
- emails — „z serwera” zamiast „z magazynu/przestrzeni” dla „зі сховища” — naturalniej, ale mniej dokładnie.
