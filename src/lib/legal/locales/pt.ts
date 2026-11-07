import type { LegalCopy } from '../copy'
import { ENTITY, UPDATED } from '../entity'
import { SUPPORT_EMAIL } from '@/lib/email-layout'

/**
 * European Portuguese (pt-PT) translation of the Ukrainian legal documents.
 * Translated from the `uk` object (the legally binding version).
 */
export const pt: LegalCopy = {
  backToHome: '← Início',
  reviewNote:
    'Esta tradução é disponibilizada por conveniência. A versão juridicamente vinculativa é a ucraniana; em caso de divergência, prevalece o texto ucraniano. A tradução não cria quaisquer obrigações para além das previstas na versão ucraniana.',
  oferta: {
    title: 'Oferta pública',
    updated: `Versão de ${UPDATED}`,
    intro:
      `O presente documento constitui a proposta pública oficial (oferta) de ${ENTITY} (doravante, «Prestador») para a celebração de um contrato de acesso ao serviço online «проЯв» (doravante, «Serviço»), nas condições a seguir indicadas. Quem se registar no Serviço ou efetuar um pagamento (doravante, «Utilizador») aceita plena e incondicionalmente as condições desta oferta.`,
    sections: [
      {
        heading: '1. Definições',
        paragraphs: [
          '«Serviço» — o produto web «проЯв» (proiav.space), que disponibiliza aos fotógrafos ferramentas para galerias online de clientes, sites pessoais e receção de marcações.',
          '«Utilizador» — o fotógrafo ou outra pessoa que tenha registado uma conta no Serviço.',
          '«Cliente do Utilizador» — o terceiro a quem o Utilizador dá acesso a uma galeria ou a um formulário de marcação.',
          '«Plano» — o conjunto de funcionalidades e o volume de armazenamento disponibilizados mediante pagamento, conforme a página de preços.',
        ],
      },
      {
        heading: '2. Objeto do contrato',
        paragraphs: [
          'O Prestador concede ao Utilizador acesso às funcionalidades do Serviço nas condições do Plano escolhido, e o Utilizador obriga-se a pagar esse acesso (exceto no plano gratuito) e a cumprir as condições desta oferta.',
          'O Serviço é disponibilizado «tal como está». O Prestador desenvolve o Serviço e pode alterar o conjunto de funcionalidades, avisando antecipadamente das alterações significativas.',
        ],
      },
      {
        heading: '3. Planos e pagamento',
        paragraphs: [
          'Os preços em vigor são indicados na página de preços, em hryvnias (₴). O pagamento é efetuado com cartão de um banco ucraniano, através de um prestador de serviços de pagamento (Monobank / LiqPay); o Prestador não guarda os dados completos do cartão de pagamento.',
          'A subscrição vigora durante o período pago (um mês ou um ano) e, se a renovação automática estiver ativa, é renovada automaticamente até o Utilizador a cancelar.',
          'A renovação automática é ativada com a opção «Renovação automática», junto ao botão de pagamento na página de preços, onde são indicados o valor e a periodicidade da cobrança. Se a opção ficar assinalada, o prestador de serviços de pagamento (Monobank) guarda um token do cartão e, em cada período seguinte, é cobrado automaticamente o mesmo valor pelo plano escolhido (deduzido do crédito de recomendação, se existir). Se a opção for desmarcada, o cartão não é guardado e o plano vigora apenas durante o período pago.',
          'Três dias antes de cada cobrança automática, o Serviço envia para o e-mail do Utilizador uma mensagem com o valor, a data da cobrança e um link para cancelar. A renovação automática pode ser cancelada a qualquer momento no painel (secção «Plano»); a partir desse momento, o cartão deixa de ser cobrado e o token guardado é eliminado.',
          'Os pagamentos através do Google Pay ou do Apple Pay não guardam o cartão, pelo que a renovação automática não está disponível para estes pagamentos: o plano vigora durante o período pago.',
          'O pagamento anual corresponde ao preço de dez meses (dois meses são oferecidos).',
        ],
      },
      {
        heading: '4. Reembolsos',
        paragraphs: [
          'Uma vez que o acesso ao Serviço digital é concedido de imediato, o período pago não é reembolsável, salvo nos casos expressamente previstos na legislação da Ucrânia em matéria de defesa dos direitos dos consumidores.',
          'A renovação automática pode ser cancelada a qualquer momento no painel; após o cancelamento, o plano mantém-se até ao fim do período pago e, depois disso, o acesso total dentro do limite do plano mantém-se durante mais 14 dias.',
          'Se, decorridos estes 14 dias, os ficheiros do Utilizador excederem o limite do plano gratuito (3 GB), as galerias são fechadas aos clientes do Utilizador e os ficheiros são guardados durante mais 60 dias, sendo depois eliminados do armazenamento sem possibilidade de recuperação. Durante estes 60 dias, o Utilizador tem acesso total aos ficheiros no painel e pode descarregá-los ou renovar o plano — nesse caso, as galerias voltam a abrir nos mesmos links. O Serviço avisa por e-mail de cada etapa (nomeadamente 30, 7 e 1 dia antes da eliminação). Dentro do seu limite, o plano gratuito não tem prazo de armazenamento.',
          'O mês gratuito do plano «Básico» pela importação de uma galeria (promoção) é concedido uma única vez por conta; após o seu termo, aplicam-se as mesmas regras que no fim de um período pago.',
        ],
      },
      {
        heading: '5. Direitos e obrigações do Utilizador',
        paragraphs: [
          'O Utilizador garante que detém todos os direitos sobre o conteúdo (fotografias, etc.) que carrega e é responsável pela sua legalidade, nomeadamente pela existência do consentimento das pessoas retratadas para o tratamento e a divulgação das suas imagens.',
          'O Utilizador determina por si a finalidade e o âmbito do tratamento dos dados pessoais dos seus Clientes e é o responsável pelo tratamento desses dados; o Prestador trata-os exclusivamente por conta do Utilizador (ver a Política de Privacidade).',
          'É proibido utilizar o Serviço para conteúdos ilegais, fraudulentos ou que violem os direitos de terceiros.',
        ],
      },
      {
        heading: '6. Responsabilidade',
        paragraphs: [
          'O Prestador envida esforços para assegurar o funcionamento ininterrupto do Serviço, mas não garante a ausência de falhas técnicas nem responde por perdas causadas por força maior ou por atos de terceiros (prestadores de alojamento, de pagamentos ou de comunicações).',
          'O Prestador não é parte nas relações entre o Utilizador e os seus Clientes e não responde pelo conteúdo das galerias e dos sites nem pelos acordos relativos às sessões fotográficas.',
        ],
      },
      {
        heading: '7. Dados pessoais',
        paragraphs: [
          'O tratamento de dados pessoais é efetuado nos termos da Lei da Ucrânia «Sobre a Proteção de Dados Pessoais» e da Política de Privacidade, que faz parte integrante desta oferta.',
        ],
      },
      {
        heading: '8. Vigência e alterações',
        paragraphs: [
          'A oferta vigora por tempo indeterminado a partir da sua publicação. O Prestador tem o direito de alterar as suas condições, publicando uma nova versão nesta página; a continuação da utilização do Serviço significa a aceitação da nova versão.',
        ],
      },
      {
        heading: '9. Dados do Prestador',
        paragraphs: [
          `Designação: ${ENTITY}`,
          `Regime fiscal: contribuinte do imposto único, 3.º grupo`,
          `Data de registo estatal: 04.09.2023`,
          `Sede: Ucrânia, Ternopil (morada completa mediante pedido)`,
          `E-mail: ${SUPPORT_EMAIL}`,
          `Os dados completos (número de identificação fiscal RNOKPP, conta bancária) constam da fatura e são fornecidos mediante pedido.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidade',
    updated: `Versão de ${UPDATED}`,
    intro:
      `A presente Política explica que dados pessoais o serviço «проЯв» (${ENTITY}) trata, com que finalidade e com que fundamento. Ao utilizar o Serviço, aceita esta Política.`,
    sections: [
      {
        heading: '1. Que dados tratamos',
        paragraphs: [
          'Dados da conta: endereço de e-mail, nome/designação da marca, definições do perfil.',
          'Conteúdo carregado pelo fotógrafo: fotografias e informações associadas às galerias e aos sites. Estes dados podem incluir imagens de terceiros (os Clientes do fotógrafo).',
          'Dados técnicos: registos de acesso e análise anonimizada da utilização (Google Analytics).',
          'Os dados de pagamento são tratados pelo prestador de serviços de pagamento (Monobank / LiqPay); recebemos apenas o estado do pagamento, e não os dados completos do cartão.',
        ],
      },
      {
        heading: '2. Papéis: responsável pelo tratamento e subcontratante',
        paragraphs: [
          'Relativamente aos dados da conta do fotógrafo, o responsável pelo tratamento é o Prestador.',
          'Relativamente aos dados pessoais dos Clientes (incluindo as imagens nas fotografias), o responsável pelo tratamento é o próprio fotógrafo — é ele quem determina a finalidade do tratamento. O Prestador atua como subcontratante e trata estes dados exclusivamente por conta do fotógrafo e para o funcionamento do Serviço.',
        ],
      },
      {
        heading: '3. Finalidades e fundamentos do tratamento',
        paragraphs: [
          'Disponibilização das funcionalidades do Serviço (execução do contrato-oferta), processamento de pagamentos, apoio aos utilizadores, garantia da segurança e cumprimento de requisitos legais.',
          'Fundamentos jurídicos: execução do contrato, consentimento do titular dos dados, interesses legítimos do Prestador e cumprimento de obrigações legais.',
        ],
      },
      {
        heading: '4. Transmissão e subcontratantes',
        paragraphs: [
          'Recorremos a fornecedores de infraestrutura de confiança: alojamento da aplicação e da base de dados, armazenamento de ficheiros na nuvem, prestador de serviços de pagamento e serviço de análise. Estes tratam os dados apenas na medida necessária à prestação dos seus serviços.',
          'Não vendemos dados pessoais a terceiros.',
        ],
      },
      {
        heading: '5. Conservação',
        paragraphs: [
          'Os dados são conservados enquanto a conta existir ou enquanto a finalidade do tratamento ou a lei o exigirem. Após a eliminação da conta, os dados são eliminados ou anonimizados num prazo razoável.',
          'Os ficheiros são guardados num armazenamento na nuvem; os originais não são alterados.',
        ],
      },
      {
        heading: '6. Os seus direitos',
        paragraphs: [
          'Tem direito de acesso aos seus dados, à sua retificação e ao seu apagamento, à limitação do tratamento e de oposição ao tratamento, bem como o direito de retirar o consentimento.',
          `Para exercer estes direitos, escreva para ${SUPPORT_EMAIL}. Se for Cliente de um fotógrafo, dirija-se em primeiro lugar ao próprio fotógrafo, enquanto responsável pelo tratamento dos seus dados.`,
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Utilizamos cookies necessários para a autenticação e para guardar as definições, bem como cookies analíticos para compreender a utilização do Serviço. Pode gerir os cookies nas definições do navegador.',
        ],
      },
      {
        heading: '8. Contactos',
        paragraphs: [
          `Questões de privacidade: ${SUPPORT_EMAIL}. Responsável pelo tratamento: ${ENTITY}.`,
        ],
      },
    ],
  },
}
