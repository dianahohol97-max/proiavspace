import type { LandingCopy } from '../copy'

/** European Portuguese (pt-PT) landing copy — translated from `en` in ../copy.ts. */
export const pt: LandingCopy = {
  nav: {
    features: 'Funcionalidades',
    galleries: 'Galerias',
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
    status: { steps: ['Sessão', 'Edição', 'Pronta'], now: 'agora', eta: 'Prevista até 14 de dezembro' },
    mockName: 'Olena Romaniuk',
    mockTitle: 'Histórias de casamento',
  },
  strip: { label: 'Trabalhos de fotógrafos' },
  products: {
    label: 'Galerias · triagem · estado da sessão',
    titleBefore: 'A galeria do cliente, feita para fotógrafos — ',
    titleAccent: 'com a sua marca',
    lede:
      'Tudo começa na galeria — é aí que o fotógrafo se encontra com os clientes todas as semanas. Novidades nas galerias: triagem de descartes, o estado da sessão para o cliente e carregamentos que resistem a falhas de ligação. Abaixo estão os ecrãs reais.',
    gallery: {
      no: '01 — Galerias',
      title: 'Entregue as sessões com elegância',
      text: 'Carregue as fotos — o cliente recebe um link bonito e descarrega tudo sozinho, sem Google Drive nem «como é que descarrego isto?». Favoritos, palavra-passe, prazo de acesso, ZIP, estatísticas.',
      tagStrong: 'Originais sem compressão.',
      tagRest: ' Os ficheiros tal como foram captados',
    },
    features: [
      {
        no: '02 — Triagem com IA',
        title: 'Os descartes são assinalados, a decisão é sua',
        text: 'Fotos desfocadas, repetições dentro de uma sequência e olhos fechados são assinalados automaticamente, e a melhor foto de cada sequência aparece ao lado das restantes. A análise corre no seu navegador — as fotos não são enviadas para lado nenhum.',
        tagStrong: 'Nada é ocultado sozinho.',
        tagRest: ' A foto só desaparece para o cliente depois de a confirmar',
        alt: 'O painel «Triagem de fotos»: marcações «Repetida» e «Desfocada» nas fotos e o filtro «Possíveis descartes»',
      },
      {
        no: '03 — Estado da sessão',
        title: 'O cliente vê em que ponto estão as fotos',
        text: 'Enquanto a galeria está vazia, o mesmo link mostra ao cliente «Sessão → Edição → Pronta» e a data prevista, se a tiver indicado. Assim que as fotos chegam, a galeria abre ali mesmo.',
        tagStrong: 'Um só interruptor no painel.',
        tagRest: ' O cliente vê as alterações de imediato',
        alt: 'O ecrã de estado para o cliente: «As suas fotos já estão a ser preparadas», a etapa «Edição» e a data prevista',
      },
      {
        no: '04 — Carregamento fiável',
        title: 'Uma falha de ligação não obriga a recomeçar',
        text: 'Os ficheiros grandes são carregados em partes de 8 MB. Se a rede falhar, o carregamento espera e continua sozinho. Se o separador fechar, escolha os mesmos ficheiros e o carregamento continua onde parou.',
        tagStrong: 'Só se repete a parte por terminar,',
        tagRest: ' não o ficheiro inteiro',
        alt: 'O carregador da galeria sem ligação: fotos já carregadas, vídeos à espera da ligação',
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
      watermark: { label: 'Marca de água', text: 'O seu nome nas pré-visualizações. Os originais ficam sem marca' },
      stats: { label: 'Estatísticas', number: '247', text: 'visualizações da galeria esta semana' },
      themes: {
        label: 'Design da galeria',
        text: 'Três ambientes, cinco disposições',
        chips: ['Mosaico', 'Colagem', 'Editorial', 'Quadrados', 'Retrato 3:4'],
      },
      previewPhoto: 'Pré-visualizações sem perder velocidade',
      slideshow: { label: 'Visualização', text: 'Visualizador em ecrã inteiro e apresentação — também no telemóvel' },
      video: {
        label: 'Vídeo',
        text: 'Vídeos ao lado das fotos, na mesma galeria — a partir do plano Básico',
      },
      languages: { label: 'Idiomas', text: 'O cliente muda a galeria para o seu idioma — são nove ao todo' },
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
        title: 'Quem decide é o fotógrafo',
        text: 'A automatização apenas sugere. Nenhuma foto é ocultada ao cliente sem a sua confirmação.',
      },
      {
        title: 'Originais intocáveis',
        text: 'Os ficheiros são guardados byte a byte. Os clientes veem pré-visualizações rápidas e descarregam em qualidade máxima.',
      },
      {
        title: 'As fotos não saem para análise',
        text: 'A triagem corre no seu navegador. As fotos não são enviadas a serviços de terceiros — até o modelo de rostos é carregado a partir do nosso próprio servidor.',
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
        note: 'Grandes arquivos e uma época movimentada',
        bullets: ['Tudo o que o Plus inclui', 'Suporte prioritário', '1 TB de armazenamento'],
      },
    },
    planCta: 'Escolher',
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
        q: 'A triagem com IA pode ocultar ou eliminar fotos sozinha?',
        a: 'Não. Apenas assinala os prováveis descartes: fotos desfocadas, repetições dentro de uma sequência, olhos fechados. Só fica oculto ao cliente o que confirmar e ocultar com o botão — os ficheiros não são eliminados e qualquer foto pode voltar a ser mostrada.',
      },
      {
        q: 'O que vê o cliente enquanto as fotos estão a ser editadas?',
        a: 'Se definir o estado da sessão, o link da galeria mostra ao cliente «Sessão → Edição → Pronta» e a data prevista, se a tiver indicado. Assim que adicionar as fotos, a galeria abre ali mesmo.',
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
