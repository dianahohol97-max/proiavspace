import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** Spanish (Spain, es-ES). «Tú», like the dashboard. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'es')
const galleries = (count: number) => n(count, '{n, plural, one {# galería} other {# galerías}}')
const files = (count: number) => n(count, '{n, plural, one {# archivo} other {# archivos}}')
const days = (count: number) => n(count, '{n, plural, one {# día} other {# días}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `O borra lo que ya no necesites en tu panel para quedarte dentro de los ${freeGb} GB gratuitos; así no se pierde nada: ${then}`

const SIGN = '— proiav'

export const es: EmailCopy = {
  hello: (name) => (name ? `¡Hola, ${name}!` : '¡Hola!'),
  helloClient: '¡Hola!',
  footerQuestions: 'Preguntas y facturas',
  planNames: {
    free: 'Gratis',
    basic: 'Básico',
    plus: 'Plus',
    pro: 'Máximo',
    site_basic: 'Web Básico',
    site_plus: 'Web Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} de almacenamiento para galerías`,
    galleries: 'Galerías para clientes con contraseña, selección de fotos y descarga en ZIP',
    video: 'Vídeo en las galerías',
    noBranding: 'Sin la marca «proiav» en las galerías',
    logo: 'Tu logotipo en las galerías',
    stats: 'Estadísticas de visitas y descargas',
    support: 'Soporte prioritario',
    noExpiry: 'Las galerías no caducan mientras el plan esté activo',
    sites: (count) => `${count} webs de porfolio`,
    site: 'Web de porfolio',
    domain: 'Dominio propio',
  },

  receipt(v) {
    const credit = v.credit ? ` (de los cuales, ${v.credit} con tu saldo de referidos)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `La renovación automática está activada: el próximo cargo será el ${v.nextChargeAt}, de ${v.nextChargeAmount}. Te avisaremos 3 días antes. Puedes cancelarla cuando quieras en tu panel; el periodo pagado sigue activo hasta el final.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `No se ha podido activar la renovación automática: al pagar con ${v.wallet} la tarjeta no se guarda. El plan está activo hasta el ${v.periodEnd}. Para que se renueve automáticamente la próxima vez, paga con tarjeta y marca «Renovación automática».`
    } else {
      renewal = `La renovación automática está desactivada: el plan está activo hasta el ${v.periodEnd}; después mantienes el acceso completo ${days(v.graceDays)} más y, a continuación, la cuenta pasa a ser gratuita.`
    }
    return {
      subject: `Recibo: ${v.amount} — plan «${v.plan}», proiav`,
      lead: ['Pago recibido. ¡Gracias por confiar en nosotros!'],
      rows: [
        ['Plan', `«${v.plan}»${v.volume ? `, ${v.volume}` : ''}`],
        ['Importe', `${v.amount}${credit}`],
        ['Fecha de pago', v.paidAt],
        ['Periodo', `${v.period === 'year' ? 'año' : 'mes'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Activo hasta', v.periodEnd],
        ['Forma de pago', v.wallet ? `${v.wallet} (${v.provider})` : `tarjeta, ${v.provider}`],
        ['Pedido', v.orderId],
      ],
      list: { title: 'Qué incluye', items: v.includes },
      after: [renewal, `${v.provider} te enviará el justificante bancario por separado.`],
      button: { label: 'Abrir el panel', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Dentro de ${days(v.days)}: renovación automática del plan «${v.plan}», ${v.amount}`,
      lead: [
        `El ${v.chargeAt} cargaremos ${v.amount} en tu tarjeta guardada: es la renovación automática del plan «${v.plan}»${v.volume ? ` (${v.volume})` : ''} por un ${v.period === 'year' ? 'año' : 'mes'}.`,
      ],
      rows: [
        ['Plan', `«${v.plan}»`],
        ['Importe', v.amount],
        ['Fecha del cargo', v.chargeAt],
      ],
      after: [
        'Si tienes saldo de referidos, lo tendremos en cuenta y el cargo será menor.',
        '¿No quieres renovar? Cancela la renovación automática antes de la fecha del cargo: el periodo pagado sigue activo hasta el final y no se harán más cargos en la tarjeta.',
      ],
      button: { label: 'Cancelar la renovación automática', url: `${v.billingUrl}#autopay` },
      link: { label: 'Panel y planes', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · no hemos podido cobrar ${v.amount} del plan «${v.plan}»`,
      lines: [
        v.greeting,
        '',
        `Hoy hemos intentado cobrar ${v.amount} del plan «${v.plan}», pero el banco ha rechazado el pago`,
        '(lo más habitual es que la tarjeta haya caducado o que no hubiera saldo suficiente).',
        '',
        `No se pierde nada. Hasta el ${v.graceUntil} todo funciona como siempre:`,
        `las galerías siguen abiertas para los clientes${v.volume ? `, con un límite de ${v.volume}` : ''}.`,
        '',
        `Para mantener el plan sin interrupciones, actualiza tu tarjeta antes del ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Si no lo haces:',
        `– a partir del ${v.graceUntil}, las galerías dejarán de estar disponibles para los clientes (tú las seguirás viendo y podrás descargarlas);`,
        `– a partir del ${v.deletesAt}, los archivos se eliminarán del almacenamiento.`,
        '',
        'Te lo recordaremos 30, 7 y 1 día antes de eliminarlos.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo ? 'Tu mes gratis de «Básico» por la importación' : `El periodo pagado del plan «${v.plan}»`
    return {
      subject: `proiav · tu plan «${v.plan}» ha terminado: todo sigue igual durante ${days(v.graceDays)}`,
      lines: [
        v.greeting,
        '',
        `${what} terminó el ${v.endedAt}.`,
        '',
        `Hasta el ${v.closesAt} no cambia nada: las galerías siguen abiertas para los clientes,`,
        `${v.volume ? `el límite es de ${v.volume} y ` : ''}los vídeos siguen en su sitio.`,
        '',
        'Después, si no renuevas el plan:',
        `– ${v.closesAt}: las galerías se cierran para los clientes. Tú lo sigues viendo todo en tu panel`,
        '  y puedes descargar cualquier galería en ZIP;',
        `– ${v.deletesAt}: los archivos se eliminan del almacenamiento para siempre.`,
        '',
        'Para renovar el plan basta con un pago, y todo se vuelve a abrir al momento:',
        v.billingUrl,
        '',
        `¿No piensas pagar? Descarga las galerías que necesites antes del ${v.deletesAt}: es gratis.`,
        fitIntoFree(v.freeGb, 'la cuenta pasa a ser gratuita y las galerías siguen abiertas para los clientes.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · las galerías están cerradas para los clientes; los archivos se conservan hasta el ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Hoy ha terminado el periodo de transición tras el fin del plan «${v.plan}». Tus ${galleries(v.galleryCount)}`,
        'están cerradas para los clientes: en el enlace ven «Esta galería no está disponible temporalmente»,',
        'en su propio idioma, el mismo con el que abrieron la galería.',
        '',
        'Para ti no ha desaparecido nada: todas las galerías y los archivos están en tu panel. Puedes',
        'descargar el ZIP de cualquier galería gratis.',
        '',
        `Los archivos se conservan hasta el ${v.deletesAt}. Después de esa fecha se eliminarán del`,
        'almacenamiento y no se podrán recuperar.',
        '',
        'Para volver a abrir las galerías, paga un plan; estarán disponibles en los mismos',
        'enlaces y se conservarán las contraseñas y las selecciones de los clientes:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'los archivos restantes se quedan, la cuenta pasa a ser gratuita y las galerías se vuelven a abrir para los clientes.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · los archivos se eliminarán mañana: último aviso'
        : `proiav · los archivos se eliminarán dentro de ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Mañana' : `Dentro de ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, el ${v.deletesAt}, eliminaremos del almacenamiento los archivos`,
        `de tus galerías: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Este es el último aviso.'] : []),
        '',
        'Es definitivo: una vez eliminados, los archivos no se pueden recuperar.',
        '',
        'Tres formas de no perder nada:',
        '1. Paga un plan: las galerías se abren al momento para los clientes y los archivos se quedan:',
        `   ${v.billingUrl}`,
        `2. Descarga las galerías en ZIP antes del ${v.deletesAt}, gratis, desde tu panel:`,
        `   ${v.dashboardUrl}`,
        `3. Borra lo que ya no necesites para quedarte dentro de los ${v.freeGb} GB gratuitos: los archivos restantes se quedan y las galerías se vuelven a abrir para los clientes.`,
        `   ${v.dashboardUrl}`,
        '',
        'Si ya no necesitas estos archivos, no tienes que hacer nada.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · tu mes gratis de «Básico» termina el ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Tu mes gratis del plan «Básico» por importar una galería termina el ${v.endsAt}.`,
        '',
        `Para seguir con «Básico» (${v.storageGb} GB, ${v.price}/mes), activa el pago automático:`,
        `ahora cobramos ${v.price} y el mes de pago empieza el ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Sin pago automático, a partir del ${v.endsAt} todo sigue igual durante ${days(v.graceDays)}; después, las galerías`,
        `se cierran para los clientes y, ${days(v.retentionDays)} más tarde, los archivos se eliminan del almacenamiento.`,
        'Te avisaremos con antelación.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'mañana' : `dentro de ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} se cierran ${when}`
        : `proiav · la galería «${v.galleries[0].title}» se cierra ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `Con el plan gratuito, cada galería está abierta durante ${days(v.freeDays)}. ${When} estas galerías se cerrarán para los clientes:`
          : `Con el plan gratuito, cada galería está abierta durante ${days(v.freeDays)}. ${When} esta galería se cerrará para los clientes:`,
        ...v.galleries.map((g) => `• «${g.title}» — ${g.closesAt}`),
        '',
        `Cuando se cierre, el cliente verá «Esta galería está cerrada. Ponte en contacto con tu fotógrafo». Tú la seguirás viendo en tu panel y, ${days(v.purgeDays)} después del cierre, los archivos se eliminarán.`,
        '',
        `Para que las galerías sigan abiertas sin límite de tiempo, pásate a «Básico»: ${v.basicPrice}/mes, ${v.basicGb} GB y vídeo. El límite de tiempo desaparece de todas las galerías en cuanto pagas:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · tu periodo de partner termina el ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `¡Gracias por trabajar con nosotros! Tu periodo de partner en el plan «${v.plan}» termina el ${v.endsAt}.`,
        '',
        `Para seguir con «${v.plan}» sin interrupciones, contrata el plan con pago automático: ${v.priceMonth}/mes o ${v.priceYear}/año (dos meses de regalo). También puedes elegir otro plan, desde «Básico» por ${v.basicPrice}/mes.`,
        v.billingUrl,
        '',
        `Si no haces nada, la cuenta pasará a ser gratuita (${v.freeGb} GB): las galerías que ya tienes seguirán disponibles para los clientes ${days(v.freeDays)} más, y cada galería nueva, ${days(v.freeDays)} desde que la crees.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Tus fotos están listas: la galería «${v.galleryTitle}» ya está abierta. Puedes verlas, elegir tus favoritas y descargarlas.`,
    ]
    if (v.hasPassword) lead.push('La galería está protegida con contraseña; si el fotógrafo aún no te la ha enviado, te la mandará por separado.')
    return {
      subject: `Tus fotos están listas — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotógrafo', v.photographerName]] : undefined,
      button: { label: 'Abrir la galería', url: v.url },
      after: [
        'Recibes este correo porque el fotógrafo añadió tu dirección para avisarte cuando las fotos estuvieran listas. Si respondes, tu respuesta le llegará al fotógrafo.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'recompensa por referidos' : 'saldo por referidos'
    const firstWhat = v.isAmbassador ? 'primera recompensa por referidos' : 'primer saldo por referidos'
    return {
      subject: `+${v.sum}: tu ${v.first ? firstWhat : what}`,
      lines: [
        v.greeting,
        '',
        `Un fotógrafo que llegó con tu enlace acaba de ${v.first ? 'contratar un plan de pago' : 'volver a pagar su plan'}.`,
        v.isAmbassador
          ? `Has ganado ${v.sum} para retirar: el 10 % de su pago. Y lo mismo con cada uno de sus primeros ${v.cap} pagos.`
          : `Has ganado ${v.sum} de saldo: el 10 % de su pago. Y así con cada pago que haga.`,
        v.isAmbassador
          ? `Puedes retirarlo a partir de ${v.minWithdrawal} desde tu panel: ${v.link}`
          : `El saldo se aplica automáticamente a tu próxima factura. Saldo y enlace: ${v.link}`,
        '',
        'Gracias por recomendarnos a tus compañeros.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Nueva reserva: ${v.slot}`,
      lines: [
        `Acaban de reservar una sesión para el ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Cliente: ${v.clientName}`,
        `Teléfono: ${v.clientPhone}`,
        `Correo: ${v.clientEmail}`,
        '',
        'Comprueba el estado del pago en tu panel.',
      ],
    }
  },
}
