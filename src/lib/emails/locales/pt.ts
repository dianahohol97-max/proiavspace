import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** European Portuguese (pt-PT). Translated from en.ts, checked against uk.ts. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'pt')
const galleries = (count: number) => n(count, '{n, plural, one {# galeria} other {# galerias}}')
const files = (count: number) => n(count, '{n, plural, one {# ficheiro} other {# ficheiros}}')
const days = (count: number) => n(count, '{n, plural, one {# dia} other {# dias}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Ou elimine no painel o que já não precisa, para caber nos ${freeGb} GB gratuitos — assim nada desaparece: ${then}`

const SIGN = '— proiav'

export const pt: EmailCopy = {
  hello: (name) => (name ? `Olá, ${name}!` : 'Olá!'),
  helloClient: 'Olá!',
  footerQuestions: 'Questões e faturas',
  planNames: {
    free: 'Gratuito',
    basic: 'Básico',
    plus: 'Plus',
    pro: 'Máximo',
    site_basic: 'Site Básico',
    site_plus: 'Site Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} de armazenamento para galerias`,
    galleries: 'Galerias para clientes com palavra-passe, seleção de fotos e transferência em ZIP',
    video: 'Vídeo nas galerias',
    noBranding: 'Sem a marca «proiav» nas galerias',
    logo: 'O seu logótipo nas galerias',
    stats: 'Estatísticas de visualizações e transferências',
    support: 'Suporte prioritário',
    noExpiry: 'As galerias não expiram enquanto o plano estiver ativo',
    sites: (count) => `${count} sites de portefólio`,
    site: 'Site de portefólio',
    domain: 'Domínio próprio',
  },

  receipt(v) {
    const credit = v.credit ? ` (dos quais ${v.credit} em crédito de convites)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `A renovação automática está ativa: a próxima cobrança será a ${v.nextChargeAt}, no valor de ${v.nextChargeAmount}. Enviamos um lembrete 3 dias antes. Pode cancelar a qualquer momento no painel — o período pago mantém-se até ao fim.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Não foi possível ativar a renovação automática: o pagamento com ${v.wallet} não guarda o cartão. O plano está ativo até ${v.periodEnd}. Para renovar automaticamente da próxima vez, pague com cartão e deixe assinalada a opção «Renovação automática».`
    } else {
      renewal = `A renovação automática está desativada: o plano está ativo até ${v.periodEnd}; depois disso, mantém o acesso total durante mais ${days(v.graceDays)} e, a seguir, a conta passa a gratuita.`
    }
    return {
      subject: `Recibo: ${v.amount} — plano «${v.plan}», proiav`,
      lead: ['Pagamento recebido. Obrigado por estar connosco!'],
      rows: [
        ['Plano', `«${v.plan}»${v.volume ? `, ${v.volume}` : ''}`],
        ['Valor', `${v.amount}${credit}`],
        ['Data do pagamento', v.paidAt],
        ['Período', `${v.period === 'year' ? 'ano' : 'mês'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Ativo até', v.periodEnd],
        ['Método de pagamento', v.wallet ? `${v.wallet} (${v.provider})` : `cartão, ${v.provider}`],
        ['Encomenda', v.orderId],
      ],
      list: { title: 'O que está incluído', items: v.includes },
      after: [renewal, `O comprovativo bancário é enviado em separado pelo ${v.provider}.`],
      button: { label: 'Abrir o painel', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `Dentro de ${days(v.days)} — renovação automática do plano «${v.plan}», ${v.amount}`,
      lead: [
        `A ${v.chargeAt}, vamos cobrar ${v.amount} no cartão guardado — renovação automática do plano «${v.plan}»${v.volume ? ` (${v.volume})` : ''} por ${v.period === 'year' ? 'um ano' : 'um mês'}.`,
      ],
      rows: [
        ['Plano', `«${v.plan}»`],
        ['Valor', v.amount],
        ['Data da cobrança', v.chargeAt],
      ],
      after: [
        'Se tiver crédito de convites no saldo, será tido em conta — a cobrança será menor.',
        'Não quer renovar? Cancele a renovação automática antes da data da cobrança: o período pago mantém-se até ao fim e o cartão não volta a ser cobrado.',
      ],
      button: { label: 'Cancelar renovação automática', url: `${v.billingUrl}#autopay` },
      link: { label: 'Painel e planos', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · não foi possível cobrar ${v.amount} pelo plano «${v.plan}»`,
      lines: [
        v.greeting,
        '',
        `Hoje tentámos cobrar ${v.amount} pelo plano «${v.plan}», mas o banco recusou o pagamento`,
        '(na maioria dos casos, o cartão expirou ou não tinha saldo suficiente).',
        '',
        `Nada desaparece. Até ${v.graceUntil}, tudo funciona como antes:`,
        `as galerias estão abertas aos clientes${v.volume ? `, com o limite de ${v.volume}` : ''}.`,
        '',
        `Para manter o plano sem interrupção, atualize o cartão até ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'Se não o fizer:',
        `– a partir de ${v.graceUntil}, as galerias ficam indisponíveis para os clientes (continua a vê-las e pode descarregá-las);`,
        `– a partir de ${v.deletesAt}, os ficheiros são eliminados do armazenamento.`,
        '',
        'Enviaremos lembretes 30, 7 e 1 dia antes da eliminação.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo ? 'O seu mês gratuito do plano «Básico» pela importação' : `O período pago do plano «${v.plan}»`
    return {
      subject: `proiav · o seu plano «${v.plan}» terminou — tudo funciona como antes durante ${days(v.graceDays)}`,
      lines: [
        v.greeting,
        '',
        `${what} terminou a ${v.endedAt}.`,
        '',
        `Até ${v.closesAt}, nada muda: as galerias estão abertas aos clientes,`,
        `${v.volume ? `o limite é de ${v.volume} ` : ''}e os vídeos mantêm-se.`,
        '',
        'Depois disso, se o plano não for renovado:',
        `– ${v.closesAt}: as galerias fecham aos clientes. Continua a ver tudo no painel`,
        '  e pode descarregar qualquer galeria em ZIP;',
        `– ${v.deletesAt}: os ficheiros são eliminados definitivamente do armazenamento.`,
        '',
        'Para renovar o plano basta um pagamento, e tudo volta a abrir de imediato:',
        v.billingUrl,
        '',
        `Não pretende pagar? Descarregue as galerias de que precisa antes de ${v.deletesAt} — é gratuito.`,
        fitIntoFree(v.freeGb, 'a conta passa a gratuita e as galerias continuam abertas aos clientes.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · as galerias estão fechadas aos clientes, os ficheiros são guardados até ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Hoje terminou o período de transição após o fim do plano «${v.plan}». As suas ${galleries(v.galleryCount)}`,
        'estão fechadas aos clientes: no link veem «Esta galeria está temporariamente indisponível» —',
        'no próprio idioma, aquele em que abriram a galeria.',
        '',
        'Para si, nada desapareceu: todas as galerias e ficheiros estão no seu painel. Pode',
        'descarregar gratuitamente o arquivo de qualquer galeria.',
        '',
        `Os ficheiros são guardados até ${v.deletesAt}. Depois dessa data, serão eliminados do`,
        'armazenamento e não poderão ser recuperados.',
        '',
        'Para voltar a abrir as galerias, pague um plano; ficarão disponíveis nos mesmos',
        'links, e as palavras-passe e as seleções dos clientes mantêm-se:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'os restantes ficheiros ficam, a conta passa a gratuita e as galerias voltam a abrir aos clientes.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · os ficheiros serão eliminados amanhã — último lembrete'
        : `proiav · os ficheiros serão eliminados dentro de ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Amanhã' : `Dentro de ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, a ${v.deletesAt}, vamos eliminar do armazenamento os ficheiros`,
        `das suas galerias: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'Este é o último lembrete.'] : []),
        '',
        'É definitivo — depois de eliminados, os ficheiros não podem ser recuperados.',
        '',
        'Três formas de não perder nada:',
        '1. Pague um plano — as galerias abrem de imediato aos clientes e os ficheiros ficam:',
        `   ${v.billingUrl}`,
        `2. Descarregue as galerias em ZIP antes de ${v.deletesAt} — gratuitamente, a partir do painel:`,
        `   ${v.dashboardUrl}`,
        `3. Elimine o que já não precisa para caber nos ${v.freeGb} GB gratuitos — os restantes ficheiros ficam e as galerias voltam a abrir aos clientes.`,
        `   ${v.dashboardUrl}`,
        '',
        'Se já não precisa destes ficheiros, não tem de fazer nada.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · o seu mês gratuito do plano «Básico» termina a ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `O seu mês gratuito do plano «Básico», oferecido pela importação de uma galeria, termina a ${v.endsAt}.`,
        '',
        `Para continuar no «Básico» (${v.storageGb} GB, ${v.price}/mês), ative o pagamento automático:`,
        `cobramos ${v.price} agora e o mês pago começa a ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Sem pagamento automático, depois de ${v.endsAt} tudo funciona como antes durante ${days(v.graceDays)}; depois, as galerias`,
        `fecham aos clientes e, ${days(v.retentionDays)} mais tarde, os ficheiros são eliminados do armazenamento.`,
        'Avisaremos com antecedência.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'amanhã' : `dentro de ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} fecham ${when}`
        : `proiav · a galeria «${v.galleries[0].title}» fecha ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `No plano gratuito, cada galeria fica aberta durante ${days(v.freeDays)}. ${When}, estas galerias vão fechar aos clientes:`
          : `No plano gratuito, cada galeria fica aberta durante ${days(v.freeDays)}. ${When}, esta galeria vai fechar aos clientes:`,
        ...v.galleries.map((g) => `• «${g.title}» — ${g.closesAt}`),
        '',
        `Depois de fechar, o cliente vê «Esta galeria está fechada. Contacte o seu fotógrafo.». Continua a vê-la no seu painel e, ${days(v.purgeDays)} após o fecho, os ficheiros são eliminados.`,
        '',
        `Para manter as galerias abertas sem limite de tempo, passe para o «Básico»: ${v.basicPrice}/mês, ${v.basicGb} GB, vídeo. O limite de tempo é retirado de todas as galerias logo após o pagamento:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · o seu período de parceria termina a ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Obrigado por trabalhar connosco! O seu período de parceria no plano «${v.plan}» termina a ${v.endsAt}.`,
        '',
        `Para continuar no «${v.plan}» sem interrupção, subscreva o plano com pagamento automático: ${v.priceMonth}/mês ou ${v.priceYear}/ano (dois meses grátis). Também pode escolher outro plano, a partir do «Básico», por ${v.basicPrice}/mês.`,
        v.billingUrl,
        '',
        `Se não fizer nada, a conta passa a gratuita (${v.freeGb} GB): as galerias existentes continuam disponíveis para os clientes durante mais ${days(v.freeDays)}, e cada nova galeria durante ${days(v.freeDays)} a partir da criação.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `As suas fotos estão prontas: a galeria «${v.galleryTitle}» já está aberta — pode ver as fotos, escolher as favoritas e descarregá-las.`,
    ]
    if (v.hasPassword) lead.push('A galeria está protegida por palavra-passe — o fotógrafo vai enviá-la em separado, se ainda não o fez.')
    return {
      subject: `As suas fotos estão prontas — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Fotógrafo', v.photographerName]] : undefined,
      button: { label: 'Abrir a galeria', url: v.url },
      after: [
        'Recebe este e-mail porque o fotógrafo indicou o seu endereço para ser avisado quando as fotos estivessem prontas. Se responder a este e-mail, a resposta chega ao fotógrafo.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'recompensa de convite' : 'crédito de convite'
    const yours = v.isAmbassador ? 'a sua' : 'o seu'
    return {
      subject: v.first ? `+${v.sum} — ${yours} ${v.isAmbassador ? 'primeira' : 'primeiro'} ${what}` : `+${v.sum} — ${yours} ${what}`,
      lines: [
        v.greeting,
        '',
        `Um fotógrafo que chegou através do seu link acabou de ${v.first ? 'subscrever um plano pago' : 'pagar novamente o seu plano'}.`,
        v.isAmbassador
          ? `Ganhou ${v.sum} para levantar — 10% do pagamento dele. O mesmo acontece em cada um dos primeiros ${v.cap} pagamentos.`
          : `Ganhou ${v.sum} em crédito — 10% do pagamento dele. E assim em cada pagamento que ele fizer.`,
        v.isAmbassador
          ? `Pode levantar a partir de ${v.minWithdrawal} no seu painel: ${v.link}`
          : `O crédito é aplicado automaticamente na sua próxima fatura. Saldo e link: ${v.link}`,
        '',
        'Obrigado por nos recomendar aos seus colegas.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `Nova marcação: ${v.slot}`,
      lines: [
        `Acabou de ser marcada uma sessão para ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Cliente: ${v.clientName}`,
        `Telefone: ${v.clientPhone}`,
        `E-mail: ${v.clientEmail}`,
        '',
        'Verifique o estado do pagamento no seu painel.',
      ],
    }
  },
}
