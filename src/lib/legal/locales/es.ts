import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/** Spanish (Spain, es-ES) — translated from the Ukrainian (legally binding) version. */
export const es: LegalCopy = {
  backToHome: '← Inicio',
  reviewNote:
    'Esta traducción se ofrece solo para tu comodidad. La versión jurídicamente vinculante es la ucraniana; en caso de discrepancia, prevalece el texto ucraniano. La traducción no crea ninguna obligación adicional a las de la versión ucraniana.',
  oferta: {
    title: 'Oferta pública',
    updated: `Versión del ${UPDATED}`,
    intro:
      `Este documento es la propuesta pública oficial (oferta) de ${ENTITY} (en adelante, el «Prestador») para celebrar un contrato de acceso al servicio online «проЯв» (en adelante, el «Servicio») en las condiciones que se exponen a continuación. Al registrarte en el Servicio o realizar un pago, tú (en adelante, el «Usuario») aceptas plenamente y sin reservas las condiciones de esta oferta.`,
    sections: [
      {
        heading: '1. Definiciones',
        paragraphs: [
          '«Servicio»: el producto de software web «проЯв» (proiav.space), que ofrece a los fotógrafos herramientas para galerías online de clientes, webs personales y recepción de reservas.',
          '«Usuario»: el fotógrafo u otra persona que ha registrado una cuenta en el Servicio.',
          '«Cliente del Usuario»: el tercero al que el Usuario da acceso a una galería o a un formulario de reserva.',
          '«Plan»: el conjunto de funciones y el volumen de almacenamiento que se ofrecen a cambio de un pago, según la página de planes.',
        ],
      },
      {
        heading: '2. Objeto del contrato',
        paragraphs: [
          'El Prestador da al Usuario acceso a las funciones del Servicio en las condiciones del Plan elegido, y el Usuario se compromete a pagar dicho acceso (salvo en el plan gratuito) y a cumplir las condiciones de esta oferta.',
          'El Servicio se presta «tal cual». El Prestador desarrolla el Servicio y puede modificar sus funciones, avisando con antelación de los cambios importantes.',
        ],
      },
      {
        heading: '3. Planes y pago',
        paragraphs: [
          'Los precios vigentes figuran en la página de planes en grivnas ucranianas (₴). El pago se realiza con tarjeta de un banco ucraniano a través de un proveedor de pagos (Monobank / LiqPay); el Prestador no guarda los datos completos de la tarjeta.',
          'La suscripción está vigente durante el periodo pagado (un mes o un año) y, si la renovación automática está activada, se renueva automáticamente hasta que el Usuario la cancele.',
          'La renovación automática se activa con la casilla «Renovación automática» situada junto al botón de pago en la página de planes, donde se indican el importe y la periodicidad del cargo. Si la casilla se deja marcada, el proveedor de pagos (Monobank) guarda un token de la tarjeta y, en cada periodo siguiente, se carga automáticamente en ella el mismo importe del plan elegido (descontando el saldo de referidos, si lo hay). Si se desmarca la casilla, la tarjeta no se guarda y el plan solo está vigente durante el periodo pagado.',
          'Tres días antes de cada cargo automático, el Servicio envía al correo del Usuario un mensaje con el importe, la fecha del cargo y un enlace para cancelarlo. La renovación automática puede cancelarse en cualquier momento en el panel (sección «Plan»); a partir de entonces no se hacen más cargos en la tarjeta y el token guardado se elimina.',
          'El pago con Google Pay o Apple Pay no guarda la tarjeta, por lo que la renovación automática no está disponible para este tipo de pago: el plan está vigente durante el periodo pagado.',
          'El pago anual se ofrece al precio de diez meses (dos meses de regalo).',
        ],
      },
      {
        heading: '4. Devoluciones',
        paragraphs: [
          'Dado que el acceso al Servicio digital se proporciona de inmediato, el periodo pagado no es reembolsable, salvo en los casos expresamente previstos por la legislación de Ucrania en materia de protección de los derechos de los consumidores.',
          'La renovación automática puede cancelarse en cualquier momento en el panel; tras la cancelación, el plan sigue vigente hasta el final del periodo pagado y, después, se mantiene durante 14 días más el acceso completo dentro del límite del plan.',
          'Si, pasados esos 14 días, los archivos del Usuario superan el límite del plan gratuito (3 GB), las galerías se cierran para los clientes del Usuario y los archivos se conservan 60 días más; transcurrido ese plazo, se eliminan del almacenamiento sin posibilidad de recuperación. Durante esos 60 días, el Usuario tiene acceso completo a los archivos en el panel y puede descargarlos o renovar el plan, en cuyo caso las galerías se vuelven a abrir con los mismos enlaces. El Servicio avisa por correo de cada etapa (en particular, 30, 7 y 1 día antes de la eliminación). El plan gratuito, dentro de su límite, no tiene plazo de conservación.',
          'El mes gratuito del plan «Básico» por importar una galería (promoción) se concede una sola vez por cuenta; cuando termina, se aplican las mismas normas que al finalizar un periodo pagado.',
        ],
      },
      {
        heading: '5. Derechos y obligaciones del Usuario',
        paragraphs: [
          'El Usuario garantiza que tiene todos los derechos sobre el contenido (fotografías, etc.) que sube y es responsable de su legalidad, incluido el consentimiento de las personas fotografiadas para el tratamiento y la difusión de sus imágenes.',
          'El Usuario determina por sí mismo la finalidad y el alcance del tratamiento de los datos personales de sus Clientes y actúa como responsable de dichos datos; el Prestador los trata exclusivamente por encargo del Usuario (véase la Política de privacidad).',
          'Queda prohibido utilizar el Servicio para contenido ilegal, fraudulento o que vulnere los derechos de terceros.',
        ],
      },
      {
        heading: '6. Responsabilidad',
        paragraphs: [
          'El Prestador se esfuerza por que el Servicio funcione sin interrupciones, pero no garantiza la ausencia de fallos técnicos y no responde de las pérdidas causadas por fuerza mayor o por actuaciones de terceros (proveedores de alojamiento, de pagos o de comunicaciones).',
          'El Prestador no es parte de la relación entre el Usuario y sus Clientes y no responde del contenido de las galerías y las webs ni de los acuerdos relativos a las sesiones de fotos.',
        ],
      },
      {
        heading: '7. Datos personales',
        paragraphs: [
          'Los datos personales se tratan conforme a la Ley de Ucrania «Sobre la protección de datos personales» y a la Política de privacidad, que forma parte inseparable de esta oferta.',
        ],
      },
      {
        heading: '8. Vigencia y modificaciones',
        paragraphs: [
          'La oferta tiene vigencia indefinida desde su publicación. El Prestador puede modificar sus condiciones publicando una nueva versión en esta página; seguir usando el Servicio implica aceptar la nueva versión.',
        ],
      },
      {
        heading: '9. Datos del Prestador',
        paragraphs: [
          `Denominación: ${ENTITY}`,
          `Régimen fiscal: contribuyente del impuesto único, tercer grupo`,
          `Fecha de registro estatal: 04.09.2023`,
          `Domicilio: Ucrania, Ternópil (dirección completa, a petición)`,
          `Correo electrónico: ${SUPPORT_EMAIL}`,
          `Los datos completos (número de identificación fiscal RNOKPP, cuenta bancaria) se facilitan en la factura y a petición.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    updated: `Versión del ${UPDATED}`,
    intro:
      `Esta Política explica qué datos personales trata el servicio «проЯв» (${ENTITY}), con qué finalidad y sobre qué bases. Al usar el Servicio, aceptas esta Política.`,
    sections: [
      {
        heading: '1. Qué datos tratamos',
        paragraphs: [
          'Datos de la cuenta: dirección de correo electrónico, nombre o nombre de marca, ajustes del perfil.',
          'Contenido que sube el fotógrafo: fotografías e información asociada a las galerías y las webs. Estos datos pueden incluir imágenes de terceros (los Clientes del fotógrafo).',
          'Datos técnicos: registros de acceso y analítica de uso anonimizada (Google Analytics).',
          'Los datos de pago los trata el proveedor de pagos (Monobank / LiqPay); nosotros solo recibimos el estado del pago, no los datos completos de la tarjeta.',
        ],
      },
      {
        heading: '2. Funciones: responsable y encargado del tratamiento',
        paragraphs: [
          'Respecto a los datos de la cuenta del fotógrafo, el responsable es el Prestador.',
          'Respecto a los datos personales de los Clientes (incluidas las imágenes en las fotos), el responsable es el propio fotógrafo, que determina la finalidad del tratamiento. El Prestador actúa como encargado del tratamiento y trata estos datos exclusivamente por encargo del fotógrafo y para el funcionamiento del Servicio.',
        ],
      },
      {
        heading: '3. Finalidad y bases del tratamiento',
        paragraphs: [
          'Prestar las funciones del Servicio (ejecución del contrato de oferta), tramitar pagos, dar soporte a los usuarios, garantizar la seguridad y cumplir los requisitos legales.',
          'Bases jurídicas: ejecución del contrato, consentimiento del titular de los datos, intereses legítimos del Prestador y cumplimiento de obligaciones legales.',
        ],
      },
      {
        heading: '4. Comunicación de datos y subcontratistas',
        paragraphs: [
          'Trabajamos con proveedores de infraestructura de confianza: alojamiento de la aplicación y de la base de datos, almacenamiento de archivos en la nube, un proveedor de pagos y un servicio de analítica. Solo tratan los datos en la medida necesaria para prestar sus servicios.',
          'No vendemos datos personales a terceros.',
        ],
      },
      {
        heading: '5. Conservación',
        paragraphs: [
          'Los datos se conservan mientras exista la cuenta o mientras lo exija la finalidad del tratamiento o la ley. Tras eliminar la cuenta, los datos se borran o se anonimizan en un plazo razonable.',
          'Los archivos se guardan en un almacenamiento en la nube; los originales no se modifican.',
        ],
      },
      {
        heading: '6. Tus derechos',
        paragraphs: [
          'Tienes derecho a acceder a tus datos, rectificarlos, suprimirlos, limitar su tratamiento y oponerte a él, así como a retirar tu consentimiento.',
          `Para ejercer tus derechos, escribe a ${SUPPORT_EMAIL}. Si eres Cliente de un fotógrafo, dirígete en primer lugar al propio fotógrafo, como responsable de tus datos.`,
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Usamos cookies necesarias para el inicio de sesión y para guardar tus ajustes, además de cookies analíticas para entender cómo se usa el Servicio. Puedes gestionar las cookies desde los ajustes de tu navegador.',
        ],
      },
      {
        heading: '8. Contacto',
        paragraphs: [
          `Para cuestiones de privacidad: ${SUPPORT_EMAIL}. Responsable: ${ENTITY}.`,
        ],
      },
    ],
  },
}
