import type { GalleryHelp } from '../help'

/** Spanish (Spain, es-ES) «How it works» help blocks. */
export const es: GalleryHelp = {
  culling: {
    title: 'Cómo funciona la criba de fotos',
    items: [
      'Pulsa «Cribar fotos»: el navegador revisa las vistas previas de la galería y marca las fotos desenfocadas, las repeticiones dentro de una ráfaga y, si lo activas, los ojos cerrados.',
      'Todo se calcula en este ordenador: las fotos no se envían a ningún sitio. Para detectar ojos cerrados, el navegador descarga una sola vez un modelo de caras (~4 MB) desde nuestro propio servidor.',
      'Las marcas son solo sugerencias. «Mantener la marca» confirma el descarte y «Quitar la marca» indica que la foto está bien. En cada ráfaga hay una foto marcada como la mejor; puedes elegir otra.',
      'El cliente no notará nada hasta que pulses «Ocultar al cliente». Las fotos ocultas no se eliminan: están en el filtro «Ocultas al cliente» y puedes volver a mostrar cualquiera.',
      'Mientras la pestaña está oculta, el análisis se pausa. Puedes cancelarlo: lo ya revisado se conserva y las fotos nuevas se pueden analizar más adelante.',
    ],
  },
  delivery: {
    title: 'Cómo ve el cliente el estado',
    items: [
      'Elige una etapa: se guarda al momento. El cliente la verá en el enlace habitual de la galería; no hace falta otro enlace.',
      'Mientras la galería tenga menos de dos fotos visibles para el cliente, este verá la pantalla «Sesión → Edición → Lista». Si solo hay una foto, se convierte en el adelanto de fondo de esa pantalla.',
      'A partir de dos fotos se abre la galería y la etapa aparece en una franja arriba. Con «Lista» y «Sin estado» se ve la galería normal, sin franja.',
      'La fecha es opcional: el cliente verá «prevista para el …». Puedes cambiarla o quitarla cuando quieras.',
    ],
  },
  upload: {
    title: 'Qué hacer si se interrumpe la subida',
    items: [
      'Si se va internet, no hagas nada y no cierres la pestaña. Verás «Sin conexión» y la subida seguirá sola en cuanto vuelva la red (si vuelve en menos de 15 minutos).',
      'Los archivos grandes (de más de 16 MB) se suben en partes de 8 MB, así que un corte solo repite una parte, no el archivo entero.',
      'Si se ha cerrado la pestaña o el navegador, vuelve a abrir esta galería. Encima de la zona de subida verás la lista de archivos sin terminar: elige exactamente esos; los grandes seguirán donde se quedaron y los pequeños se subirán de nuevo.',
      'Si junto a un archivo aparece ✕, vuelve a elegir ese archivo. No añadas otra vez los archivos que ya están en la galería de abajo: se subirían dos veces.',
    ],
  },
}
