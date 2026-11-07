import type { LandingCopy } from '../copy'

/** Spanish (Spain, es-ES) landing copy — translated from `en` in ../copy. */
export const es: LandingCopy = {
  nav: {
    features: 'Funciones',
    galleries: 'Galerías',
    sites: 'Webs',
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
    slotPay: 'Pagar al fotógrafo',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Historias de boda',
  },
  strip: { label: 'Trabajos de fotógrafos' },
  products: {
    label: 'Galerías · reservas · un solo panel',
    titleBefore: 'Galerías para clientes de fotógrafos, ',
    titleAccent: 'con tu marca',
    lede:
      'Todo empieza por las galerías: ahí es donde el fotógrafo se encuentra con sus clientes cada semana. Y si quieres que el cliente elija la hora de la sesión y pague en el momento, las reservas también funcionan ya.',
    soon: 'Pronto',
    items: [
      {
        no: '01 — Galerías',
        title: 'Entrega tus sesiones con estilo',
        text: 'Subes las fotos y el cliente recibe un enlace precioso para descargarlas él mismo, sin Google Drive y sin «¿cómo me lo descargo?». Favoritos, contraseña, caducidad, ZIP y estadísticas.',
        tagStrong: 'Originales sin compresión.',
        tagRest: ' Los archivos, tal cual los disparaste',
      },
      {
        no: '02 — Reservas',
        title: 'El cliente elige su hora',
        text: 'Y paga en el momento: Monobank, WayForPay, una hucha o datos bancarios. Nada de reservas dobles, y las reservas sin pagar se liberan solas.',
        tagStrong: 'El dinero va directo a ti.',
        tagRest: ' Nunca tocamos los pagos',
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
      payments: { label: 'Pagos', text: 'Directos a tu tarjeta. Siempre.' },
      stats: { label: 'Estadísticas', number: '247', text: 'visitas a la galería esta semana' },
      themes: {
        label: 'Diseño de la galería',
        text: 'Tres ambientes y cinco diseños',
        chips: ['Mosaico', 'Collage', 'Editorial', 'Cuadrados', 'Retrato 3:4'],
      },
      previewPhoto: 'Vistas previas sin perder velocidad',
      autoRelease: { label: 'Reservas', text: 'Un hueco sin pagar se libera solo en unas horas' },
      video: {
        label: 'Vídeos grandes',
        text: 'Subida por partes: si se corta la conexión al 95 %, pierdes segundos, no horas',
      },
      email: { label: 'Correo', text: 'Te llega al instante un correo con cada reserva nueva y los datos del cliente' },
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
        title: 'El dinero, directo a ti',
        text: 'Los pagos de las sesiones llegan a tu TPV virtual o a tu tarjeta. La plataforma no retiene tu dinero ni un segundo.',
      },
      {
        title: 'Los originales no se tocan',
        text: 'Los archivos se guardan byte a byte. El cliente navega por vistas previas rápidas y descarga en máxima calidad.',
      },
      {
        title: 'Pagado = lo dice el banco',
        text: 'El estado «pagado» se marca después de comprobarlo con el banco, nunca por lo que diga el cliente ni por un webhook sin verificar.',
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
        note: 'Archivos grandes y agenda llena',
        bullets: ['Todo lo de Plus', 'Soporte prioritario', '1 TB de almacenamiento'],
      },
    },
    planCta: 'Elegir',
    siteTitle: 'Webs para fotógrafos',
    siteLede: 'Una web personal con dominio propio, SSL y SEO. Prueba gratis de 7 días.',
    sitePlans: {
      site_trial: { name: 'Prueba', note: '1 web durante 7 días' },
      site_basic: { name: 'Básico', note: '1 web · dominio propio · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2 o más webs · multilingüe · todo lo anterior' },
    },
    bundleNote: 'Pack Galería + Web: 15 % de descuento en la web mientras las dos suscripciones estén activas.',
    soonBadge: 'Pronto',
    siteComingSoon:
      'El creador de webs para fotógrafos está en pleno desarrollo y llegará muy pronto. De momento nos centramos en las galerías, que es donde empieza el trabajo con el cliente. ¿Quieres ser de los primeros en saber cuándo se lanza? Deja tu correo pulsando «Empieza gratis».',
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
        q: '¿Por dónde pasa el dinero de las sesiones?',
        a: 'Por nosotros, no. Los cobros se crean en tu propio TPV virtual de Monobank o WayForPay; los métodos manuales son tu hucha o tu tarjeta. Nosotros solo mostramos el botón y comprobamos el estado del pago con el banco.',
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
