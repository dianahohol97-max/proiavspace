import type { ClientPolicyLocale } from '../clientPolicies'

/** European Portuguese (pt-PT) client policies — translated from `en` (checked against `uk`). */
export const pt: ClientPolicyLocale = {
  defaultName: 'o Fotógrafo',
  render: (name, email) => {
    const to = email ? `${email}` : 'o endereço de contacto indicado no site'
    return {
      privacy: {
        title: 'Política de Privacidade',
        blocks: [
          `Este aviso explica como ${name} (o «Fotógrafo») recolhe e utiliza os seus dados pessoais quando marca uma sessão ou consulta a sua galeria online.`,
          '# Dados que recolhemos',
          'O seu nome, contactos (telefone, e-mail, redes sociais), os dados da marcação e as próprias fotografias tiradas durante a sessão. O acesso à galeria pode utilizar uma palavra-passe e um identificador técnico de sessão.',
          '# Para que os utilizamos',
          'Para realizar a sessão e entregar-lhe as fotografias, combinar os pormenores, emitir a fatura e — com o seu consentimento — mostrar algumas fotografias num portefólio. Não vendemos os seus dados a terceiros.',
          '# Publicação de fotografias',
          'As fotografias da sua sessão não são publicadas num portefólio nem nas redes sociais sem o seu consentimento. Pode retirar o consentimento a qualquer momento, contactando-nos.',
          '# Conservação',
          'Guardamos a galeria e os ficheiros originais durante o prazo acordado no momento da marcação; depois disso, podem ser eliminados. As cópias de segurança não são guardadas por mais tempo do que o tecnicamente necessário.',
          '# Os seus direitos',
          `Pode pedir uma cópia, a retificação ou o apagamento dos seus dados, bem como retirar o consentimento para publicação. Para isso, escreva para ${to}.`,
          '# Contacto',
          `Para qualquer questão sobre os seus dados, contacte ${name}${email ? ` — ${email}` : ''}.`,
        ],
      },
      refund: {
        title: 'Condições de pagamento e reembolso',
        blocks: [
          `Estas condições abrangem o sinal, o pagamento e os reembolsos dos serviços fotográficos prestados por ${name} (o «Fotógrafo»).`,
          '# Marcação e sinal',
          'A data da sessão fica garantida após o pagamento do sinal. O sinal confirma a marcação e reserva o tempo na agenda do Fotógrafo.',
          '# Cancelamento pelo cliente',
          'Se cancelar a sessão com mais de 7 dias de antecedência, o sinal é devolvido na totalidade ou transferido para outra data. Em cancelamentos posteriores, o sinal pode ser retido como compensação pelo tempo reservado.',
          '# Cancelamento ou força maior',
          'Se a sessão não puder realizar-se por motivo imputável ao Fotógrafo ou por força maior, pode escolher entre remarcar para outra data ou receber a devolução total do sinal.',
          '# Fotografias entregues',
          'Sendo a fotografia um serviço personalizado e já prestado, o pagamento de uma sessão realizada e de fotografias editadas não é reembolsável. Se o resultado divergir substancialmente do que foi acordado, combinaremos uma revisão.',
          '# Como pedir um reembolso',
          `Para pedir um reembolso ou remarcar a sessão, escreva para ${to}. Os montantes são devolvidos pelo mesmo meio de pagamento utilizado, num prazo razoável.`,
        ],
      },
    }
  },
}
