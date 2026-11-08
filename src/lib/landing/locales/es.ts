import type { LandingCopy } from '../copy'

/** Spanish (Spain, es-ES) landing copy — translated from `en` in ../copy. */
export const es: LandingCopy = {
  nav: {
    features: 'Funciones',
    galleries: 'Galerías',
    pricing: 'Precios',
    themes: 'Temas',
    blog: 'Blog',
    signIn: 'Iniciar sesión',
    ctaShort: 'Empieza gratis',
    dashboard: 'Panel',
  },
  hero: {
    chips: ['Bodas', 'Familias', 'Retratos', 'Estudios'],
    titleBefore: 'Todo lo que pasa ',
    titleAccent: 'después',
    titleAfter: ' del disparo',
    subtitle: 'Galería online para fotógrafos: entrega cada sesión con un solo enlace, bonito y claro.',
    lede:
      'Galerías en las que el cliente sabe al momento cómo llevarse sus fotos: sin Google Drive y sin «¿cómo me lo descargo?». Favoritos, contraseña y caducidad, originales sin compresión. Y tu marca en todas partes.',
    cta: 'Empieza gratis',
    ctaNote: '3 GB gratis, cada galería abierta 30 días. Sin tarjeta.',
    statNumber: '30.000',
    statText: 'fotos entregadas a clientes con las galerías de proiav',
    status: { steps: ['Sesión', 'Edición', 'Lista'], now: 'ahora', eta: 'Prevista para el 14 de diciembre' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Historias de boda',
  },
  strip: { label: 'Trabajos de fotógrafos' },
  products: {
    label: 'Galerías · criba · estado de la sesión',
    titleBefore: 'Galerías para clientes de fotógrafos, ',
    titleAccent: 'con tu marca',
    lede:
      'Todo empieza por la galería: ahí es donde el fotógrafo se encuentra con sus clientes cada semana. Novedades en las galerías: criba de descartes, estado de la sesión para el cliente y una subida que aguanta los cortes de conexión. Abajo tienes las pantallas reales.',
    gallery: {
      no: '01 — Galerías',
      title: 'Entrega tus sesiones con estilo',
      text: 'Subes las fotos y el cliente recibe un enlace precioso para descargarlas él mismo, sin Google Drive y sin «¿cómo me lo descargo?». Favoritos, contraseña, caducidad, ZIP y estadísticas.',
      tagStrong: 'Originales sin compresión.',
      tagRest: ' Los archivos, tal cual los disparaste',
    },
    features: [
      {
        no: '02 — Criba con IA',
        title: 'Los descartes se señalan, tú decides',
        text: 'Las fotos desenfocadas, las repeticiones dentro de una ráfaga y los ojos cerrados se marcan automáticamente, y la mejor foto de cada ráfaga aparece junto a las demás. El análisis se hace en tu navegador: las fotos no se envían a ningún sitio.',
        tagStrong: 'Nada se oculta solo.',
        tagRest: ' Una foto desaparece para el cliente solo cuando tú lo confirmas',
        alt: 'Panel «Criba de fotos»: marcas «Repetida» y «Desenfocada» sobre las fotos y el filtro «Posibles descartes»',
      },
      {
        no: '03 — Estado de la sesión',
        title: 'El cliente ve en qué punto están sus fotos',
        text: 'Mientras la galería está vacía, en el mismo enlace el cliente ve «Sesión → Edición → Lista» y la fecha prevista, si la has indicado. En cuanto las fotos están listas, la galería se abre ahí mismo.',
        tagStrong: 'Un solo interruptor en el panel.',
        tagRest: ' El cliente ve los cambios al instante',
        alt: 'Pantalla de estado para el cliente: «Ya estamos con tus fotos», la etapa «Edición» y una fecha prevista',
      },
      {
        no: '04 — Subida fiable',
        title: 'Si se corta la conexión, no empiezas de cero',
        text: 'Los archivos grandes se suben en partes de 8 MB. Si se cae la red, la subida espera y sigue sola. Si se cierra la pestaña, elige los mismos archivos y continuarán donde se quedaron.',
        tagStrong: 'Solo se repite la parte que faltaba,',
        tagRest: ' no el archivo entero',
        alt: 'El cargador de la galería sin conexión: fotos ya subidas y vídeos esperando a que vuelva la red',
      },
    ],
  },
  bento: {
    label: 'Todo en un solo panel',
    titleBefore: 'Los pequeños detalles que hacen tu trabajo ',
    titleAccent: 'más tranquilo',
    cards: {
      selection: {
        label: 'Selección',
        text: 'El cliente marca con un corazón las fotos para retoque y exportas la lista de archivos en un clic',
      },
      galleryPhoto: 'Galería',
      protection: { label: 'Protección', text: 'Contraseña y caducidad en cada galería' },
      archive: { label: 'ZIP', text: 'Todo con un clic: el ZIP se prepara sin colas ni esperas' },
      watermark: { label: 'Marca de agua', text: 'Tu nombre en las vistas previas. Los originales, limpios' },
      stats: { label: 'Estadísticas', number: '247', text: 'visitas a la galería esta semana' },
      themes: {
        label: 'Diseño de la galería',
        text: 'Tres ambientes y cinco diseños',
        chips: ['Mosaico', 'Collage', 'Editorial', 'Cuadrados', 'Retrato 3:4'],
      },
      previewPhoto: 'Vistas previas sin perder velocidad',
      slideshow: { label: 'Visualización', text: 'Visor a pantalla completa y presentación, también en el móvil' },
      video: {
        label: 'Vídeo',
        text: 'Vídeos junto a las fotos en la misma galería, desde el plan Básico',
      },
      languages: { label: 'Idiomas', text: 'El cliente cambia la galería a su idioma: hay nueve' },
    },
  },
  principles: {
    huge: 'Principios',
    title: 'Cómo está hecha la plataforma por dentro',
    lede: 'No es una lista de funciones: son decisiones que no se replantean.',
    items: [
      {
        title: 'Tu marca, en primer plano',
        text: 'Desde el primer plan de pago, las galerías no nos mencionan en ningún sitio. El cliente solo ve al fotógrafo.',
      },
      {
        title: 'Decide el fotógrafo',
        text: 'La automatización solo sugiere. Ninguna foto se oculta al cliente hasta que tú lo confirmas.',
      },
      {
        title: 'Los originales no se tocan',
        text: 'Los archivos se guardan byte a byte. El cliente navega por vistas previas rápidas y descarga en máxima calidad.',
      },
      {
        title: 'Tus fotos no salen para analizarse',
        text: 'La criba se hace en tu navegador. Las fotos no se pasan a servicios de terceros: incluso el modelo de caras se carga desde nuestro propio servidor.',
      },
    ],
  },
  pricing: {
    label: 'Precios',
    titleBefore: 'Precios de la galería online: ',
    titleAccent: 'solo pagas por el espacio',
    lede:
      'La selección de fotos por el cliente es gratis para todos. Los planes de pago quitan nuestra marca y añaden vídeo y más espacio; con Plus, además, estadísticas.',
    perMonth: '/ mes',
    freeLabel: 'sin tarjeta',
    yearHint: (year) => `o ${year} ₴ al año: dos meses de regalo`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB de almacenamiento` : `${gb} GB de almacenamiento`),
    popular: 'Recomendado',
    fineprint:
      'Paga con tarjeta de cualquier banco ucraniano. Cancela cuando quieras: todo sigue funcionando 14 días más. Después, si superas los 3 GB gratuitos, las galerías se cierran para los clientes y los archivos se conservan 60 días más.',
    plans: {
      free: {
        name: 'Gratis',
        note: 'Cada galería abierta 30 días, para que lo pruebes',
        bullets: ['Selección de fotos por el cliente', 'Galerías con contraseña y caducidad', 'Galerías ilimitadas'],
      },
      basic: {
        name: 'Básico',
        note: 'Tu marca, y solo la tuya',
        bullets: ['Sin nuestra marca', 'Tu logotipo en las galerías', 'Vídeo en las galerías'],
      },
      plus: {
        name: 'Plus',
        note: 'Para una temporada completa de trabajo',
        bullets: ['Todo lo de Básico', 'Estadísticas de visitas', 'Propinas de clientes'],
      },
      pro: {
        name: 'Máximo',
        note: 'Archivos grandes y temporada a tope',
        bullets: ['Todo lo de Plus', 'Soporte prioritario', '1 TB de almacenamiento'],
      },
    },
    planCta: 'Elegir',
  },
  referral: {
    label: 'Programa de referidos',
    title: 'Invita a tus compañeros y gana el 10 % de cada pago que hagan',
    lede: 'Comparte tu enlace con otro fotógrafo. Cuando contrate un plan de pago, recibirás el 10 % de cada uno de sus pagos como saldo, todos los meses. El saldo se descuenta automáticamente de tu próxima factura.',
    steps: [
      'Copia tu enlace en el panel.',
      'Un compañero se registra con él y contrata un plan de pago.',
      'Cada mes recibes el 10 % como saldo, automáticamente.',
    ],
    cta: 'Consigue tu enlace',
  },
  faq: {
    label: 'Preguntas frecuentes',
    title: 'Lo importante, en pocas palabras',
    items: [
      {
        q: '¿Ven los clientes que la galería está hecha con proiav?',
        a: 'Con el plan gratuito aparece una pequeña nota «Hecho con proiav» al pie de la galería. A partir de Básico desaparece: en las páginas solo están tu nombre, tu logotipo y tus fotos.',
      },
      {
        q: '¿Puede la criba con IA ocultar o borrar fotos por su cuenta?',
        a: 'No. Solo marca los posibles descartes: fotos desenfocadas, repeticiones dentro de una ráfaga, ojos cerrados. Al cliente solo se le oculta lo que tú confirmas y ocultas con el botón; los archivos no se borran y cualquier foto se puede volver a mostrar.',
      },
      {
        q: '¿Qué ve el cliente mientras editas las fotos?',
        a: 'Si has puesto un estado de la sesión, en el enlace de la galería el cliente ve «Sesión → Edición → Lista» y la fecha prevista, si la has indicado. Cuando añades las fotos, la galería se abre ahí mismo.',
      },
      {
        q: '¿Qué pasa con mis archivos si cancelo?',
        a: 'Durante 14 días todo sigue funcionando igual. Si te cabe todo en los 3 GB gratuitos, la cuenta simplemente pasa a ser gratuita. Si no, las galerías se cierran para los clientes y los archivos se conservan 60 días más: lo sigues viendo todo en tu panel y puedes descargarlo o renovar el plan. Te avisamos por correo 30, 7 y 1 día antes de borrar nada.',
      },
      {
        q: '¿Se comprimen mis fotos?',
        a: 'Los originales se guardan byte a byte. El cliente navega por vistas previas generadas, pero el botón de descarga siempre entrega el original.',
      },
    ],
  },
  final: {
    label: 'Empieza con una galería',
    titleBefore: 'Entrega tu próxima sesión ',
    titleAccent: 'con estilo',
    cta: 'Crear una cuenta gratis',
  },
  footer: {
    tagline: 'Galerías online para clientes de fotógrafos en Ucrania',
    blog: 'Blog',
    terms: 'Oferta pública',
    privacy: 'Política de privacidad',
  },
}
