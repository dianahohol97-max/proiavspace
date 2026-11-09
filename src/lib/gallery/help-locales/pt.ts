import type { GalleryHelp } from '../help'

/** European Portuguese (pt-PT) «How it works» blocks — translated from `en` in ../help.ts. */
export const pt: GalleryHelp = {
  culling: {
    title: 'Como funciona a triagem de fotos',
    items: [
      'Clique em «Fazer a triagem»: o navegador percorre as pré-visualizações da galeria e assinala as fotos desfocadas, as repetições dentro de uma sequência e, se a opção estiver ativa, os olhos fechados.',
      'Tudo é feito neste computador — as fotos não são enviadas para lado nenhum. Para verificar os olhos, o navegador descarrega uma única vez um modelo de rostos (~4 MB) a partir do nosso próprio servidor.',
      'As marcações são apenas sugestões. «Manter marcação» confirma o descarte; «Remover marcação» indica que a foto está boa. Em cada sequência, uma foto é marcada como a melhor — pode escolher outra.',
      'O cliente não nota nada até clicar em «Ocultar ao cliente». As fotos ocultas não são eliminadas: ficam no filtro «Ocultas ao cliente» e qualquer uma pode voltar a ser mostrada.',
      'Enquanto o separador estiver oculto, a análise fica em pausa. Pode cancelá-la — o que já foi verificado fica guardado, e as fotos novas podem ser analisadas mais tarde.',
    ],
  },
  delivery: {
    title: 'Como o cliente vê o estado',
    items: [
      'Escolha uma etapa — fica guardada de imediato. O cliente vê-a no link habitual da galeria; não é preciso outro link.',
      'Enquanto a galeria tiver menos de duas fotos visíveis para o cliente, este vê o ecrã «Sessão → Edição → Pronta». Uma única foto passa a ser a antevisão em fundo.',
      'A partir de duas fotos, a galeria abre e a etapa aparece numa faixa no topo. Com «Pronta» e «Sem estado», o cliente vê a galeria normal, sem faixa.',
      'A data é opcional: o cliente vê «prevista até …». Pode alterá-la ou removê-la a qualquer momento.',
    ],
  },
  upload: {
    title: 'O que fazer se o carregamento for interrompido',
    items: [
      'A internet foi abaixo — não faça nada e mantenha o separador aberto. Aparece «Sem ligação» e o carregamento continua sozinho assim que a rede voltar (se voltar dentro de 15 minutos).',
      'Os ficheiros grandes (mais de 16 MB) são carregados em partes de 8 MB, por isso uma falha repete apenas uma parte, e não o ficheiro inteiro.',
      'Fechou o separador ou o navegador — abra esta galeria outra vez. Por cima da área de carregamento aparece a lista dos ficheiros por terminar: escolha exatamente esses, e os grandes continuam onde pararam, enquanto os mais pequenos são carregados de novo.',
      'Um ficheiro mostra ✕ — escolha esse ficheiro outra vez. Não volte a adicionar ficheiros que já estão na galeria abaixo: seriam carregados em duplicado.',
    ],
  },
}
