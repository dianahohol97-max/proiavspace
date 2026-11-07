# pt-PT — frases a rever por um falante nativo

Formato: `chave ou local — tradução — porque há dúvida`

- landing `hero.titleBefore/titleAccent/titleAfter` — «Tudo o que acontece **depois** do clique» — slogan; «do clique» substitui «after the shutter clicks»; confirmar que soa natural e não demasiado literal.
- landing `hero.subtitle` — «Galeria online para fotógrafos: entregue a sessão ao cliente com um único link, bonito e simples.» — frase com peso de SEO; «link bonito» pode soar pouco natural.
- landing `bento.titleBefore/titleAccent` — «Os pequenos detalhes de um trabalho **tranquilo**» — o acento tem de ficar no fim da frase; verificar ritmo.
- landing `principles.items[3].title` — «Pagamento = palavra do banco» — expressão calcada do ucraniano; talvez «Pago só quando o banco confirma».
- landing `products.items[1].text` — «Nada de marcações em duplicado, e as reservas por pagar libertam-se sozinhas.» — mistura «marcação» e «reserva»; confirmar se é claro.
- landing `referral.label` / `dictionary referrals.*` — «Programa de recomendação», «Convidados» — em pt-PT também se usa «programa de referência» / «indicações»; escolher o termo mais natural.
- `referrals.cashTitle` / `withdraw` — «Disponível para levantar» / «Levantar dinheiro» — «levantar» lembra multibanco; talvez «Receber dinheiro» / «Pedir pagamento».
- `referrals.ambassadorBadge` — «Embaixador» — só no masculino; ver se é preciso forma neutra.
- `booking.*` (geral) — booking = «marcação/marcar» (pt-PT de serviços com hora marcada); confirmar que é preferível a «reserva/reservar» para sessões fotográficas.
- `booking.monoLabel` / `wfpMerchantLabel` — «Monobank Acquiring», «Conta de comerciante» — termos técnicos de pagamentos; confirmar a terminologia usada em Portugal.
- `booking.manualLabel` / landing — «mealheiro Mono» para a «banka/jar» do Monobank — o produto não existe em Portugal; ver se se entende.
- `booking.autoConfirmHint` — «dá as marcações como pagas» — confirmar fluidez.
- `galleryManage.unpublish` — «Despublicar» — usado em CMS, mas pouco elegante; alternativa «Retirar de publicação».
- `galleryManage.statsDownloads` / `pages.*Description` — «Transferências» para downloads — alternativa «Descargas» ou «Downloads».
- `galleryManage.deliveryTeaserHint` — «foto de antevisão» para «teaser frame» — confirmar.
- `site.heroLegend` / `studio.heroPhoto` — «Destaque» / «Foto de destaque» para o bloco hero — ver se «Capa do site» é mais claro.
- `site.momentLegend` — «Foto de assinatura» (signature frame) — pode soar estranho.
- `site.themeOpivnich` / `themeHint` / `momentHint` — nomes de temas transliterados («Tysha», «Opivnich (Tysha noturno)»); em `momentHint` o EN tinha «Тиша» em cirílico, aqui ficou «Tysha» para coincidir com o rótulo do tema.
- `site.heroRole` — «Quem é, p. ex. «Fotógrafa» (vazio → «Fotógrafo»)» — género: o valor por omissão `publicSite.photographer` é masculino.
- `publicSite.photographer` / client-policies `defaultName` «o Fotógrafo» — só masculino; verificar se a fotógrafa preferiria forma neutra.
- `publicSite.filmStrip` — «Fio de luzes» («Strip of lights») — contexto de um tema visual, incerto.
- `publicSite.dayInLight` — «Um dia de luz» — título editorial; ver alternativa «Um dia à luz».
- `publicSite.spread` — «Dupla página» — termo de revista; confirmar.
- `publicSite.testimonials` — «Palavras gentis» («Kind words») — pode soar a tradução; alternativa «Palavras simpáticas» / «O que dizem».
- `publicSite.bookDate` — «Consultar a sua data» — rótulo de botão, contexto pouco claro.
- `publicSite.selectedWork` — «Trabalhos escolhidos» — alternativa «Seleção de trabalhos».
- `billing.sitePlanTrial` / landing `site_trial` — «Experimental» — alternativa «Teste»; nome de plano curto.
- `billing.overviewUsed` — «{used} de {limit} usados» — concordância de género depende da unidade (GB, masc.) — ok, mas confirmar.
- culling `title` / `start` — «Triagem de fotos» / «Fazer a triagem» — termo para culling; ver se fotógrafos portugueses dizem «seleção» ou «culling».
- culling `filterFlagged` / `badgeConfirmed` — «Possíveis descartes» / «Descarte confirmado» para «reject» — confirmar o jargão.
- culling `hide*` — «Ocultar ao cliente» — alternativa «Ocultar do cliente» / «Esconder do cliente».
- legal `oferta.intro` — «Quem se registar no Serviço ou efetuar um pagamento (doravante, «Utilizador»)…» — reformulado para evitar o «você» do original («ви»); verificar estilo jurídico.
- legal `oferta` secção 9 — «Regime fiscal: contribuinte do imposto único, 3.º grupo», «número de identificação fiscal RNOKPP», «Data de registo estatal» — figuras do direito fiscal ucraniano sem equivalente exato.
- legal `privacy` secção 2 — «responsável pelo tratamento» / «subcontratante» para «володілець / розпорядник» — terminologia RGPD; a lei ucraniana usa conceitos próximos mas não idênticos.
- legal `oferta` secção 7 — «Lei da Ucrânia «Sobre a Proteção de Dados Pessoais»» — confirmar a designação habitual em português.

## Delta (release/4)

- `galleryManage.picksHint` — nomes de menus do Lightroom mantidos em inglês («Library → Text → Filename → Contains») — a Adobe só tem interface em português do Brasil; confirmar se os fotógrafos portugueses usam a versão inglesa.
- `galleryManage.favoritesTitle` — «Escolhas do cliente» (client picks = favoritos + retoque) — alternativa «Seleção do cliente».
- `galleryManage.clientEmailTitle` / `clientEmailSentAt` — «E-mail «As suas fotos estão prontas»» — aspas dentro de rótulo; confirmar legibilidade.
- `galleryManage.clientEmailUnavailable` — «migração 0066» — mensagem técnica; ok mantê-la?
- `designer.picksFavorite` / `picksRetouch` — «coração» / «retoque» como valores numa coluna CSV — confirmar.
- `designer.focusGridHint` — «ponto de foco do recorte» — terminologia de recorte.
- landing `products.features[0..2]` — títulos novos: «Os descartes são assinalados, a decisão é sua», «Uma falha de ligação não obriga a recomeçar» — verificar ritmo publicitário.
- landing `principles.items[3].title` — «As fotos não saem para análise» — confirmar naturalidade.
- landing `hero.status.eta` — «Prevista até 14 de dezembro» — data fixa de maquete.
- help `upload.items[0]` — «Sem ligação»: o rótulo real do carregador não está localizado no código (não encontrei a string); confirmar quando existir.
- help `delivery.items[1..2]` — «antevisão em fundo», «faixa no topo» (banner) — confirmar termos.

## Delta 3 (painel)

- `dashboard.galleriesCount` — `{n, plural, one {# galeria} other {# galerias}}` — passou de «Galleries: {n}» a plural; confirmar que o rótulo funciona sozinho no contexto da lista.
- `galleryManage.accessDownloadsCount` — «# transferências até agora» — «transferência» para download pode confundir-se com transferência bancária; alternativa «descargas».
- `galleryManage.tabDesign` — «Design» (igual ao inglês) — usado em pt-PT; alternativa «Aspeto».
- `galleryManage.hintGoDesign` — «Personalizar» para «Style it» — confirmar.
- `galleryManage.hintUploaded` — «As fotos já cá estão ✓» — tom coloquial; confirmar.
- `dashboard.sortUpdated` — «Alteradas recentemente» (concorda com «galerias») — confirmar.
- `publicGallery.sharePassword` — alterado para «envio-lhe a palavra-passe numa mensagem à parte» (a mensagem é do fotógrafo para o cliente, 1.ª pessoa) — confirmar tom.
- `publicGallery.shareReady` / `shareInProgress` — «Olá!» + 3.ª pessoa formal («a sua galeria») — ver se para mensagens de Telegram/WhatsApp se prefere um tom mais próximo.
