import type { ClientPolicyLocale } from '../clientPolicies'

/** Spanish (Spain, es-ES) client-facing policies of a photographer. */
export const es: ClientPolicyLocale = {
  defaultName: 'el Fotógrafo',
  render: (name, email) => {
    const to = email ? `${email}` : 'la dirección de contacto que aparece en la web'
    return {
      privacy: {
        title: 'Política de privacidad',
        blocks: [
          `Este aviso explica cómo ${name} (el «Fotógrafo») recoge y utiliza tus datos personales cuando reservas una sesión o consultas tu galería online.`,
          '# Qué datos recogemos',
          'Tu nombre, tus datos de contacto (teléfono, correo electrónico, redes sociales), los detalles del encargo y las propias fotografías tomadas durante la sesión. Para acceder a la galería pueden usarse una contraseña y un identificador técnico de sesión.',
          '# Para qué los usamos',
          'Para realizar la sesión y entregarte las fotografías, concretar los detalles, emitir la factura y, con tu consentimiento, mostrar algunas fotos en el porfolio. No vendemos tus datos a terceros.',
          '# Publicación de fotografías',
          'Las fotos de tu sesión no se publican en el porfolio ni en redes sociales sin tu consentimiento. Puedes retirarlo en cualquier momento escribiéndonos.',
          '# Conservación',
          'Conservamos la galería y los archivos originales durante el plazo acordado al hacer el encargo; después, pueden eliminarse. Las copias de seguridad no se guardan más tiempo del técnicamente necesario.',
          '# Tus derechos',
          `Puedes pedir una copia de tus datos, su rectificación o su supresión, así como retirar tu consentimiento para la publicación. Para ello, escribe a ${to}.`,
          '# Contacto',
          `Para cualquier pregunta sobre tus datos, contacta con ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Condiciones de pago y devolución',
        blocks: [
          `Estas condiciones regulan la señal, el pago y las devoluciones de los servicios fotográficos que presta ${name} (el «Fotógrafo»).`,
          '# Reserva y señal',
          'La fecha de la sesión queda reservada para ti una vez abonada la señal. La señal confirma la reserva y bloquea ese tiempo en la agenda del Fotógrafo.',
          '# Cancelación por parte del cliente',
          'Si cancelas la sesión con más de 7 días de antelación, se te devuelve la señal íntegra o se traslada a otra fecha. Si cancelas más tarde, la señal puede retenerse como compensación por el tiempo reservado.',
          '# Cancelación por el Fotógrafo o fuerza mayor',
          'Si la sesión no puede celebrarse por causa del Fotógrafo o por fuerza mayor, tú eliges: cambiarla a otra fecha o recibir la devolución íntegra de la señal.',
          '# Fotografías entregadas',
          'Como la fotografía es un servicio personalizado y ya prestado, el pago de una sesión realizada y de las fotografías editadas no es reembolsable. Si el resultado difiere de forma sustancial de lo acordado, lo hablaremos y haremos los ajustes necesarios.',
          '# Cómo solicitar una devolución',
          `Para tramitar una devolución o un cambio de fecha, escribe a ${to}. El importe se devuelve por el mismo medio con el que se pagó, en un plazo razonable.`,
        ],
      },
    }
  },
}
