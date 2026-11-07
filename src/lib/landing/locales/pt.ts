import type { LandingCopy } from '../copy'

/** European Portuguese (pt-PT) landing copy — translated from `en` in ../copy.ts. */
export const pt: LandingCopy = {
  nav: {
    features: 'Funcionalidades',
    galleries: 'Galerias',
    sites: 'Sites',
    pricing: 'Preços',
    themes: 'Temas',
    blog: 'Blog',
    signIn: 'Entrar',
    ctaShort: 'Começar grátis',
    dashboard: 'Painel',
  },
  hero: {
    chips: ['Casamentos', 'Famílias', 'Retratos', 'Estúdios'],
    titleBefore: 'Tudo o que acontece ',
    titleAccent: 'depois',
    titleAfter: ' do clique',
    subtitle: 'Galeria online para fotógrafos: entregue a sessão ao cliente com um único link, bonito e simples.',
    lede:
      'Galerias em que o cliente percebe logo como guardar as fotos — sem Google Drive nem perguntas do género «como é que descarrego isto?». Favoritos, palavra-passe e prazo de acesso, originais sem compressão. A sua marca em todo o lado.',
    cta: 'Começar grátis',
    ctaNote: '3 GB grátis, cada galeria fica aberta 30 dias. Sem cartão.',
    statNumber: '30 000',
    statText: 'fotos entregues a clientes através das galerias proiav',
    slotPay: 'Pagar ao fotógrafo',
    mockName: 'Olena Romaniuk',
    mockTitle: 'Histórias de casamento',
  },
  strip: { label: 'Trabalhos de fotógrafos' },
  products: {
    label: 'Galerias · marcações · um só painel',
    titleBefore: 'A galeria do cliente, feita para fotógrafos — ',
    titleAccent: 'com a sua marca',
    lede:
      'Tudo começa nas galerias — é aí que o fotógrafo se encontra com os clientes todas as semanas. E se quiser que os clientes escolham o horário e paguem logo, as marcações também já funcionam.',
    soon: 'Em breve',
    items: [
      {
        no: '01 — Galerias',
        title: 'Entregue as sessões com elegância',
        text: 'Carregue as fotos — o cliente recebe um link bonito e descarrega tudo sozinho, sem Google Drive nem «como é que descarrego isto?». Favoritos, palavra-passe, prazo de acesso, ZIP, estatísticas.',
        tagStrong: 'Originais sem compressão.',
        tagRest: ' Os ficheiros tal como foram captados',
      },
      {
        no: '02 — Marcações',
        title: 'O cliente escolhe o horário',
        text: 'E paga logo — Monobank, WayForPay, mealheiro ou dados bancários. Nada de marcações em duplicado, e as reservas por pagar libertam-se sozinhas.',
        tagStrong: 'O dinheiro vai diretamente para si.',
        tagRest: ' Nunca tocamos nos pagamentos',
      },
    ],
  },
  bento: {
    label: 'Tudo num só painel',
    titleBefore: 'Os pequenos detalhes de um trabalho ',
    titleAccent: 'tranquilo',
    cards: {
      selection: {
        label: 'Seleção',
        text: 'Os clientes marcam com um coração as fotos para retoque — exporte a lista de ficheiros com um clique',
      },
      galleryPhoto: 'Galeria',
      protection: { label: 'Proteção', text: 'Palavra-passe e prazo de acesso em cada galeria' },
      archive: { label: 'Arquivo', text: 'Tudo com um clique — o ZIP fica pronto sem filas de espera' },
      payments: { label: 'Pagamentos', text: 'Diretamente para o seu cartão. Sempre.' },
      stats: { label: 'Estatísticas', number: '247', text: 'visualizações da galeria esta semana' },
      themes: {
        label: 'Design da galeria',
        text: 'Três ambientes, cinco disposições',
        chips: ['Mosaico', 'Colagem', 'Editorial', 'Quadrados', 'Retrato 3:4'],
      },
      previewPhoto: 'Pré-visualizações sem perder velocidade',
      autoRelease: { label: 'Marcações', text: 'Um horário por pagar fica livre sozinho ao fim de algumas horas' },
      video: {
        label: 'Vídeos grandes',
        text: 'Carregamento por partes: uma falha de rede aos 95% custa segundos, não horas',
      },
      email: { label: 'E-mail', text: 'O aviso de nova marcação chega de imediato, com os contactos do cliente' },
    },
  },
  principles: {
    huge: 'Princípios',
    title: 'Como a plataforma funciona por dentro',
    lede: 'Não é uma lista de funcionalidades — são decisões que não voltamos a discutir.',
    items: [
      {
        title: 'A sua marca em primeiro plano',
        text: 'A partir do primeiro plano pago, as galerias nunca nos mencionam. O cliente vê apenas o fotógrafo.',
      },
      {
        title: 'O dinheiro vai direto',
        text: 'Os pagamentos das sessões entram na sua conta de comerciante ou no seu cartão. A plataforma nunca retém o seu dinheiro, nem por um segundo.',
      },
      {
        title: 'Originais intocáveis',
        text: 'Os ficheiros são guardados byte a byte. Os clientes veem pré-visualizações rápidas e descarregam em qualidade máxima.',
      },
      {
        title: 'Pagamento = palavra do banco',
        text: 'O estado «pago» só é atribuído depois da confirmação do banco — nunca com base na palavra do cliente nem num webhook por verificar.',
      },
    ],
  },
  pricing: {
    label: 'Preços',
    titleBefore: 'Preços da galeria online: ',
    titleAccent: 'pague apenas pelo espaço',
    lede:
      'A seleção de fotos pelo cliente é gratuita para todos. Os planos pagos removem a nossa marca e acrescentam vídeo e mais espaço; o Plus junta as estatísticas.',
    perMonth: '/ mês',
    freeLabel: 'sem cartão',
    yearHint: (year) => `ou ${year} ₴ por ano — dois meses grátis`,
    storage: (gb) => (gb >= 1024 ? `${gb / 1024} TB de armazenamento` : `${gb} GB de armazenamento`),
    popular: 'Recomendado',
    fineprint:
      'Pagamento com cartão de qualquer banco ucraniano. Pode cancelar a qualquer momento — tudo continua a funcionar durante mais 14 dias. Depois disso, se ultrapassar os 3 GB gratuitos, as galerias fecham aos clientes e os ficheiros são guardados durante mais 60 dias.',
    plans: {
      free: {
        name: 'Gratuito',
        note: 'Cada galeria fica aberta 30 dias — para experimentar',
        bullets: ['Seleção de fotos pelo cliente', 'Galerias com palavra-passe e prazo de acesso', 'Galerias ilimitadas'],
      },
      basic: {
        name: 'Básico',
        note: 'A sua marca — e só a sua',
        bullets: ['Sem a nossa marca', 'O seu logótipo nas galerias', 'Vídeo nas galerias'],
      },
      plus: {
        name: 'Plus',
        note: 'Para uma época de trabalho completa',
        bullets: ['Tudo o que o Básico inclui', 'Estatísticas de visualizações', 'Gorjetas dos clientes'],
      },
      pro: {
        name: 'Máximo',
        note: 'Grandes arquivos e uma agenda cheia',
        bullets: ['Tudo o que o Plus inclui', 'Suporte prioritário', '1 TB de armazenamento'],
      },
    },
    planCta: 'Escolher',
    siteTitle: 'Sites para fotógrafos',
    siteLede: 'Um site pessoal com domínio próprio, SSL e SEO. 7 dias de experiência gratuita.',
    sitePlans: {
      site_trial: { name: 'Experimental', note: '1 site durante 7 dias' },
      site_basic: { name: 'Básico', note: '1 site · domínio próprio · SSL · SEO' },
      site_plus: { name: 'Plus', note: '2+ sites · multilingue · tudo o resto igual' },
    },
    bundleNote: 'Pacote Galeria + Site — 15% de desconto no site enquanto as duas subscrições estiverem ativas.',
    soonBadge: 'Em breve',
    siteComingSoon:
      'O criador de sites para fotógrafos está em pleno desenvolvimento — chega em breve. Por agora, o foco está nas galerias: é aí que começa o trabalho com o cliente. Quer ser dos primeiros a saber do lançamento? Deixe o seu e-mail em «Começar grátis».',
  },
  referral: {
    label: 'Programa de recomendação',
    title: 'Convide colegas — e ganhe 10% de cada pagamento que fizerem',
    lede: 'Partilhe o seu link com um fotógrafo. Quando ele subscrever um plano pago, recebe 10% de cada pagamento dele em crédito — todos os meses. O crédito reduz automaticamente a sua próxima fatura.',
    steps: [
      'Copie o seu link no painel.',
      'Um colega regista-se através dele e subscreve um plano pago.',
      'Recebe 10% em crédito todos os meses — automaticamente.',
    ],
    cta: 'Obter o meu link',
  },
  faq: {
    label: 'Perguntas frequentes',
    title: 'O essencial, em poucas palavras',
    items: [
      {
        q: 'Os clientes veem que a galeria foi feita no proiav?',
        a: 'No plano gratuito, aparece uma pequena nota «Feito com proiav» no fundo da galeria. A partir do Básico, desaparece: as páginas mostram apenas o seu nome, o seu logótipo e as suas fotos.',
      },
      {
        q: 'Por onde passam os pagamentos das sessões?',
        a: 'Não passam por nós. As faturas são criadas na sua própria conta de comerciante Monobank ou WayForPay; os métodos manuais são o seu mealheiro ou o seu cartão. Nós só mostramos o botão e confirmamos o estado do pagamento junto do banco.',
      },
      {
        q: 'O que acontece aos ficheiros se eu cancelar?',
        a: 'Durante 14 dias, tudo continua a funcionar. Se couber nos 3 GB gratuitos, a conta passa simplesmente a gratuita. Se não couber, as galerias fecham aos clientes e os ficheiros são guardados durante mais 60 dias: continua a ver tudo e pode descarregar os ficheiros ou renovar o plano. Enviamos-lhe um e-mail 30, 7 e 1 dia antes da eliminação.',
      },
      {
        q: 'As minhas fotos são comprimidas?',
        a: 'Os originais são guardados byte a byte. Os clientes veem pré-visualizações geradas, mas o botão de descarregar entrega sempre o original.',
      },
    ],
  },
  final: {
    label: 'Comece com uma galeria',
    titleBefore: 'Entregue a sua próxima sessão ',
    titleAccent: 'com elegância',
    cta: 'Criar conta gratuita',
  },
  footer: {
    tagline: 'Galerias online para fotógrafos na Ucrânia',
    blog: 'Blog',
    terms: 'Oferta pública',
    privacy: 'Política de privacidade',
  },
}
