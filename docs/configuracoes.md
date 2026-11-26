# Configurações de aparência e conta — desenho para aprovação

> Totais históricos: os números abaixo pertencem às execuções descritas. Para o resultado vigente, consulte [validação atual](validacao-atual.md).

**Desenho aprovado em 16/11/2026 · branch `feature/configuracoes-conta` · implementação e validação em andamento.**

Base do desenho: [levantamento da Fase 1](levantamento-configuracoes.md), código `d4a6bd4`. O usuário confirmou **pt-BR e inglês** e **foto visível ao titular e a colegas com empresa compartilhada**. As seções mantêm o escopo aprovado. O registro de progresso indica quais partes já estão na branch.

## 1. Escopo e escolhas propostas

Preferências são **pessoais, por usuário**, compartilhadas entre seus workspaces e dispositivos após salvar. Não haverá tema/paleta obrigatório por empresa nesta entrega. Manter a identidade visual atual: Helvetica, superfícies claras/escuras e azul de destaque. Marketing e escolhas de cookies continuam nos fluxos existentes.

| Configuração                | Valores propostos                                           | Padrão                                                                                              |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Tema                        | Claro, escuro, sistema                                      | Sistema; importar a escolha atual do rodapé quando ainda não existir preferência explícita da conta |
| Texto                       | 100%, 110%, 125%                                            | 100%                                                                                                |
| Densidade                   | Confortável, compacta                                       | Confortável; compacta não reduz alvos de toque abaixo de 44 px                                      |
| Movimento                   | Seguir sistema, reduzir                                     | Sistema; reduzir é sempre respeitado, inclusive quando solicitado pelo sistema operacional          |
| Contraste                   | Padrão, alto                                                | Padrão; alto com tokens próprios para ambos os temas, sem remover indicadores de estado             |
| Idioma                      | Português do Brasil (`pt-BR`), English (`en`)               | pt-BR                                                                                               |
| Formatos                    | Brasileiro (`pt-BR`) nesta entrega                          | Data dd/mm/aaaa, hora 24 h, decimal com vírgula; idioma inglês não muda os formatos automaticamente |
| Fuso                        | Automático por dispositivo, manual por identificador IANA   | Automático                                                                                          |
| Página inicial do workspace | Fila em lista, fila em Kanban, última visualização          | Fila em lista                                                                                       |
| Visualização da fila        | Lista, Kanban                                               | Lista                                                                                               |
| Nome                        | Nome de exibição, 1–100 caracteres após trim                | Importar metadado válido existente; fallback neutro “Pessoa da equipe”                              |
| Foto                        | Opcional; JPEG, PNG ou WebP até **2 MiB (2.097.152 bytes)** | Sem foto; iniciais e cor estável derivada do nome                                                   |

Foto final proposta: **256 × 256 px, WebP estático**, máximo 256 KiB depois de reprocessar no servidor. Alterar nome não altera usuário, papel, e-mail nem evidências legais. Não usar foto para biometria ou verificação de identidade.

Preferências de eventos de notificação serão modeladas com padrão desligado. Controles de e-mail só aparecerão quando o consumidor de notificações da integração de e-mail estiver disponível e homologado; até lá, mostrar informação de indisponibilidade, sem botões que prometam envio. Toasts de confirmação/erro das próprias ações continuam funcionando e não dependem dessa assinatura de eventos.

## 2. Página e comportamento da interface

Entrada principal: **`/e/{slug}/configuracoes`**, acessível a qualquer usuário autorizado no workspace pelo menu e pela paleta Ctrl/Cmd + K. É configuração da própria conta, não administração da empresa.

Duas áreas: **“Aparência e idioma”** e **“Minha conta”**. Em inglês: “Appearance and language” e “My account”. Nome/foto, segurança e links para privacidade ficam na segunda área. Layout em uma coluna no celular; navegação de seções e conteúdo no desktop, sem esconder campos atrás da barra inferior.

- Aparência oferece preview imediato; o botão “Salvar preferências” persiste. “Cancelar” restaura os valores salvos. Ao falhar a gravação, reverter o preview para o último valor confirmado e manter explicação acionável e foco adequado.
- Nome é salvo separadamente com mensagem de sucesso; foto tem seleção, preview, recorte, confirmação, progresso e cancelamento próprios. Não usar preview como confirmação de upload.
- Trocar aba/página com mudanças não salvas requer aviso acessível. Não fazer PATCH a cada movimento de slider.
- Todos os formulários têm estado carregando/salvando/erro, valores preservados, prevenção de envio repetido e conflito 409 com ação para recarregar. Usar Radix e Sonner existentes.
- Foto é opcional; remoção deve ser tão fácil quanto inclusão. O avatar compartilhado trata ausência/falha da imagem como fallback, sem exibir erro técnico em cada cartão.
- A própria conta também terá entrada autenticada em **`/conta/configuracoes`**, com os mesmos componentes e sem exigir membership. Isso preserva edição/remoção da foto e acesso aos direitos depois de sair de todas as empresas. Não redirecionar essa pessoa para um workspace arbitrário.
- A paleta fora do workspace passa a incluir configurações da conta; o rodapé mantém o tema e oferece acesso à área correspondente.

Visões recentes ficam limitadas a painel/fila e variante Lista/Kanban por empresa; não armazenar URLs arbitrárias, IDs de chamados nem filtros com texto pessoal. Links explícitos e filtros da URL têm precedência sobre defaults. Configurações, cadastro de chamado, callback e links de convite não sofrem redirecionamento por preferência de home.

## 3. Internacionalização, formatos e carregamento

Escolha: **dicionários TypeScript tipados e `Intl` nativo**, com provider leve de locale, sem adicionar biblioteca de tradução nesta primeira versão. Dois idiomas não exigem alterar as rotas existentes: `/login`, `/e/...`, callbacks e convites mantêm os caminhos atuais. Usar locale da conta e espelho local; não adicionar `/en` ou mudar slugs nesta entrega.

Extrair textos de acesso, workspace, equipe, chamados, paleta, configurações, privacidade funcional, toasts, validações e rótulos acessíveis. Usar chaves estáveis e pluralização com `Intl.PluralRules`; verificar igualdade das chaves nos dois catálogos. Conteúdo dos usuários, nomes próprios, slugs, IDs e enums do banco não são traduzidos.

API preserva `error` em pt-BR para compatibilidade e adiciona `code` estável quando apropriado, permitindo que a interface apresente o equivalente inglês sem interpretar frases. Falhas desconhecidas têm mensagem localizada genérica e request ID. Schemas continuam estritos e validam os mesmos enums independentemente do idioma.

Formatadores compartilhados aplicam formato brasileiro e fuso resolvido. Datas persistidas continuam UTC/ISO 8601. Locale `en` significa idioma inglês da interface, não mudança silenciosa para mês/dia ou relógio de 12 h. Não há módulo financeiro a criar: somente preparar formatador numérico comum para valores que já existam.

Fuso automático é **por dispositivo**: detectar `Intl.DateTimeFormat().resolvedOptions().timeZone`, validar identificador IANA e manter espelho local. Se o servidor ainda não tiver um espelho válido, mostrar placeholder de data com espaço reservado até resolver o fuso; não renderizar um horário presumido e depois trocá-lo durante a hidratação. Manual persiste o IANA na conta. Nenhum fuso/locale em cookie influencia autorização.

Os termos/política versionados não serão traduzidos automaticamente como parte de uma troca de locale. A interface inglesa identifica o original jurídico em português até existir tradução revisada; blocos mantêm atributo lang correto. Mudança material de documento ou tradução jurídica exige revisão, versão e decisão própria, preservando snapshots/hashes e evidências aceitas.

### Fonte dos valores e prevenção de flash

1. Requisição autenticada valida a sessão e lê preferências próprias no servidor, sem cache público. Preferência salva na conta prevalece sobre o navegador.
2. Sem escolha explícita de tema na conta, importar a escolha local válida atual de next-themes uma única vez, mediante gravação autenticada, sem sobrescrever outro dispositivo que já salvou antes. Default ainda é sistema. A concorrência usa a versão do registro.
3. O layout aplica atributos/tokens de escala, contraste, densidade e idioma a partir dos valores resolvidos; um script mínimo com o nonce existente resolve tema sistema antes da pintura e alinha o next-themes. Não confiar em localStorage como origem de permissões.
4. Espelho de conveniência local tem versão e é separado por usuário quando autenticado. Ao entrar com outra conta, aplicar a nova preferência antes de mostrar o workspace; ao sair, limpar o espelho da conta e retornar à conveniência anônima. Não guardar nomes, caminhos ou URLs de foto em cookies de aparência.
5. Falha de leitura das preferências retorna erro de infraestrutura e opção de nova tentativa. Um eventual fallback local é identificado como temporário; não fingir que o banco devolveu defaults nem persistir por cima do registro existente.

next-themes continua responsável pelo tema; o novo provider comum controla os demais atributos. A implementação deve provar o comportamento de prepaint/hidratação, inclusive importação local e troca entre duas contas, antes do preview.

## 4. Dados, RLS e versões

| Modelo proposto                     | Campos principais                                                                                                                                                                             | Leitura/escrita                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `public.profiles`                   | user_id PK/FK auth.users, display_name, avatar_path anulável, avatar_version, updated_at, version                                                                                             | Titular e colegas com membership real compartilhada leem a projeção mínima; apenas titular altera por comando validado |
| `public.user_preferences`           | user_id PK/FK, theme, text_scale, density, contrast, motion, locale, format_locale, timezone_mode, timezone, home_view, queue_view, flags de notificação, theme_explicit, updated_at, version | Somente o próprio titular lê/altera; sem exceção para administrador geral                                              |
| `public.user_workspace_preferences` | PK user_id/organization_id, last_view, last_queue_view, updated_at, version                                                                                                                   | Próprio titular; gravar exige acesso atual ao workspace; sem preferências de terceiros na resposta                     |
| `private.avatar_intents`            | UUID, titular, caminho aleatório, digest/tamanho do arquivo normalizado, expiração, estado, versão esperada do perfil                                                                         | Sem SELECT/DML genérico do cliente; comandos autenticados e atestados pelo servidor controlam preparação/finalização   |
| `private.avatar_cleanup_jobs`       | ID do objeto/caminho, titular, motivo, tentativas, estado e timestamps                                                                                                                        | Operação restrita; não expor ao navegador nem a colegas                                                                |
| `private.account_reauth_proofs`     | Hash de prova opaca, user_id, sessão verificada, finalidade, expiração/consumo                                                                                                                | Sem leitura genérica; uso condicionado ao fluxo de e-mail descrito adiante                                             |

Perfis e preferências são distintos: ler a foto/nome de uma colega não dá acesso a idioma, fuso ou escolhas privadas dela. RLS usa `auth.uid()` e, para a leitura compartilhada de perfil/foto, **membership real comum em `memberships`**, sem reutilizar `private.role_in` com exceção global. Própria pessoa tem acesso mesmo sem empresa. Usuário sem vínculo comum recebe 404, sem confirmar se existe foto.

Mutações por comandos transacionais com validação SQL além de Zod, versionamento e `search_path` fixo. Não conceder DML genérico que permita escrever `avatar_path`, versão ou user_id pela Data API. Comandos resolvem o titular pela sessão e não aceitam user_id no payload. Políticas de escrita próprias e grants restritos devem ser testados também por acesso direto, não só pelo Next.js.

Backfill idempotente importa apenas nomes válidos dos metadados, sem promover metadados a autorização e sem copiar e-mails para nomes públicos. Cadastro posterior cria perfil/defaults pelo caminho transacional autenticado/trigger revisado. Campos enum/lista permitida e CHECKs correspondem aos schemas HTTP. Versão antiga resulta em 409. Nenhum nome de exibição altera a autoria dos eventos ou o registro legal.

Não criar configurações de empresa nesta entrega. Um administrador poderá editar somente a própria preferência; seu papel na empresa não permite alterar a conta de colegas.

## 5. Fotos: formato, processamento e Storage

### Limites e preview

Entrada: um arquivo JPEG/PNG/WebP até 2 MiB; dimensões de cada lado entre 64 e 4.096 px e no máximo 16.777.216 pixels; rejeitar SVG, GIF, animações/múltiplos frames e arquivos inválidos. MIME/extensão declarados não bastam: decodificar no servidor com limite de pixels, tempo e memória. Corpo multipart total limitado a arquivo + 64 KiB de campos/overhead; recusar partes extras e entrada truncada.

No navegador, preview com Object URL temporária, zoom/posição por controles acessíveis e área quadrada; não exigir arraste com precisão. Recorte enviado como coordenadas normalizadas limitadas, verificado de novo após aplicar a orientação no servidor. Validar os limites do original antes de a versão recortada poder esconder um arquivo excessivo. Object URLs são revogadas ao cancelar, trocar arquivo ou desmontar a tela.

No servidor Node.js: Sharp como dependência **direta fixada** após revisão do audit/licenças; orientar, validar recorte, redimensionar para 256 px, converter para sRGB e WebP estático e gerar nova saída sem preservar EXIF/GPS/XMP/IPTC. Não usar `keepMetadata`/`withMetadata` inadvertidamente. Testar bytes de saída e fixtures com GPS, não apenas o MIME. Originais permanecem em memória durante a requisição; não são armazenados no bucket. [Metadados de saída do Sharp](https://sharp.pixelplumbing.com/api-output/).

### Bucket e sessão

Bucket proposto **`profile-avatars` privado**, limite final 256 KiB, MIME `image/webp`; caminho `{auth.uid()}/{uuid-aleatorio}.webp`. Objeto imutável: sem UPDATE/upsert; trocar foto cria outro caminho. INSERT/DELETE limitados ao próprio usuário; leitura para exibição exige titular ou colega real e objeto publicado/normalizado atual. As permissões de SELECT necessárias à remoção pelo titular devem abranger também seus objetos retirados/candidatos **somente no contexto da operação de remoção**, sem permitir download/listagem desses candidatos ou de fotos antigas por colegas. Testar esse detalhe, pois DELETE com SELECT insuficiente pode impedir a limpeza pelo Storage. Negar listagem ampla, assinatura nativa de longa duração e operações de cópia/movimentação não previstas.

Upload usa **chave pública + sessão do titular**, nunca service_role. Há um desafio obrigatório: a mesma sessão pode chamar Storage diretamente. Portanto, somente permitir o próprio diretório não prova que os bytes foram normalizados pelo servidor.

Proposta para impedir publicação por esse caminho direto:

1. Após normalizar, o servidor gera caminho aleatório não exposto ao navegador e atesta uma intenção de curta duração com HMAC, vinculada a user_id, caminho, digest, tamanho, versão do perfil e expiração. Segredo de processamento fica no servidor e no Vault do banco, nunca no cliente.
2. Função SQL verifica sessão, assinatura, prazo e versão e grava a intenção privada. Não existe RPC público que conceda intenção sem atestado, nem consulta que revele intenções pendentes. RLS de INSERT no bucket exige essa intenção válida para o próprio usuário/caminho.
3. O servidor grava somente os bytes normalizados no Storage usando a sessão do usuário. Caminho/atestado não são retornados antes da conclusão. O cliente não consegue antecipar o caminho aleatório ou fabricar a autorização.
4. Finalização transacional verifica objeto, titular, intenção e versão, publica o novo caminho no perfil e consome a intenção. Caminho só fica legível a colegas depois dessa operação. Uma intenção consumida/expirada não permite reinserir objeto após remoção.
5. Confirmar upload somente quando finalização concluir. Falha remove o candidato e preserva o perfil anterior; se cleanup falhar, registrar trabalho privado e não disponibilizar o candidato como foto.

Esse protocolo deve ser provado com ataques diretos no Supabase local na Fase 3. Não tratar digest em metadata enviada pelo usuário como validação de bytes. Não liberar foto no preview se for possível obter intenção pendente, reaproveitar caminho, sobrescrever ou publicar bytes sem normalização. Atestado complementa sessão/RLS; não autoriza operar como outro usuário.

A exceção multipart no proxy/readers vale exclusivamente para a rota autenticada de upload, mantendo CSRF, quotas e limite durante streaming. Demais APIs permanecem JSON/32 KiB. Não aceitar URL remota para foto: isso introduziria SSRF e coleta de imagem fora do escopo.

### URLs assinadas e entrega da imagem

Para manter a checagem por sessão, CSP atual e TTL controlado, a proposta é **URL assinada da própria aplicação**, não URL pública do Storage:

- O servidor emite um link do mesmo domínio, com alvo, versão do avatar, viewer, expiração de **60 segundos** e HMAC com chave dedicada, distinta do atestado de upload.
- GET da imagem valida assinatura, sessão do viewer, expiração, versão e vínculo compartilhado **novamente em cada acesso**; busca o objeto no Storage com o JWT desse usuário e as políticas correspondentes. Nenhuma URL assinada é persistida no banco.
- Retorno `image/webp`, `Cache-Control: private, no-store`, nosniff; sem redirecionar para URL permanente nem expor credencial. Usar imagem sem otimizador público/compartilhado do Next.js; CSP pode continuar com img-src no mesmo domínio.
- URLs assinadas não entram em logs/query strings de observabilidade. Renovar quando necessário por chamada autenticada, sem gerar requisição para todo avatar a cada render. Se assinatura expirar ou permissão mudar, mostrar fallback e resolver novamente sob autorização.
- Acesso direto autenticado de quem já é colega pode baixar a imagem conforme RLS, mas **não deve obter assinatura nativa pública de prazo maior**. Testar as operações de Storage e filtros por operação disponíveis no ambiente; se não for possível restringir assinatura/listagem/cópia, o recurso permanece bloqueado até corrigir o desenho, sem substituir por service_role.

As funções auxiliares de Storage permitem restringir operações, mas a compatibilidade local/hospedada precisa ser conferida. [Controle de acesso](https://supabase.com/docs/guides/storage/security/access-control), [helpers](https://supabase.com/docs/guides/storage/schema/helper-functions). Uma foto já baixada pelo destinatário não pode ser recolhida do dispositivo; esse limite é informado no tratamento de privacidade.

### Troca, remoção e consistência

Depois de publicar uma versão nova, excluir a antiga via Storage API. Até terminar, uma tarefa de cleanup acompanha o objeto; a política de leitura só disponibiliza a versão atual. Remoção pelo titular bloqueia imediatamente novas leituras pela aplicação, desvincula versão e executa delete; erro de delete fica como pendência explícita com retry. Não anunciar eliminação física completa enquanto essa etapa estiver pendente.

Objetos candidatos/órfãos não publicados: expirar em uma hora, com limpeza agendada diária e alertas para pendências acima de 24 h. Cleanup após atendimento de exclusão é feito por processo administrativo separado do servidor web, seguindo as regras operacionais existentes, sem guardar refresh token do titular para tarefas futuras. Não usar DELETE SQL em storage.objects como substituto de apagar o arquivo. [Storage API de remoção](https://supabase.com/docs/guides/storage/management/delete-objects).

## 6. APIs e erros propostos

Rotas de conta independem de empresa para o titular. Resolver usuário por `getUser`, manter cookies HttpOnly/Secure/SameSite e aceite legal conforme a área, sem bloquear direitos do titular por falta de membership. Schemas Zod estritos rejeitam campos extras e valores fora das listas.

| Método/rota                                   | Entrada e resultado                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/conta/configuracoes`                | Perfil próprio, preferências e versões; sem segredos/URLs persistentes; 200                                                       |
| PATCH `/api/conta/preferencias`               | Patch tipado dos campos permitidos + version; 200 registro atualizado; 409 conflito                                               |
| PATCH `/api/conta/perfil`                     | `{displayName,version}`; 200 perfil atualizado; não aceita caminho de foto ou e-mail                                              |
| POST `/api/conta/foto`                        | Multipart: arquivo, recorte e versão esperada; 201 apenas após publicar imagem; progresso por XHR/controle acessível              |
| DELETE `/api/conta/foto`                      | Versão condicional em If-Match; 200 removida ou 202 com limpeza física pendente e status claro; operação repetida não recria foto |
| GET `/api/perfis/{userId}/foto-url`           | Titular/colega; 200 URL assinada curta ou indicação de ausência; 404 para alvo inexistente/invisível                              |
| GET `/api/perfis/{userId}/foto`               | Query assinada, versão e sessão; bytes após nova checagem; sem cache compartilhado                                                |
| PUT `/api/empresas/{slug}/minha-visualizacao` | Própria última visão com enum e versão; não altera empresa nem preferências de outro usuário                                      |

Rotas de e-mail condicionais à capacidade verificada do provedor: POST `/api/conta/reauth` recebe senha atual e emite prova em cookie HttpOnly de uso único; PATCH `/api/conta/email` recebe novo endereço e consome a prova válida para iniciar confirmação. Com flag desligada, não iniciar alteração e responder 409 com código de recurso indisponível. Adicionar limite de cinco tentativas de reautenticação por usuário a cada 15 minutos, além da proteção por origem de rede, sem registrar senha ou prova.

Sem paginação de todos os perfis: enriquecer apenas IDs autorizados presentes na página de membros, chamados e conversa, em lote limitado pelo servidor. Nunca expor um diretório global de usuários ou aceitar lista arbitrária sem RLS. Avatar compartilhado para cabeçalho, perfil, responsáveis, solicitante, comentários, atores e membros; sem imagem autorizada, fallback neutro. Quando o nome estiver adjacente, a imagem é decorativa; quando isolada, texto alternativo localizado identifica a pessoa sem expor e-mail.

Limites existentes de 120/minuto no proxy permanecem, com limites adicionais: cinco uploads/minuto por usuário, 30 alterações/minuto de preferências/perfil e 120 resoluções de foto/minuto por usuário, deduplicadas no cliente. Aplicar proteção de borda e quotas também nos comandos sensíveis; a API de Storage não deve ser considerada protegida só pelo proxy do Next.js. Ajustar por medições sem remover o limite.

400 JSON/multipart inválido; 401 sessão ausente/URL de sessão inválida; 403 CSRF/ação proibida; 404 perfil/foto invisível; 409 versão antiga; 413 bytes em excesso; 415 tipo não permitido; 422 valores, recorte ou imagem inválida; 429 limite; 503 banco/Storage indisponível. Falha de decodificação malformada não vira 503. Respostas incluem `error`, `code` estável e X-Request-Id, sem mensagens internas. Logs não incluem arquivo, EXIF, nome, e-mail, assinatura ou URL completa de foto.

## 7. Nome, e-mail, senha e privacidade

Nome muda a apresentação atual, sem alterar IDs de autoria nem evidência legal. Não regravar o histórico inteiro com nomes; resolver a projeção autorizada quando exibir. Para autor sem perfil/vínculo legível, “Pessoa da equipe”/“Team member”, sem buscar dados via chave administrativa nem usar prefixo do e-mail alheio como fallback público.

E-mail é exibido como dado da conta, não campo editável do perfil. A mudança só será habilitada depois de validar **reautenticação recente e confirmação no endereço novo** no ambiente hospedado. Fluxo proposto: verificar senha atual pela identidade obtida da sessão usando cliente temporário isolado, sem sobrescrever a sessão principal antes da conferência; conferir que o usuário retornado é o mesmo; criar prova opaca de uso único vinculada à sessão/finalidade por cinco minutos e chamar o fluxo oficial de alteração; informar “Confirmação pendente” até o Supabase confirmar. Não aceitar booleano `reauthenticated` do navegador nem registrar a senha em persistência/logs.

Não confundir `reauthenticate()`/nonce documentado para atualização de senha com prova automática de proteção da alteração de e-mail. O desenho da implementação deve verificar o que o Supabase realmente exige também na Auth API direta: uma proteção só no handler da aplicação não impede chamada direta ao provedor com a sessão. **Se a exigência não puder ser garantida no provedor e testada, e-mail permanece somente leitura nesta entrega**, com encaminhamento ao atendimento apropriado. Sem troca imediata disfarçada ou bypass da confirmação. [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthenticate).

Senha reutiliza o fluxo atual de recuperação/redefinição e `update_password`; não cria armazenamento paralelo. Exclusão direciona para `/meus-dados`, mantendo verificação de identidade, vínculos e retenções. O atendimento efetivo deve cancelar imagens pendentes, remover objetos/variantes, perfil, preferências e estado por workspace, e registrar somente evidência mínima de conclusão. A cascata da FK não substitui a Storage API.

Marketing permanece em `privacy_preferences`/`privacy_command`, com revogação acessível na configuração e no fluxo existente. Cookies opcionais usam o endpoint versionado atual, acrescentando leitura da escolha efetiva quando necessário; não misturar cookie necessário de idioma/aparência com consentimento promocional nem instalar trackers. Não criar um segundo consentimento ou nova preferência divergente.

Foto tem finalidade de identificação entre colegas, é opcional e removível. Não habilitar reconhecimento facial. Atualizar `docs/privacy-operations.md` com Storage, visibilidade, cache, prazo de candidatos e processo de exclusão. Conferir política pública e fornecedores; se houver alteração material, produzir nova versão/snapshots/hashes e aceite conforme o mecanismo existente. A base e o dever de transparência devem ser avaliados pelo responsável; a escolha de enviar foto não reutiliza autorização de marketing. Não sobrescrever os textos legais antigos nesta fase.

## 8. Aparência e acessibilidade

Centralizar `--text-scale`, tokens de fonte/entrelinha e espaçamentos, com atributos no elemento raiz e valores enumerados. Converter tamanhos textuais pertinentes em tokens/rem/calc; não aplicar zoom/transform na página nem presumir que alterar somente html.font-size resolverá os muitos px atuais. Manter campos de pelo menos 16 px no modo padrão, foco visível e áreas de toque de 44 px em qualquer densidade.

Alto contraste terá variantes clara e escura com texto normal no mínimo 4,5:1; checar também estados desabilitado/erro, links, placeholder, foco e badges. Não declarar conformidade integral WCAG por um único teste de cor. Não usar cor como única indicação de estado. Paleta de iniciais é derivada deterministicamente do nome normalizado, com combinações testadas nos dois temas; não depende da ordenação da lista.

Movimento: preferência reduzir força redução em CSS, Motion, skeletons e diálogos; sistema reduzido também é respeitado. Sem opção de forçar animações contra a preferência reduzida do sistema. Testar teclado, foco no erro, Escape, leitor de tela nos controles, recorte por controles e nomes longos em ambos os idiomas.

## 9. Plano de implementação e testes

Após aprovação, manter a branch própria e dividir commits por responsabilidade: (1) modelo/RLS/defaults/backfill; (2) APIs de perfil/preferências e versões; (3) prova de segurança de foto/Storage, processamento e cleanup; (4) providers/locale/tokens; (5) página e avatar compartilhado; (6) testes, privacidade e operação. Scanner antes de cada commit. Tipos gerados do banco local após migrações; dependências diretas de processamento fixadas e licença/audit revisados.

| Camada                     | Aceite obrigatório                                                                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitários                  | Nome Unicode/trim/limites; preferências/defaults; fallback de locale; igualdade de chaves; datas dd/mm/aaaa/24 h em fusos diferentes; números; cor/iniciais; recorte e limites de bytes/pixels; EXIF/GPS removidos                                                                  |
| SQL/RLS                    | Própria preferência versus alheia, sem exceção de admin global; colegas de empresa em comum versus outra; perda do último vínculo; manipulação de user_id/avatar_path/versão; CAS de duas gravações                                                                                 |
| Storage real local         | Upload no diretório alheio negado; original sem atestado negado; intenção adulterada/expirada/repetida negada; objeto não publicado invisível; UPDATE/cópia/listagem/assinatura nativa indevidos negados; leitura própria/colega legítima; original sem metadados nunca é publicado |
| Falhas e compensação       | Upload concluído e finalize falhando, concorrência de troca/remoção, delete indisponível, sessão expirada no upload, limpeza retomada; foto anterior preservada até publicação                                                                                                      |
| URLs de foto               | URL expirada/tamper/outro viewer/versão antiga negada; revogação de vínculo na próxima leitura; sem cache público e sem persistir URL no banco                                                                                                                                      |
| E2E desktop/celular        | Tema, escala 100/110/125, densidade, contraste, movimento, pt-BR/inglês, nome, upload/troca/remoção, reload/persistência e conflito; perfis reais no Supabase local                                                                                                                 |
| Troca de conta/dispositivo | Preferência da conta prevalece; importar tema antigo sem sobrescrever gravação concorrente; logout limpa espelho pessoal; fuso automático pode diferir por dispositivo                                                                                                              |
| Acessibilidade/visual      | 390 px e 1440 px em ambos os idiomas/temas/escalas, sem rolagem horizontal; teclado/foco/alt; controles de recorte e retorno de erro                                                                                                                                                |
| Auth e privacidade         | Senha reaproveitada, e-mail não muda sem requisitos completos; direitos sem workspace; exclusão real remove arquivo e dados próprios; cookies/marketing preservados                                                                                                                 |

As provas específicas de processamento e operações de Storage são bloqueadoras: sem elas não se libera foto nem se usa bucket público como solução provisória. Testes E2E da demonstração recebem simulação claramente identificada, sem fingir que ela comprova RLS ou upload real.

## 10. Homologação, produção e rollback

1. Conferir as seis migrações atuais e criar backup/ensaio de restauração em ambiente separado. Aplicar novas estruturas/bucket **privado** com flags off; comprovar RLS/Storage local antes de publicar funções/preview.
2. Variáveis novas: chaves dedicadas de atestado de processamento e de assinatura de URL, somente no servidor/Vault, por ambiente e com versão para rotação. Nunca usar Auth signing key ou service_role para fabricar sessão. Upload sempre usa a sessão real do titular.
3. Flags dinâmicas protegidas no banco para área de configurações, avatar e mudança de e-mail; off por padrão, alteração somente por operação autorizada e auditada. Preferências próprias não dão acesso para habilitar recursos globalmente.
4. Homologação com Supabase/bucket e credenciais separados de produção; origem preview estável para CSRF/callback. Configurar imagem sem cache compartilhado e confirmar as operações suportadas no Storage hospedado. Testar URLs, políticas e exclusão realmente no ambiente.
5. Executar lint, tipos, unitários, SQL, build e E2E contra preview. Registrar somente resultados reais, capturas e limitações. Validar os documentos legais antes de coletar fotos reais.
6. Produção fica bloqueada até concluir a Fase 6 e obter aprovação explícita do responsável pela publicação. A aprovação deste desenho autoriza somente a implementação/local/preview nas fases correspondentes, não produção.

Rollback verificável: desligar flags de novas gravações, preservar acesso aos direitos e cleanup; reverter aplicação para deploy compatível; manter schemas aditivos/perfis/preferências enquanto houver dados; negar novas URLs/leituras da foto se houver incidente, remover objetos afetados e verificar cache. Revogar chaves de URL/atestado separadamente conforme o risco, sem rotacionar Auth por engano. Nenhuma URL própria deve continuar funcionando após expirar/revogação de chave ou versão.

Remoção definitiva da funcionalidade/bucket é uma operação separada e aprovada: exportar apenas dados estritamente necessários com controle, remover fotos pela Storage API e verificar que o bucket ficou vazio, remover políticas e bucket, depois eliminar tabelas/funções sem referências e remover links/página. Não usar downgrade destrutivo como rollback rápido nem apagar dados de produção automaticamente. Registrar retenções/exceções e comprovar que exclusão física terminou.

## 11. Entrega desta fase e decisões pendentes

Produzido este desenho e atualizado `docs/progress.md`. Foram revisadas as fontes do levantamento e as documentações oficiais referidas. Verificações desta etapa: integridade do diff, scanner de segredos e documentos legais, com resultados registrados na entrega. Os testes novos acima são planejados, não executados. Sem dependência instalada, migração, upload, credencial criada, alteração legal versionada, commit/push ou deploy.

Itens para aprovação do desenho: preferências por usuário, escala/densidade/contraste, inglês com formatos brasileiros, foto de 2 MiB para WebP 256 px, protocolo de publicação com sessão/atestado, URL curta da aplicação e condição de habilitação da troca de e-mail. Nome do responsável, prazo e projeto/URL de homologação precisam ser definidos antes da publicação de preview com dados reais; a implementação local pode usar dados sintéticos.

O usuário aprovou este desenho em 16/11/2026. Essa aprovação autoriza a Fase 3 e não altera a restrição de publicação em produção.

### Preparar a homologação da branch

1. Aponte o ambiente Preview para uma instância Supabase de teste e uma origem HTTPS estável. Configure a chave pública, Redis de teste e as variáveis de foto descritas em `.env.example`.
2. Aplique as migrações na instância de teste. Cadastre o segredo de processamento no Vault e associe seu ID com `avatar_processing_key_set` pela operação administrativa. Configure uma chave diferente para a assinatura das URLs da aplicação.
3. Use `account_feature_set` pela operação administrativa para habilitar `settings` primeiro. Verifique login, nome, preferências e idioma da tela. Habilite `avatars` depois de verificar o bucket e as políticas pela API do Storage. Preserve `email_change` desligada até comprovar reautenticação e confirmação no provedor.
4. Execute a limpeza dos objetos em processo administrativo com `scripts/run-avatar-cleanup.mjs` e confirme a remoção no ambiente de teste. Acompanhe trabalhos pendentes antes de liberar o piloto.

Em 16/11/2026, a consulta `vercel env ls --environment preview` retornou uma lista vazia. O preview funcional depende de configurar a instância de teste e as variáveis desse ambiente.

O [CI do commit 836f139](https://github.com/kaua-chavesvk/equipedesk/actions/runs/43912530885/attempts/2) aprovou 99 testes unitários, SQL, acesso pela API de dados, Storage HTTP com três sessões, build, dois testes de navegador com Supabase local e 47 testes da demonstração, com um ignorado. A jornada autenticada verificou nome, tema, escala, idioma da tela, upload normalizado e remoção com invalidação da URL anterior. A tradução das demais telas e a homologação hospedada seguem pendentes. A alteração de e-mail permanece em modo de leitura.

### Ampliação aprovada em 17/11/2026

O usuário confirmou o funcionamento do cadastro e autorizou publicar as configurações no site oficial. Pediu ampliar o inglês para toda a interface e substituir os controles horizontal e vertical da foto por arraste direto.

A implementação usa um catálogo comum para português e inglês, com idioma definido no servidor e compartilhado pelos componentes. Contas autenticadas usam a preferência persistida. Visitantes usam o cookie necessário `desk_locale`, com duração de um ano. Datas acompanham o idioma selecionado e o fuso escolhido. A tradução de leitura dos documentos legais é gerada no servidor a partir da árvore estática. Os textos aceitos em português continuam referenciados pela versão original.

O recorte usa Pointer Events para mouse e toque, captura do ponteiro durante o arraste, zoom de 1 a 3 e teclas de direção. Home centraliza a posição e o botão de centralização também restaura o zoom. Prévia e servidor usam o mesmo tamanho de recorte em pixels e coordenadas normalizadas, com limites nas bordas.
