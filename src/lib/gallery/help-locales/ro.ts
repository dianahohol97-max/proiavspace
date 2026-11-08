import type { GalleryHelp } from '../help'

/** Romanian — «How it works» blocks in the dashboard. */
export const ro: GalleryHelp = {
  culling: {
    title: 'Cum funcționează trierea cadrelor',
    items: [
      'Apăsați „Triază cadrele”: browserul parcurge previzualizările galeriei și marchează cadrele neclare, repetările din rafale și, dacă ați activat opțiunea, ochii închiși.',
      'Totul rulează pe acest calculator — fotografiile nu sunt trimise nicăieri. Pentru verificarea ochilor, browserul descarcă o singură dată un model pentru fețe (~4 MB) de pe serverul nostru.',
      'Marcajele sunt doar sugestii. „Păstrează marcajul” confirmă rebutul, „Elimină marcajul” arată că fotografia e în regulă. În fiecare rafală, un cadru este marcat ca cel mai bun — puteți alege altul.',
      'Clientul nu observă nimic până nu apăsați „Ascunde de client”. Fotografiile ascunse nu se șterg: le găsiți la filtrul „Ascunse de client” și fiecare poate fi readusă.',
      'Cât timp fila este ascunsă, analiza stă pe pauză. O puteți anula — ce s-a verificat deja rămâne salvat, iar fotografiile noi pot fi analizate ulterior.',
    ],
  },
  delivery: {
    title: 'Cum vede clientul stadiul',
    items: [
      'Alegeți o etapă — se salvează imediat. Clientul o vede la linkul obișnuit al galeriei; nu e nevoie de un link separat.',
      'Cât timp galeria are mai puțin de două fotografii vizibile pentru client, acesta vede ecranul „Ședința → Editare → Gata”. O singură fotografie devine teaser pe fundalul lui.',
      'De la două fotografii în sus se deschide galeria, iar etapa apare într-un banner în partea de sus. „Gata” și „Fără stadiu” afișează galeria obișnuită, fără banner.',
      'Data este opțională: clientul vede „estimat până la …”. O puteți schimba sau elimina oricând.',
    ],
  },
  upload: {
    title: 'Ce faceți dacă încărcarea s-a întrerupt',
    items: [
      'A căzut internetul — nu faceți nimic și nu închideți fila. Va apărea „Fără conexiune”, iar încărcarea continuă singură imediat ce rețeaua revine (dacă revine în cel mult 15 minute).',
      'Fișierele mari (peste 16 MB) se încarcă în bucăți de 8 MB, așa că o întrerupere repetă o singură bucată, nu tot fișierul.',
      'Ați închis fila sau browserul — deschideți din nou această galerie. Deasupra zonei de încărcare veți vedea fișierele neterminate: alegeți exact acele fișiere, iar cele mari continuă de unde s-au oprit, în timp ce cele mai mici se încarcă din nou.',
      'Lângă un fișier apare ✕ — alegeți din nou acel fișier. Nu adăugați din nou fișierele care sunt deja în galeria de mai jos: s-ar încărca de două ori.',
    ],
  },
}
