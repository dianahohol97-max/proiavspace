# Глосарій перекладів проЯв

Єдині терміни для 7 мов (pl, de, es, fr, it, ro, pt). Джерело — uk/en словники. Додаючи рядок, беріть терміни звідси; зміна терміна — у всіх рядках мови одразу.

Фрази, у яких перекладач не впевнений і які варто показати носію мови, — у `docs/i18n/review/<мова>.md`.

Загальні правила: плейсхолдери `{n}`, `{date}` і HTML не чіпати; множина — `{n, plural, one {…} few {…} many {…} other {…}}` (Intl.PluralRules, `src/lib/i18n/format.ts`); юридичні тексти — переклад із поміткою, що чинна українська редакція.


## Polski — `pl`

**Forma zwracania się.** Neutralnie i bezosobowo, wszędzie tak samo (panel, strony klienta, dokumenty prawne):
etykiety rzeczownikowe („Imię”, „Telefon”, „Data sesji”), przyciski w standardowym trybie rozkazującym UI („Zapisz”, „Wybierz”, „Pobierz”),
w tekstach ciągłych konstrukcje bezosobowe („można”, „należy”, „Galeria jest gotowa”, „Prosimy spróbować ponownie”).
Bez form „Ty/Twój” w tekście ciągłym; „Pan/Pani” tylko wyjątkowo (praktycznie nieużywane). W dokumentach prawnych: „Użytkownik”, „Klient”, „Fotograf” (wielką literą jako terminy zdefiniowane).

**Ton.** Spokojny, ciepły, pewny siebie, rzeczowy. Krótkie etykiety. Bez anglicyzmów, gdy istnieje naturalne polskie słowo (wyjątki: portfolio, link, webhook, e-mail, ZIP).

**Liczby, daty, waluta.** Separator tysięcy — spacja nierozdzielająca w zapisie (30 000), część dziesiętna po przecinku. Daty: DD.MM.RRRR. Waluta bez przeliczania: „₴” lub „UAH” jak w źródle („12 000 UAH”, „200 ₴”), w tekście „hrywna”. Jednostki: GB, MB, TB, min, s. Cudzysłowy: „…” (zagnieżdżone: »…« lub ‚…’).
Liczebniki z rzeczownikiem — składnia ICU: `{n, plural, one {# zdjęcie} few {# zdjęcia} many {# zdjęć} other {# zdjęcia}}`.

| Українська | English | Polish | Note |
|---|---|---|---|
| галерея | gallery | galeria | „galeria online”, „galeria dla klienta” |
| клієнтська галерея | client gallery | galeria dla klienta | |
| обране / улюблені | favourites | ulubione | „Dodaj do ulubionych”, „w ulubionych klienta” |
| відбір фото клієнтом | client photo selection | wybór zdjęć przez klienta | nie mylić z selekcją (culling) |
| вибір на ретуш | retouch selection | wybór do retuszu | |
| ретуш | retouching | retusz | |
| пакет | package | pakiet | tylko oferta fotografa (pakiet sesji) |
| тариф | plan | plan | plan subskrypcji proiav; nie „taryfa” |
| Безкоштовний / Базовий / Плюс / Максимальний | Free / Basic / Plus / Maximum | Darmowy / Podstawowy / Plus / Maksymalny | nazwy planów; w tekście „plan Podstawowy” |
| Пробний (сайт) | Trial | Próbny | |
| передоплата / завдаток / аванс | deposit | zaliczka | celowo nie „zadatek” (art. 394 KC — inne skutki prawne) |
| бронювання | booking | rezerwacja | |
| забронювати | to book | zarezerwować | |
| слот / час | slot | termin | „wolny termin”, „zajęty termin” |
| автопродовження | auto-renewal | automatyczne odnawianie | etykieta przełącznika: „Automatyczne odnawianie” |
| автоплатіж | auto-payment | płatność automatyczna | |
| кабінет | dashboard | panel | „w panelu” |
| сховище | storage | miejsce na dysku / przestrzeń | „3 GB miejsca”, „Wykorzystane miejsce” |
| посилання | link | link | |
| обкладинка | cover | okładka | „Ustaw jako okładkę” |
| водяний знак | watermark | znak wodny | |
| оригінал | original | oryginał | „oryginały bez kompresji” |
| превʼю | preview | podgląd | l.mn. „podglądy” |
| архів (zip) | archive / zip | archiwum ZIP | |
| відбір кадрів (AI) | culling | selekcja zdjęć | funkcja w panelu |
| брак | reject | odrzut | „możliwy odrzut”, „odrzut potwierdzony” |
| серія | burst | seria | „najlepsze w serii” |
| позначка | flag | oznaczenie | |
| статус зйомки | shoot status | status sesji | |
| зйомка | shoot | sesja | „sesja zdjęciowa”; dla wesel też „sesja” |
| зняти / кадр | frame | kadr | |
| портфоліо | portfolio | portfolio | nieodmienne |
| сайт | site | strona | „strona fotografa”, „Moja strona” |
| сторінка бронювання | booking page | strona rezerwacji | |
| заявка | lead / request | zapytanie | „Wyślij zapytanie”, „zapytania ze strony” |
| клієнт | client | klient | |
| фотограф | photographer | fotograf | |
| кредит (реферальний) | referral credit | bonus | „bonus za polecenie”; nie „kredyt” (kojarzy się z pożyczką) |
| реферальна програма | referral program | program poleceń | |
| реферал | referral | polecony fotograf / polecenie | |
| амбасадор | ambassador | ambasador | |
| виведення коштів | withdrawal | wypłata | |
| оферта | public offer | oferta publiczna | dokument prawny (regulamin) |
| політика конфіденційності | privacy policy | polityka prywatności | |
| умови оплати та повернення | payment & refund terms | warunki płatności i zwrotów | |
| тема (сайту) | theme | motyw | nazwy motywów zostają (Tysha, Opivnich…) |
| розкладка | layout | układ | |
| еквайринг | acquiring | acquiring (płatności kartą) | „acquiring Monobank” |
| банка (Monobank) | jar | skarbonka | funkcja Monobank „банка” |
| реквізити | requisites / card details | dane do przelewu | |
| рахунок | invoice | rachunek / płatność | nie „faktura” (znaczenie podatkowe) |
| чайові | tips | napiwki | |
| промо | promo | promocja | |
| імпорт | import | import | |
| чернетка | draft | szkic | |
| опублікувати | publish | opublikować | |
| термін дії | expiry | data ważności / ważna do | |
| пароль | password | hasło | |
| завантажити (на сервер) | upload | przesłać | |
| завантажити (собі) | download | pobrać | |
| статистика | stats | statystyki | |
| вебхук | webhook | webhook | |
| володілець / розпорядник даних | controller / processor | administrator / podmiot przetwarzający | terminologia RODO-podobna, ale z odwołaniem do prawa Ukrainy |
| Виконавець | Provider | Wykonawca | termin zdefiniowany w ofercie |
| Користувач | User | Użytkownik | termin zdefiniowany |
| подарунковий сертифікат | gift certificate | bon podarunkowy | |
| фотокнига | photo book | fotoksiążka | |
| відгуки | testimonials | opinie | na stronie: „Miłe słowa” |


## Deutsch — `de`

**Anrede:** durchgehend „Sie“ (förmlich), großgeschrieben: Sie / Ihr / Ihnen — im Dashboard, auf Kundenseiten und in den Rechtstexten.
**Ton:** freundlich, ruhig, selbstbewusst; kurz und klar. UI-Beschriftungen möglichst knapp (Infinitiv oder Substantiv: „Speichern“, „Link kopieren“).
**Personen:** generisches Maskulinum („der Fotograf“, „Kunden“), wo eine neutrale Formulierung nicht natürlich klingt; wo möglich neutral („Ihre Kunden“, „Ihr Shooting“).
**Zahlen:** Tausenderpunkt und Dezimalkomma: „30.000“, „2.500 ₴“, „1,5 GB“. Prozent mit Leerzeichen-freiem „10 %“ ist DIN-korrekt, im UI wird „10 %“ verwendet. Einheiten: GB, TB, MB, Min., Std.
**Datum:** TT.MM.JJJJ (kommt formatiert aus `{date}`). „bis {date}“, „voraussichtlich bis {date}“.
**Währung:** ukrainische Hrywnja, nicht umrechnen: „₴“ bzw. „UAH“ wie im Original; „UAH/Monat“.
**Anführungszeichen:** „…“ für UI-Beschriftungen und Namen; Gedankenstrich „ — “ wie im Original.
**Marke:** „проЯв“ bleibt kyrillisch, wo das Original es so schreibt; sonst „proiav“.

| Українська | English | German | Note |
|---|---|---|---|
| галерея | gallery | Galerie | Kundengalerie / Online-Galerie |
| клієнтська галерея | client gallery | Kundengalerie | |
| обране / улюблені | favourites | Favoriten | „zu den Favoriten“ |
| позначити сердечком | to heart | mit einem Herz markieren | |
| вибір на ретуш | retouch selection | Auswahl für die Retusche | |
| відбір фото клієнтом | client photo selection | Bildauswahl durch Kunden | |
| ретуш | retouching | Retusche | |
| обробка (стадія) | editing | Bearbeitung | Status der Lieferung |
| зйомка | shoot | Shooting | n., „das Shooting“ |
| передати зйомку | deliver a shoot | ein Shooting übergeben | |
| пакет | package | Paket | Preispaket auf der Website |
| передоплата / завдаток | deposit | Anzahlung | |
| бронювання | booking | Buchung | Seite: „Buchungsseite“ |
| бронь | booking/hold | Buchung / Reservierung | |
| слот / час | slot | Termin | im UI immer „Termin“ |
| тариф | plan | Tarif | „Tarif wählen“ |
| Безкоштовний / Базовий / Плюс / Максимальний | Free / Basic / Plus / Maximum | Kostenlos / Basis / Plus / Maximum | Tarifnamen, in „…“ zitiert |
| Пробний (сайт) | Trial | Test | Website-Tarif |
| автопродовження | auto-renewal | automatische Verlängerung | Kurzform im UI: „Auto-Verlängerung“ |
| автоплатіж | auto-payment | automatische Zahlung | |
| підписка | subscription | Abo / Abonnement | Rechtstext: Abonnement |
| списання | charge | Abbuchung | |
| кабінет | dashboard | Dashboard | |
| сховище | storage | Speicher / Speicherplatz | |
| посилання | link | Link | |
| обкладинка | cover | Titelbild | |
| водяний знак | watermark | Wasserzeichen | |
| оригінал | original | Original | „Originale ohne Komprimierung“ |
| превʼю | preview | Vorschau | Plural: Vorschaubilder |
| архів (zip) | zip archive | ZIP-Archiv / ZIP-Datei | |
| відбір кадрів (AI) | culling | Bildsichtung | Verb: „Bilder sichten“ |
| брак | reject | Ausschuss | |
| позначка | flag | Markierung | |
| серія | burst | Serie | |
| різкість | sharpness | Schärfe | |
| статус зйомки | shoot status | Shooting-Status | |
| статус для клієнта | status for the client | Status für Kunden | |
| портфоліо | portfolio | Portfolio | |
| сайт | site | Website | |
| тема (сайту) | theme | Theme | Namen (Tysha, Opivnich …) bleiben transliteriert |
| дизайн галереї | gallery design | Galeriedesign | |
| заявка | lead / request | Anfrage | |
| клієнт | client | Kunde / Kunden | |
| фотограф | photographer | Fotograf | |
| реферальна програма | referral program | Empfehlungsprogramm | |
| реферал | referral | geworbene Person / Empfehlung | |
| кредит (реферальний) | referral credit | Guthaben | |
| виведення коштів | withdrawal | Auszahlung | |
| амбасадор | ambassador | Botschafter | |
| еквайринг | acquiring / merchant | Händlerkonto (Acquiring) | |
| банка (Monobank) | jar | Monobank-Sammeldose („Banka“) | |
| реквізити | requisites / card details | Bankdaten / Zahlungsdaten | |
| чайові | tips | Trinkgeld | |
| брендинг | branding | Branding | |
| пароль | password | Passwort | |
| термін дії | expiry | Ablaufdatum | |
| опублікувати | publish | veröffentlichen | |
| чернетка | draft | Entwurf | |
| імпорт | import | Import | |
| оферта | public offer | Öffentliches Angebot | Untertitel: Nutzungsbedingungen |
| політика конфіденційності | privacy policy | Datenschutzerklärung | |
| умови оплати та повернення | payment & refund terms | Zahlungs- und Rückerstattungsbedingungen | |
| Виконавець | Provider | Anbieter | Rechtstext |
| Користувач | User | Nutzer | Rechtstext |
| володілець / розпорядник даних | controller / processor | Verantwortlicher / Auftragsverarbeiter | |
| ФОП | sole proprietor | (ENTITY bleibt unübersetzt) | |
| тема (світла/темна в дизайнері галереї) | theme (light/dark) | Farbschema | nur im Designstudio der Galerie |
| головне фото сайту (hero) | hero photo | Aufmacherfoto | „Titelbild“ ist für die Galerie reserviert |
| студія дизайну | design studio | Designstudio | |


## Español — `es`

**Tratamiento:** «tú» en todas partes (panel del fotógrafo, páginas para clientes, landing y textos legales). Imperativo de tú: «Sube», «Elige», «Inténtalo de nuevo».

**Tono:** cercano, tranquilo y seguro, como un compañero de profesión que sabe de lo que habla. Frases cortas, sin tecnicismos innecesarios. Etiquetas de interfaz breves (verbo en infinitivo para botones: «Guardar», «Publicar»).

**Números y fechas:** separador de miles con punto a partir de 5 cifras («30.000», «12.000 UAH»); 4 cifras sin separador («2500 ₴»); decimales con coma. Fechas en formato dd/mm/aaaa o dd.mm.aaaa tal como las da el sistema. Moneda: grivna ucraniana (₴ / UAH), nunca se convierte. Comillas: «…» para citar etiquetas de la interfaz.

**Género:** «el fotógrafo» como genérico en textos para clientes; donde es fácil, se evita el género («tu fotógrafo», «quien te hizo las fotos»).

| Українська | English | Spanish | Note |
|---|---|---|---|
| галерея | gallery | galería | |
| онлайн-галерея для клієнта | client gallery | galería online para clientes | |
| обране / улюблені | favourites | favoritos | «Añadir a favoritos»; el cliente marca con un corazón |
| відбір (клієнтом) | (client) selection | selección | «selección de fotos por el cliente» |
| вибір на ретуш | retouch selection | selección para retoque | |
| ретуш | retouching | retoque | |
| пакет | package | pack | Uso habitual entre fotógrafos en España («pack de boda») |
| передоплата / завдаток / аванс | deposit | señal | «pagar la señal», «30 % de señal para reservar la fecha» |
| бронювання / бронь | booking | reserva | |
| забронювати | to book | reservar | |
| слот / час | slot | hueco (horario) | En el panel: «Huecos»; para el cliente mejor «hora» |
| тариф | plan | plan | Nombres: Gratis, Básico, Plus, Máximo |
| автопродовження | auto-renewal | renovación automática | |
| автоплатіж | auto-payment | pago automático | |
| списання | charge | cargo | «próximo cargo» |
| підписка | subscription | suscripción | |
| кабінет | dashboard | panel | «en tu panel» |
| сховище | storage | almacenamiento | «3 GB de almacenamiento» |
| посилання | link | enlace | |
| обкладинка | cover | portada | |
| водяний знак | watermark | marca de agua | |
| оригінал | original | original | «originales sin compresión» |
| превʼю | preview | vista previa | |
| архів (zip) | archive (zip) | ZIP / archivo ZIP | «Descargar todo» genera un ZIP |
| імпорт | import | importación / importar | |
| чернетка | draft | borrador | |
| опублікувати | publish | publicar | |
| термін дії | expiry | caducidad / fecha de caducidad | |
| пароль | password | contraseña | |
| відбір кадрів (AI) | culling | criba de fotos | Verbo: cribar |
| брак | reject | descarte | «posible descarte», «descarte confirmado» |
| серія | burst | ráfaga | |
| різкість | sharpness | nitidez | |
| позначка | flag | marca | «quitar la marca» |
| статус зйомки | shoot status | estado de la sesión | |
| зйомка | shoot | sesión (de fotos) | |
| обробка (етап) | editing | edición | |
| портфоліо | portfolio | porfolio | Forma habitual en España (RAE) |
| сайт | site | web | «tu web», «web de fotógrafo» |
| тема (сайту) | theme | tema | Nombres de temas sin traducir (Tysha, Opivnich…) |
| розкладка | layout | diseño / disposición | |
| заявка | lead / request | solicitud | «Dejar una solicitud» |
| клієнт | client | cliente | |
| фотограф | photographer | fotógrafo | |
| кредит (реферальний) | referral credit | saldo (de referidos) | «saldo a tu favor» |
| реферал / реферальна програма | referral / referral program | referido / programa de referidos | |
| амбасадор | ambassador | embajador | |
| виведення коштів | withdrawal | retirada | |
| еквайринг | acquiring | TPV virtual | «TPV virtual de Monobank» |
| банка (Monobank) | jar | hucha | La «Banka» de Monobank |
| реквізити | requisites / payment details | datos bancarios | |
| рахунок (на оплату) | invoice | factura / cobro | En pagos: «crear el cobro» |
| чайові | tips | propinas | |
| брендинг | branding | marca de proiav / branding | «sin nuestra marca» |
| лого | logo | logotipo / logo | |
| відгуки | testimonials | opiniones | En la web: «Palabras bonitas» |
| подарунковий сертифікат | gift certificate | tarjeta regalo | |
| фотокнига | photo book | fotolibro | |
| друк | prints | impresiones | |
| публічна оферта | public offer | oferta pública | Título legal: «Oferta pública» |
| політика конфіденційності | privacy policy | política de privacidad | |
| володілець / розпорядник даних | controller / processor | responsable / encargado del tratamiento | |
| Виконавець | Provider | el Prestador | En la oferta |
| Користувач | User | el Usuario | En la oferta |
| форс-мажор | force majeure | fuerza mayor | |
| пробний період | trial | prueba / periodo de prueba | |
| власний домен | custom domain | dominio propio | |
| мультимовність | multilingual | multilingüe | |


## Français — `fr`

- **Vouvoiement** partout (« vous ») : tableau de bord, pages clients, documents juridiques. Impératif poli dans l’interface (« Choisissez », « Importez »), jamais « Veuillez » à répétition — on le garde pour les erreurs.
- **Ton** : chaleureux, calme, sûr de lui ; phrases courtes, pas de jargon marketing anglais. Libellés d’interface brefs, sans point final.
- **Typographie** : espace insécable avant « : ; ? ! » et à l’intérieur des guillemets « … » ; tiret cadratin « — » pour les incises ; apostrophe typographique ’.
- **Nombres** : espace insécable comme séparateur de milliers (30 000), virgule décimale. Unités : Go, To, Mo (pas GB/TB/MB). Monnaie : hryvnia, « ₴ » ou « UAH », jamais convertie. Pourcentages : « 10 % » (espace insécable).
- **Dates** : format JJ.MM.AAAA tel qu’il vient du système ; « jusqu’au {date} », « le {date} ».
- **Pluriels** : catégories `one` (0 et 1) et `other`.
- Marque : « проЯв » reste en cyrillique là où la source l’écrit ainsi ; « proiav » ailleurs. Noms des thèmes (Tysha, Opivnich…) non traduits.

| Українська | English | French | Note |
|---|---|---|---|
| галерея | gallery | galerie | « galerie client » quand il faut préciser |
| обране / улюблені | favourites | favoris | « Ajouter aux favoris » ; côté client |
| вибір на ретуш | retouch selection | sélection pour la retouche | |
| відбір фото клієнтом | client photo selection | sélection des photos par le client | |
| ретуш | retouching | retouche | |
| пакет | package | formule | formules tarifaires du photographe |
| передоплата / завдаток | deposit | acompte | |
| бронювання | booking | réservation | « réserver une séance » |
| бронь | hold / booking | réservation | |
| слот / час | slot | créneau | |
| зйомка | shoot | séance (photo) | « reportage » évité, trop spécifique |
| тариф | plan | offre | SaaS : « offre Essentiel », « changer d’offre » |
| Безкоштовний / Базовий / Плюс / Максимальний | Free / Basic / Plus / Maximum | Gratuite / Essentiel / Plus / Maximum | noms d’offres ; « offre Gratuite » |
| Пробний (сайт) | Trial | Essai | |
| підписка | subscription | abonnement | |
| автопродовження | auto-renewal | renouvellement automatique | |
| автоплатіж | auto-payment | paiement automatique | |
| списання | charge | prélèvement | |
| рахунок | invoice | facture | |
| кабінет | dashboard | espace / tableau de bord | « votre espace » dans les phrases ; nav : « Mon espace » |
| сховище | storage | stockage / espace de stockage | |
| посилання | link | lien | |
| обкладинка | cover | couverture | |
| водяний знак | watermark | filigrane | |
| оригінал | original | original | « originaux sans compression » |
| превʼю | preview | aperçu | |
| архів (zip) | archive (zip) | archive ZIP | |
| завантажити (на сервер) | upload | importer | |
| завантажити (собі) | download | télécharger | |
| імпорт | import | import | import d’une galerie depuis un ZIP |
| відбір кадрів | culling | tri des photos | |
| брак | reject | photo à écarter / rejet | badge : « Rejet confirmé » |
| позначка | flag | signalement | « retirer le signalement » |
| серія | burst | rafale | |
| найкращий у серії | best of burst | meilleure de la rafale | |
| розмито | blurry | floue | |
| статус для клієнта / статус зйомки | delivery status | avancement | « Où en sont vos photos » |
| обробка (етап) | editing | retouche en cours | étape d’avancement |
| портфоліо | portfolio | portfolio | |
| сайт | site | site | |
| заявка | lead / request | demande | « formulaire de demande » |
| клієнт | client | client | |
| фотограф | photographer | photographe | |
| кредит | referral credit | crédit | crédit de parrainage |
| реферальна програма | referral program | programme de parrainage | |
| запросити | invite | parrainer / inviter | |
| амбасадор | ambassador | ambassadeur | |
| виведення коштів | withdrawal | retrait | |
| чайові | tips | pourboires | |
| статистика | stats | statistiques | |
| оферта | public offer | offre publique | titre : « Offre publique (conditions générales) » |
| політика конфіденційності | privacy policy | politique de confidentialité | |
| володілець даних | controller | responsable du traitement | |
| розпорядник | processor | sous-traitant | |
| тема | theme | thème | thème du site |
| розкладка | layout | mise en page | |
| публікувати / чернетка | publish / draft | publier / brouillon | |
| еквайринг | acquiring | compte marchand | « acquiring Monobank » → « encaissement Monobank » |
| банка (Monobank) | jar | cagnotte Monobank | |
| реквізити | requisites | coordonnées bancaires | |
| термін дії | expiry | date d’expiration | « mot de passe et date d’expiration » |
| перший екран (hero) | hero | en-tête | bloc du site |
| відгуки | testimonials | témoignages | |
| подарунковий сертифікат | gift certificate | carte cadeau | |


## Italiano — `it`

**Forma di cortesia:** «tu» ovunque (dashboard, pagine per i clienti, documenti legali e policy per i clienti). Mai «Lei/voi».
**Tono:** amichevole, calmo, sicuro di sé; frasi brevi; etichette UI concise (infinito o imperativo coerente: pulsanti all'imperativo — «Salva», «Pubblica», «Scegli»).
**Virgolette:** «…» per citare etichette UI e nomi di piani; ’ tipografico per l'apostrofo.
**Numeri:** separatore delle migliaia con punto (30.000, 2.500 ₴, 12.000 UAH); decimali con virgola. Unità: GB, MB, TB con spazio (3 GB). Prezzi sempre in grivnie (₴ / UAH), mai convertiti.
**Date:** gg/mm/aaaa o gg.mm.aaaa come nel testo sorgente; le date dinamiche arrivano già formattate da `{date}`.
**Plurali:** categorie `one` / `other` (Intl.PluralRules 'it').
**Genere:** «il fotografo» è usato come maschile generico (anche per fotografe); nei documenti legali «il Fotografo» con maiuscola.

| Українська | English | Italian | Note |
|---|---|---|---|
| галерея | gallery | galleria | «galleria online», «galleria per i clienti» |
| зйомка | shoot | servizio (fotografico) | termine naturale tra i fotografi italiani; «scatto» = singolo frame |
| кадр | frame | scatto / foto | «scatto» nel culling, «foto» nell'UI cliente |
| обране / улюблені | favourites | preferiti | «Aggiungi ai preferiti» |
| вибір на ретуш / відбір | retouch selection | selezione (per il ritocco) | il cliente seleziona con il cuore |
| ретуш / обробка | retouch / editing | ritocco / post-produzione | stato consegna «In post-produzione» |
| пакет | package | pacchetto | pacchetti nel listino del sito |
| передоплата / завдаток | deposit | acconto | NON «caparra» (termine giuridico specifico in Italia) |
| бронювання | booking | prenotazione | «pagina di prenotazione» |
| бронь | hold / booking | prenotazione | |
| слот / час | slot | slot (dashboard) / orario (cliente) | per i clienti sempre «orario» |
| тариф | plan | piano | nomi: Gratuito, Base, Plus, Massimo; sito: Prova, Base, Plus |
| підписка | subscription | abbonamento | |
| автопродовження | auto-renewal | rinnovo automatico | |
| списання | charge | addebito | |
| рахунок (до сплати) | invoice | pagamento / fattura | UI: «pagamento»; legale: «fattura» |
| кабінет | dashboard | dashboard | femminile: «la dashboard» |
| сховище | storage | spazio di archiviazione / spazio | «3 GB di spazio» |
| посилання | link | link | maschile: «il link» |
| обкладинка | cover | copertina | |
| водяний знак | watermark | filigrana | «filigrana con il tuo nome» |
| оригінал | original | originale | «originali senza compressione» |
| превʼю | preview | anteprima | |
| архів (zip) | archive / zip | archivio ZIP | |
| відбір кадрів | culling | scrematura degli scatti | titolo pannello: «Scrematura» |
| брак | reject | scarto | «possibile scarto» |
| серія | burst | raffica | «migliore della raffica» |
| розмито | blurry | sfocato | |
| статус зйомки / для клієнта | delivery status | stato della consegna | |
| тизер | teaser frame | anteprima / scatto teaser | |
| портфоліо | portfolio | portfolio | uguale all'inglese |
| сайт | site | sito | |
| тема | theme | tema | nomi dei temi (Tysha, Opivnich…) non tradotti |
| заявка | lead / request | richiesta | «Lascia una richiesta» |
| клієнт | client | cliente | |
| фотограф | photographer | fotografo / il Fotografo | |
| кредит (реферальний) | referral credit | credito | |
| реферальна програма | referral program | programma referral | |
| запросити | invite | invita | |
| амбасадор | ambassador | Ambassador | |
| виведення коштів | withdrawal | prelievo | |
| чайові | tips | mance | |
| статистика | stats | statistiche | |
| пароль | password | password | |
| термін дії | expiry | scadenza | |
| опублікувати / зняти з публікації | publish / unpublish | pubblica / ritira dalla pubblicazione | |
| чернетка | draft | bozza | |
| завантажити (на сервер) | upload | caricare | |
| завантажити (собі) | download | scaricare | |
| еквайринг | acquiring | acquiring (servizio di pagamento con carta) | |
| банка Monobank | Mono jar | salvadanaio Monobank | |
| реквізити | requisites / card details | dati per il pagamento / coordinate | |
| платіжний провайдер | payment provider | fornitore dei servizi di pagamento | |
| оферта | public offer | Offerta al pubblico | art. 1336 c.c. come concetto |
| політика конфіденційності | privacy policy | Informativa sulla privacy | |
| Виконавець | Provider | Fornitore | maiuscola nei testi legali |
| Користувач | User | Utente | |
| володілець даних | controller | titolare del trattamento | |
| розпорядник | processor | responsabile del trattamento | |
| згода | consent | consenso | |
| форс-мажор | force majeure | forza maggiore | |
| імпорт | import | importazione / importa | |
| відгуки | testimonials | recensioni | sito pubblico: «Dicono di noi» |
| перший екран (hero) | hero | apertura | blocco iniziale del sito |


## Română — `ro`

**Formă de adresare:** formal, „dumneavoastră”, peste tot (panou de control, pagini pentru clienți, documente juridice). Verbe la persoana a II-a plural: „puteți”, „alegeți”, „vă rugăm”. Butoanele rămân la imperativ scurt, persoana a II-a singular, cum e obiceiul în interfețele românești („Salvează”, „Trimite”, „Descarcă tot”) — este convenție UI, nu tutuire.

**Ton:** prietenos, calm, sigur pe sine; fraze scurte, fără calcuri din engleză. Etichetele de interfață — cât mai scurte.

**Diacritice:** ș, ț cu virgulă dedesubt (U+0219, U+021B), nu cu sedilă (ş, ţ). ă, â, î.

**Ghilimele:** „…” (deschidere jos U+201E, închidere sus U+201D); în interior «…».

**Numere și date:** separatorul de mii este punctul („30.000”, „12.000 UAH”), zecimalele cu virgulă. Datele: ZZ.LL.AAAA. Moneda rămâne hrivna (₴ / UAH), prețurile nu se convertesc.

**Plural:** în română „1 zi / 2 zile / 20 de zile” → categoriile `one` / `few` / `other` (cu „de” la `other`).

**Marcă:** „проЯв” rămâne în chirilică acolo unde sursa o are; „proiav” / „Proiav” ca în engleză.

| Українська | English | Romanian | Note |
|---|---|---|---|
| галерея | gallery | galerie (pl. galerii) | „galeria online” pe landing |
| клієнтська галерея | client gallery | galerie pentru clienți | |
| обране / улюблені | favourites | favorite | „Adaugă la favorite”, „în favoritele clientului” |
| вибір / відбір фото клієнтом | client photo selection | selecția fotografiilor de către client | scurt: „selecție” |
| вибір на ретуш | retouch selection | selecție pentru retuș | |
| ретуш | retouching | retuș | |
| обробка (статус) | editing | editare | etapă în stadiul ședinței |
| зйомка | shoot | ședință foto (scurt: ședință) | „ședință” pentru client; „fotografiere” evitat |
| кадр | frame | cadru (pl. cadre) | |
| фото / фотографія | photo | fotografie (pl. fotografii) | „poză” evitat (prea colocvial) |
| пакет | package | pachet | |
| передоплата / завдаток | deposit | avans | |
| бронювання | booking | rezervare | verb: a rezerva |
| бронь | hold / booking | rezervare | |
| слот / час | slot | interval (orar) | „oră” în textele pentru client |
| тариф | plan | plan | „planul Basic”, „plan plătit” |
| Базовий / Плюс / Максимальний | Basic / Plus / Maximum | Basic / Plus / Maxim | nume de plan |
| Безкоштовний | Free | Gratuit | nume de plan |
| Пробний | Trial | De probă | plan de site |
| підписка | subscription | abonament | |
| автопродовження | auto-renewal | reînnoire automată | |
| автоплатіж | auto-payment | plată automată | |
| списання | charge | debitare (de pe card) | |
| кабінет | dashboard | panou de control (scurt: Panou) | |
| акаунт | account | cont | |
| сховище | storage | spațiu de stocare | |
| посилання | link | link | pl. linkuri |
| обкладинка | cover | copertă | |
| водяний знак | watermark | filigran | |
| оригінал | original | original (pl. originale) | |
| превʼю | preview | previzualizare | |
| архів (zip) | archive / zip | arhivă (zip) | |
| відбір кадрів | culling | trierea cadrelor | titlu: „Trierea cadrelor” |
| брак | reject | rebut | „rebut confirmat”, „posibile rebuturi” |
| серія | burst | rafală | |
| різкість | sharpness | claritate | |
| статус зйомки | shoot status | stadiul ședinței | |
| портфоліо | portfolio | portofoliu | |
| сайт | site | site | pl. site-uri |
| тема (сайту) | theme | temă | numele temelor (Tysha, Opivnich…) rămân netraduse |
| заявка | lead / request | cerere | „Lasă o cerere” → „Lăsați o cerere” |
| клієнт | client | client | |
| фотограф | photographer | fotograf | în documentele clientului: „Fotograful” |
| кредит (реферальний) | referral credit | credit (de recomandare) | |
| реферал | referral | persoană invitată / recomandare | „program de recomandare” |
| запросити | invite | a invita | |
| виведення коштів | withdrawal | retragere | |
| амбасадор | ambassador | ambasador | |
| оферта | public offer | ofertă publică | |
| політика конфіденційності | privacy policy | politică de confidențialitate | |
| Виконавець | Provider | Prestator | termen juridic |
| Користувач | User | Utilizator | termen juridic |
| володілець даних | controller | operator (de date) | termen GDPR în română |
| розпорядник | processor | persoană împuternicită (procesator) | termen GDPR în română |
| еквайринг | acquiring | serviciu de acceptare a plăților (acquiring) | |
| банка (Monobank) | jar | „pușculiță” Monobank (jar) | |
| реквізити | requisites / bank details | date bancare | |
| рахунок | invoice | factură | |
| чайові | tips | bacșiș | |
| промо | promo | promoție | |
| чернетка | draft | ciornă | |
| опублікувати | publish | a publica | |
| термін дії | expiry | termen de valabilitate / dată de expirare | |
| вебхук | webhook | webhook | |


## Português (pt-PT) — `pt`

**Forma de tratamento.** Tratamento formal/impessoal habitual nos serviços em Portugal: 3.ª pessoa do singular sem pronome explícito («pode», «o seu», «Escolha um plano», «Carregue as fotos»). Nunca «tu»; evitar também «você» explícito. O mesmo registo no painel, nas páginas para clientes e nos documentos legais.

**Tom.** Simpático, calmo, seguro. Frases curtas; rótulos de interface curtos (verbo no imperativo ou substantivo). Nada de brasileirismos: *ecrã* (não tela), *ficheiro* (não arquivo de computador), *descarregar* / *transferir* (não baixar), *carregar* (upload, não subir), *telemóvel*, *palavra-passe* (não senha), *equipa*, *registo*, *contacto*, *ótimo*, *seleção* (AO 1990).

**Números e datas.** Separador de milhares: espaço (30 000; 12 000 ₴); com 4 algarismos sem separador (2500 ₴). Decimal: vírgula. Moeda: hryvnia, depois do número (1200 ₴ / 1200 UAH) — não converter. Datas: dd/mm/aaaa ou dd.mm.aaaa como no original. Aspas: «…» (aspas angulares); aspas internas “…”. Plurais: ICU `one` / `other` (pt-PT: `one` só para 1).

| Українська | English | European Portuguese | Note |
|---|---|---|---|
| галерея | gallery | galeria | «galeria do cliente», «galeria online» |
| обране, улюблені | favourites | favoritos | «Adicionar aos favoritos»; o cliente «marca com um coração» |
| відбір фото клієнтом | client photo selection | seleção de fotos pelo cliente | nunca «triagem» (essa é a do fotógrafo, IA) |
| вибір на ретуш | retouch selection | seleção para retoque | |
| ретуш | retouching | retoque | |
| обробка (етап) | editing | edição | estado: «Em edição» |
| зйомка | shoot | sessão (fotográfica) | «sessão» em todo o lado; «fotos da sessão» |
| пакет | package | pacote | |
| передоплата, завдаток | deposit | sinal | «sinal de 30% para reservar a data» |
| бронювання | booking | marcação | página de marcações; verbo «marcar» |
| забронювати | to book | marcar / reservar | «Marcar sessão»; «reservar» para tempo/data |
| слот, час | slot | horário | «horário livre», «Horários» |
| тариф | plan / tier | plano | Gratuito, Básico, Plus, Máximo; site: Experimental |
| підписка | subscription | subscrição | |
| автопродовження | auto-renewal | renovação automática | |
| автоплатіж | auto-payment | pagamento automático | |
| списання | charge | cobrança | «próxima cobrança» |
| рахунок (до оплати) | invoice | fatura | |
| кабінет | dashboard | painel | «no seu painel» |
| студія (в auth) | studio | estúdio | «Entrar no seu estúdio» |
| сховище | storage | armazenamento | «3 GB de armazenamento» |
| посилання | link | link | aceite em pt-PT na web |
| обкладинка | cover | capa | |
| водяний знак | watermark | marca de água | |
| оригінал | original | original | «originais sem compressão» |
| превʼю | preview | pré-visualização | curto: «pré-visualizações» |
| архів (zip) | archive / zip | arquivo ZIP | «Descarregar tudo» |
| завантажити (клієнт) | download | descarregar | |
| завантажити (фотограф) | upload | carregar | |
| файл | file | ficheiro | |
| екран | screen | ecrã | «Ecrã inteiro» |
| телефон | phone | telefone / telemóvel | campo: «Telefone» |
| пароль | password | palavra-passe | |
| термін дії | expiry | prazo de acesso / validade | «ativa até» |
| чернетка | draft | rascunho | |
| опублікована | published | publicada | |
| відбір кадрів (AI) | culling | triagem de fotos | painel de IA |
| брак | reject | descarte | «possíveis descartes», «descarte confirmado» |
| позначка | flag | marcação / sinal | usado: «marcação» na triagem |
| серія | burst | sequência | «a melhor da sequência» |
| розмито | blurry | desfocada | |
| статус для клієнта / зйомки | shoot status | estado da sessão | «estado», não «status» |
| портфоліо | portfolio | portefólio | grafia pt-PT |
| сайт | site | site | |
| тема (сайту) | theme | tema | nomes dos temas transliterados (Tysha, Opivnich…) |
| розкладка | layout | disposição | |
| заявка | lead / request | pedido | «Deixe um pedido» |
| клієнт | client | cliente | |
| фотограф | photographer | fotógrafo | |
| відгуки | testimonials | testemunhos | no site público: «Palavras gentis» |
| реферальна програма | referral program | programa de recomendação | |
| реферал | referral | convidado | «fotógrafos convidados» |
| кредит | referral credit | crédito | desconta na próxima fatura |
| виведення коштів | withdrawal | levantamento | «Levantar dinheiro» |
| чайові | tips | gorjetas | |
| еквайринг | acquiring | conta de comerciante (acquiring) | |
| банка Monobank | jar | mealheiro (Monobank) | |
| реквізити | requisites / bank details | dados bancários | |
| імпорт | import | importação | |
| оферта | public offer | Oferta pública | documento legal |
| політика конфіденційності | privacy policy | Política de Privacidade | |
| Виконавець | Provider | Prestador | termo definido, maiúscula |
| Користувач | User | Utilizador | termo definido, maiúscula |
| володілець / розпорядник даних | controller / processor | responsável pelo tratamento / subcontratante | terminologia RGPD em pt-PT |
| персональні дані | personal data | dados pessoais | «tratamento de dados» |
| проЯв / proiav | brand | проЯв / proiav | nunca traduzir |
