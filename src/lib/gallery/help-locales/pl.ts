import type { GalleryHelp } from '../help'

/** Polish „Jak to działa” blocks next to the gallery features in the dashboard. */
export const pl: GalleryHelp = {
  culling: {
    title: 'Jak działa selekcja zdjęć',
    items: [
      'Po kliknięciu „Rozpocznij selekcję” przeglądarka przejrzy podglądy galerii i oznaczy nieostre kadry, powtórzenia w seriach oraz — jeśli ta opcja jest włączona — zamknięte oczy.',
      'Wszystko liczy się na tym komputerze — zdjęcia nigdzie nie są wysyłane. Do sprawdzania oczu przeglądarka jednorazowo pobiera model twarzy (~4 MB) z naszego serwera.',
      'Oznaczenia to tylko podpowiedzi. „Zachowaj oznaczenie” potwierdza odrzut, „Usuń oznaczenie” oznacza, że kadr jest w porządku. W każdej serii jeden kadr jest oznaczony jako najlepszy — można wybrać inny.',
      'Klient niczego nie zauważy, dopóki nie zostanie kliknięty przycisk „Ukryj przed klientem”. Ukryte kadry nie są usuwane: znajdują się w filtrze „Ukryte przed klientem” i każdy można przywrócić.',
      'Gdy karta jest ukryta, analiza jest wstrzymana. Można ją anulować — to, co już sprawdzono, zostaje zachowane, a nowe zdjęcia można przeanalizować później.',
    ],
  },
  delivery: {
    title: 'Jak klient widzi status',
    items: [
      'Wybrany etap zapisuje się od razu. Klient zobaczy go pod zwykłym linkiem do galerii — osobny link nie jest potrzebny.',
      'Dopóki w galerii są mniej niż dwa zdjęcia widoczne dla klienta, widzi on ekran „Sesja → Obróbka → Gotowe”. Pojedyncze zdjęcie staje się zapowiedzią w tle tego ekranu.',
      'Od dwóch zdjęć galeria się otwiera, a etap pokazuje pasek u góry. „Gotowe” i „Bez statusu” to zwykła galeria bez paska.',
      'Data jest opcjonalna: klient zobaczy „planowo do …”. Można ją zmienić lub usunąć w dowolnym momencie.',
    ],
  },
  upload: {
    title: 'Co zrobić, gdy przesyłanie zostanie przerwane',
    items: [
      'Gdy zniknie internet, nie trzeba nic robić — wystarczy nie zamykać karty. Pojawi się komunikat „Brak połączenia”, a przesyłanie wznowi się samo, gdy tylko sieć wróci (jeśli wróci w ciągu 15 minut).',
      'Duże pliki (powyżej 16 MB) są wysyłane w częściach po 8 MB, więc przerwa powtarza jedną część, a nie cały plik.',
      'Jeśli karta lub przeglądarka została zamknięta, wystarczy ponownie otworzyć tę galerię. Nad polem przesyłania pojawi się lista niedokończonych plików: należy wybrać właśnie je — duże będą kontynuowane od miejsca przerwania, a mniejsze zostaną przesłane od nowa.',
      'Przy pliku widać ✕ — należy wybrać ten plik jeszcze raz. Plików, które są już w galerii poniżej, nie trzeba dodawać ponownie: zostałyby przesłane drugi raz.',
    ],
  },
}
