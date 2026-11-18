# Descoberta da integração — Fase 1

> Totais históricos: os números abaixo pertencem às execuções descritas. Para o resultado vigente, consulte [validação atual](validacao-atual.md).

Data da revisão: **16/11/2026**, fuso America/Sao_Paulo. Repositório: [kaua-chavesvk/equipedesk](https://github.com/kaua-chavesvk/equipedesk). Base local e `origin/main` conferidas no commit `d4a6bd4716c206a1099f58243aafc974a3de783a`.

## Escopo e conclusão

O usuário definiu **e-mail** como sistema a integrar durante a descoberta. Ainda estão pendentes: direção do fluxo (entrada, saída ou ambas), provedor, caixa/domínio, resultado mensurável, responsável pela aprovação e prazo. Não foram presumidos Gmail, Microsoft 365, SMTP, IMAP ou um provedor de webhooks.

O EquipeDesk já oferece o núcleo de atendimento com sessão autenticada, isolamento por empresa, comandos transacionais, histórico e controle de versão. Os e-mails existentes são de autenticação do Supabase. **Atendimento por e-mail ainda não está implementado**: não há ingestão, envio de notificações de chamados, associação de conversas, registro idempotente de mensagens ou consumidor durável de tarefas.

Esta entrega encerra a Fase 1. A única alteração de projeto é este relatório. Não foram modificados código da aplicação, migrações, ambientes remotos, credenciais ou produção; não houve commit, push ou deploy desta revisão.

## Fontes examinadas

- `AGENTS.md`, `README.md`, `docs/api.md`, `docs/architecture.md`, `docs/tasks.md`, `docs/progress.md`, `docs/security-report.md`, `docs/deploy.md` e `docs/privacy-operations.md`.
- Complemento: `docs/architecture-maturity.md`, configuração de CI, sete Route Handlers de API, callback, proxy, validações, consultas, cache, cliente Supabase, limitador e seis migrações SQL.
- Documentação da versão instalada: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` e `01-app/03-api-reference/04-functions/unstable_cache.md`. Next.js instalado: 16.4.6. A documentação mantém `unstable_cache` disponível, mas recomenda avaliar Cache Components/`use cache` para a maioria dos casos novos; nenhuma migração de cache foi realizada.

## 1. Evidências desta execução

| Comando/verificação                                      | Resultado real nesta revisão                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                         | Aprovado; dependências já atualizadas, lockfile preservado; pnpm 11.25.0 |
| `pnpm lint`                                              | Aprovado, saída 0                                                        |
| `pnpm typecheck`                                         | Aprovado; geração de tipos de rotas e TypeScript, saída 0                |
| `pnpm test`                                              | Aprovado; **81 testes em 13 arquivos**, saída 0                          |
| `pnpm build`                                             | Aprovado; webpack, TypeScript, geração de páginas e traces, saída 0      |
| `node scripts/scan-secrets.mjs --require-history`        | Arquivos atuais e histórico inspecionados; `findings: []`                |
| `node scripts/check-legal.mjs`                           | Documentos versionados e rodapés dos seis templates conferidos           |
| `git ls-remote origin refs/heads/main`                   | SHA remoto igual ao commit local informado acima                         |
| GitHub: `repo:kaua-chavesvk/equipedesk is:issue is:open` | Nenhuma Issue aberta retornada pelo conector                             |
| GitHub: `repo:kaua-chavesvk/equipedesk is:pr is:open`    | Nenhuma Pull Request aberta retornada pelo conector                      |

O ambiente desta execução usa **Node.js 26.13.1**, inclusive em `pnpm exec node --version`; o README e a CI especificam Node.js 24. O Vitest emitiu aviso de configuração ESM carregada como CommonJS; testes e build também emitiram aviso de depreciação de `module.register()`. Esses avisos não reprovaram as verificações. A reprodução em Node.js 24 continua sendo o padrão para homologação.

Os testes SQL, testes E2E, entrega real de e-mail, serviços hospedados e um teste de falha de infraestrutura não foram executados nesta revisão. O build local não executa o verificador adicional de ambiente de produção definido em `vercel.json`; sua aprovação não comprova configuração, conectividade ou operação de produção.

O [CI de 13/11 do commit 2ad2ead](https://github.com/kaua-chavesvk/equipedesk/actions/runs/43516599266), registrado em `docs/progress.md`, contém evidência histórica de SQL, RLS pela API autenticada, um E2E administrativo com Supabase local e 47 E2E de demonstração aprovados, com um ignorado. Essa evidência é anterior e não representa uma nova execução em banco remoto nesta Fase 1.

## 2. Contrato de API encontrado no código

São sete arquivos `route.ts` sob `src/app/api/`, cobrindo 18 combinações principais de método e caminho, além do callback fora de `/api`.

### Regras comuns

- Resposta privada: `Cache-Control: private, no-store`; formato de falha dos handlers: `{ "error": "mensagem" }`. O proxy adiciona `X-Request-Id` e CSP por nonce.
- Mutações passam pelo proxy com validação de origem. Em produção, `Origin` deve corresponder à origem canônica; `Sec-Fetch-Site: cross-site` é recusado. Não existe exceção autenticada para webhook externo.
- Escritas com corpo exigem `application/json`, limitado a 32 KiB. DELETE não recebe JSON no contrato atual.
- Em produção, há 10 requisições/minuto em `/api/auth` e 120/minuto nas demais APIs. A identidade é o IP encaminhado somente com `TRUST_PROXY=true`; sem ingresso confiável, usa bucket compartilhado. Leituras também passam pelo limitador, mas podem continuar se Redis falhar; escritas e autenticação retornam 503 nessa situação. Timeout do Redis: três segundos.
- A função `desk_command` também limita comandos concluídos a 120/minuto por usuário. Falhas com rollback não consomem a quota SQL. Essa quota não cobre todas as operações de privacidade nem todas as leituras diretas.
- Sessão é gerenciada por cookies Supabase SSR; a aplicação usa chave pública e usuário autenticado. Não há chave de integração por empresa nem autenticação M2M definida.
- O proxy exige aceite legal atual antes das APIs de empresas/aceite de convites. Isso não equivale a uma política SQL de aceite para todos os clientes da Data API.
- Campos desconhecidos dos comandos são rejeitados por schemas estritos e pela função SQL. Há exceção na leitura: `queueInput` não é estrito e descarta parâmetros de consulta desconhecidos.
- Não há CORS aberto. O proxy responde OPTIONS com 405; métodos não exportados são recusados pelo Next.js. No catch-all, combinações não reconhecidas entre os métodos exportados terminam em 404. HEAD pode ser derivado de GET pelo framework.

### Autenticação

`POST /api/auth` recebe um dos objetos abaixo. Sucesso retorna 200 com `redirect` e, quando aplicável, `message`.

| `action`          | Payload adicional                                                                                                                                                             | Permissão/comportamento                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `login`           | `email`, `password` de no mínimo 8 caracteres                                                                                                                                 | Autenticação Supabase; falha do provedor normalmente é convertida em 422                                           |
| `signup`          | `email`, `password`, `name?` de 1–100 caracteres; `termsAccepted: true`, `adultConfirmed: true`, `termsVersion`, `privacyVersion`; `marketingConsent?` booleano, padrão false | Versões atuais exigidas: `2026-11-12`; cadastro não concede privilégio global                                      |
| `recover`         | `email`                                                                                                                                                                       | Solicita e-mail de recuperação; resposta genérica também quando o provedor devolve erro no resultado               |
| `update_password` | `password` de no mínimo 8 caracteres                                                                                                                                          | Exige usuário autenticado; 401 sem sessão                                                                          |
| `logout`          | Nenhum                                                                                                                                                                        | Encerra sessão; redirecionamento informado para login                                                              |
| `demo`            | Nenhum                                                                                                                                                                        | Só sem Supabase configurado; em produção também exige `DEMO_MODE=true`; retorna `/e/aurora`; 403 quando desativado |

Sem Supabase, ações reais retornam 422. Validação de entrada retorna 422; falhas inesperadas podem retornar 500. O tratamento de infraestrutura ainda não é uniforme, conforme riscos abaixo.

`GET /callback`, fora de `/api`, recebe `code` e `next?`, troca o código PKCE por sessão e retorna redirecionamento 307. O destino é validado como caminho interno; troca recusada redireciona para `/login?erro=callback`. Não é endpoint de ingestão de e-mail.

### Empresas, convites e chamados

`B` representa `/api/empresas/{slug}`. Administrador geral é resolvido pelo banco como administrador de qualquer empresa existente.

| Método e caminho                   | Entrada                                                                               | Sucesso                                 | Permissão e falhas de domínio principais                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/empresas`               | `{name,slug}`; nome 2–100, slug 2–60, letras minúsculas/números e hífens entre grupos | 201; RPC retorna `{id,slug}`            | Sessão e aceite legal; cria primeiro administrador na mesma transação; 401, 409 por duplicação, 422                                                |
| POST `/api/convites/aceitar`       | `{token}` de 32–256 caracteres                                                        | 200 `{id,slug}`                         | Sessão, aceite atual, e-mail confirmado correspondente; 401/403/404/409; 503 para determinados erros de autenticação/RPC; demonstração retorna 422 |
| GET `B/painel`                     | Sem corpo                                                                             | 200 `{open,in_progress,resolved,total}` | Membro ou administrador geral; solicitante conta apenas próprios chamados; 401/404                                                                 |
| GET `B/chamados`                   | `q`, `status`, `priority`, `page`, `pageSize`                                         | 200 `{data,total,page,pageSize}`        | Fila conforme papel; 401/404/422                                                                                                                   |
| POST `B/chamados`                  | `{title,description,priority?}`                                                       | 201, chamado criado                     | Todos os membros; autor e empresa resolvidos pelo servidor; 401/404/422/429                                                                        |
| GET `B/chamados/{id}`              | UUID no caminho                                                                       | 200 `{ticket,comments,events}`          | Solicitante apenas próprios; atendente/admin fila da empresa; 401/404                                                                              |
| POST `B/chamados/{id}/comentarios` | `{body}`                                                                              | 201; RPC retorna `{id}`                 | Mesmo acesso de leitura do chamado; 401/404/422/429                                                                                                |
| POST `B/chamados/{id}/transicoes`  | `{action,version,reason?}`                                                            | 200, chamado atualizado                 | Atribuir/resolver: atendente/admin; reabrir: quem pode ler; 401/403/404/409/422/429                                                                |
| GET `B/membros`                    | Sem corpo                                                                             | 200 `{data}`                            | Handler restringe a administrador; 401/403/404; dados reais atuais não enriquecem perfil/e-mail dos outros membros                                 |
| PATCH `B/membros/{id}`             | `{role}`; ID do usuário                                                               | 200 `{id}`                              | Administrador; 401/403/404/409/422/429; não rebaixa último administrador                                                                           |
| DELETE `B/membros/{id}`            | Sem corpo                                                                             | 200 `{id}`                              | Administrador; 401/403/404/409/429; não remove último administrador; preserva histórico                                                            |
| POST `B/convites`                  | `{email,role}`                                                                        | 201 `{id,token,expires_in_days:7}`      | Administrador; 401/403/404/422/429; gera token, não envia e-mail; demonstração retorna 422                                                         |
| DELETE `B/convites/{id}`           | Sem corpo                                                                             | 200 `{id}`                              | Administrador; 401/403/404/429; revoga convite pendente                                                                                            |

Detalhes dos campos:

- `q`: até 200 caracteres; busca literal por título/descrição, com escape de curingas SQL. `status`: `all`, `open`, `in_progress`, `resolved`. `priority`: `all`, `low`, `medium`, `high`, `urgent`.
- `page`: 1–1.000.000; `pageSize`: 1–50, padrão 10 na API e seis na interface. Ordenação: `created_at DESC, id DESC`; paginação por offset, sem cursor/contagem de alterações desde um checkpoint.
- Título: 5–160; descrição: 10–10.000; comentário: 1–5.000; motivo: 3–1.000 após trim para reabrir. Prioridade padrão: `medium`.
- `role`: `admin`, `agent`, `requester`. `version`: inteiro positivo; ações: `assign`, `resolve`, `reopen`. Atribuição exige aberto e sem responsável; resolução exige em andamento; reabertura exige resolvido e motivo. Versão antiga gera 409. Evento e alteração são transacionais.
- Empresa/recurso invisível resulta em 404 para preservar isolamento. Os status listados são os resultados previstos pelos handlers/RPC, não uma matriz novamente exercitada contra produção nesta revisão.

### Privacidade e cookies

| Método e caminho                    | Entrada/retorno                                                                                     | Permissão e falhas                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/privacidade`              | Retorna conta, aceites, preferência de marketing e até 100 pedidos/aceites, com descrição do escopo | Sessão; 401, 422 em demonstração; consultas com erro podem retornar 500                                                                    |
| POST `/api/privacidade`             | Um dos comandos abaixo                                                                              | Sessão; 200, exceto criação de pedido 201; 401/403/404/409/422/429 conforme comando                                                        |
| POST `/api/privacidade/descadastro` | `{token}` hexadecimal de 64 caracteres; 200 com mensagem genérica                                   | Token opaco, sem exigir login; continua sujeito a CSRF/origem e limitador; 422 sem Supabase; erro da RPC é convertido em erro genérico 500 |
| POST `/api/consentimento/cookies`   | `{optional:boolean}`; 200 `{saved:true}`                                                            | Não exige login; CSRF e limite comuns; grava cookie necessário HttpOnly/SameSite=Lax por 180 dias, Secure em produção                      |

Comandos de `POST /api/privacidade`:

- `accept_terms`: `termsAccepted:true`, `adultConfirmed:true`, `termsVersion`, `privacyVersion` iguais à versão atual.
- `marketing`: `enabled:boolean`; altera preferência e registra evidência; opt-in pode retornar `unsubscribe_token`.
- `request`: `kind` em `access|delete|correct|other`, `details?` até 1.000 caracteres; devolve protocolo. Recusa pedido aberto do mesmo tipo com 409 e mais de cinco pedidos/dia com 429.
- `answer`: `id` UUID, `status` em `answered|denied`, `response` de 10–2.000 caracteres; exclusivo de administrador geral. Responder um pedido de exclusão não elimina dados.

O endpoint de cookies ainda existe, mas o rodapé atual não pede consentimento para trackers opcionais inativos. Não há endpoint público dedicado a listar globalmente pedidos de privacidade; a página `/admin/privacidade` consulta o banco no servidor e exige administrador geral.

### Códigos transversais

400: corpo/JSON inválido; 401: sessão ausente/inválida; 403: CSRF, aceite exigido ou ação proibida; 404: recurso invisível/inexistente; 405: método não suportado; 409: conflito; 413: corpo excessivo; 415: mídia não aceita; 422: validação; 429: limite, com `Retry-After: 60` quando emitido pelo proxy; 500: falha não classificada; 503: configuração, autenticação, registro legal ou Redis indisponíveis nos caminhos que fazem essa classificação.

## 3. Modelo de dados e autorização

| Entidade                     | Chaves, campos e relações relevantes                                                                                                       | Autorização/retenção                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users`                 | Identidade Supabase; e-mail, confirmação e metadados                                                                                       | Senha e sessão pertencem ao provedor; referências de usuários nas entidades do produto                                                    |
| `public.organizations`       | UUID; `name`, `slug` único, `created_at`                                                                                                   | Leitura por associação ou privilégio global                                                                                               |
| `public.memberships`         | PK composta `(organization_id,user_id)`; `role`                                                                                            | Vínculo por empresa; remoção não elimina usuário/histórico; comandos protegem último administrador                                        |
| `public.invitations`         | UUID, empresa, e-mail normalizado, papel, hash único, autor, expiração, aceite e revogação                                                 | Administração por empresa; token bruto não é armazenado; uso único, validade sete dias; token_hash não recebe grant de leitura do cliente |
| `public.tickets`             | UUID, empresa, solicitante, responsável opcional, título, descrição, prioridade, estado, versão, timestamps; unique `(organization_id,id)` | Solicitante lê próprios; atendente/admin lê empresa; mutações por comando; referência para comentários/eventos                            |
| `public.comments`            | UUID, empresa, chamado, autor, texto, data; FK composta `(organization_id,ticket_id)`                                                      | Mesmo acesso de leitura do chamado; empresa não pode ser trocada para associar conteúdo de outra organização                              |
| `public.ticket_events`       | UUID, empresa, chamado, ator, tipo e payload JSONB, data; FK composta                                                                      | Mesmo acesso do chamado; eventos de criação, comentário e transições gerados atomicamente                                                 |
| `public.platform_admins`     | `user_id` PK; timestamp                                                                                                                    | Usuário consulta próprio registro; provisionamento/revogação fora do fluxo web; amplia papel efetivo a admin de todas as empresas         |
| `public.legal_acceptances`   | UUID, usuário anulável, subject_hash, tipo, versões/digests, fonte, data e delete_after                                                    | Titular ou admin geral lê; evidencia aceite/revogação                                                                                     |
| `public.privacy_preferences` | `user_id` PK, marketing, hash único de descadastro, data                                                                                   | Titular lê; RPC autenticada e descadastro por token opaco                                                                                 |
| `public.privacy_requests`    | UUID, titular anulável, subject_hash, tipo, detalhes, status, resposta, prazos                                                             | Titular/admin geral lê; apenas admin geral responde                                                                                       |
| `private.command_rate`       | PK `(user_id,window_start)`, contador                                                                                                      | Sem acesso de anon/authenticated; quota interna dos comandos de atendimento                                                               |
| `private.retention_holds`    | `ticket_id` PK, justificativa, validade                                                                                                    | Retenção administrativa; restringe descarte de chamado                                                                                    |
| `private.retention_runs`     | UUID, data e contagens de descarte                                                                                                         | Auditoria administrativa de retenção, mantida pela rotina por 90 dias                                                                     |

RLS está habilitada nas tabelas públicas da aplicação. Grants retiram escrita direta de `anon`/`authenticated` nas entidades de atendimento; `desk_command` é `SECURITY DEFINER`, usa `search_path=''` e valida `auth.uid()`, empresa, campos, papel, estado e versão. `private.role_in` e `private.can_read_ticket` resolvem acesso. `privacy_command` tem regras próprias e `unsubscribe_marketing` é executável por anon/authenticated mediante token. `run_privacy_retention` é exclusiva do processo administrativo, sem disponibilizar chave privilegiada no servidor web.

Índices cobrem memberships por usuário, fila por empresa/estado/data/UUID, fila por solicitante, comentários/eventos por chamado e convites por empresa. Os comandos bloqueiam a organização antes dos recursos. Isso protege mudanças concorrentes, mas serializa escritas da mesma empresa e precisa ser medido antes de importações volumosas.

Migrações locais, em ordem:

1. `202611110001_initial.sql`: núcleo, enums, índices, grants, RLS e comando.
2. `202611120001_platform_admins.sql`: administrador geral e resolução de papéis.
3. `202611120002_command_validation.sql`: campos permitidos, título 5–160 no comando e quota por usuário.
4. `202611120003_privacy.sql`: aceites, preferências, pedidos, comandos e triggers de evidência.
5. `202611120004_retention.sql`: retenções justificadas e rotina administrativa de descarte.
6. `202611130001_invite_preview.sql`: prévia de convite autenticada para e-mail confirmado correspondente.

O README registra cinco migrações aplicadas em produção. A presença local da sexta não comprova aplicação remota; nenhuma migração foi consultada ou aplicada no banco hospedado nesta fase.

## 4. O que existe para e-mail e o que falta

| Capacidade                                                                           | Estado encontrado                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmação, recuperação, magic link, convite Auth, troca de e-mail e reautenticação | Seis templates locais do Supabase e chamadas de Auth; configuração TOML exige confirmação e OTP de 900 segundos; entrega hospedada não verificada nesta revisão                                             |
| Convite de participação em empresa                                                   | Comando gera token e interface oferece copiar/compartilhar link; não há envio automático pelo endpoint de convites                                                                                          |
| Abertura automática por e-mail                                                       | Não implementada; sem endpoint de recebimento nem conector de caixa                                                                                                                                         |
| Respostas por e-mail como comentários                                                | Não implementadas; sem identidade/verificação do remetente e associação autorizada de conversa                                                                                                              |
| Notificações de chamado por e-mail                                                   | Não implementadas; sem provedor de saída, fila/outbox e status de entrega                                                                                                                                   |
| Duplicação, tentativas e replay                                                      | Sem `Idempotency-Key`, ledger de mensagens ou identificador externo com unicidade por integração/empresa                                                                                                    |
| Conversas e prevenção de loops                                                       | Sem armazenamento de Message-ID, In-Reply-To/References ou tratamento de respostas automáticas/bounces                                                                                                      |
| Anexos/MIME/HTML                                                                     | Uploads não existem no produto; API atual aceita JSON com texto e limite de 32 KiB; não há parser de e-mail bruto nem política de anexos                                                                    |
| Filas e worker                                                                       | Há exemplos em `docs/architecture-maturity.md`, sem tabelas/consumidor correspondentes nas migrações ou Edge Function implementada                                                                          |
| Observabilidade                                                                      | Proxy com eventos de segurança e logger em parte das APIs; Sentry e alertas externos são propostas documentadas, não integração instalada                                                                   |
| Cache                                                                                | Opt-in `TICKET_CACHE_ENABLED`; chave por empresa/usuário/papel/filtros, janela de revalidação de 20 s, invalidação por tag nas escritas HTTP de criação/transição. Estado remoto da flag não foi consultado |

Para a Fase 2, o contrato deverá definir associação da caixa à empresa, identidade de quem pode abrir/comentar, política para remetentes externos, escopo das credenciais, deduplicação, tratamento de falhas e retenção. O cabeçalho From não substitui uma sessão Supabase nem uma autorização. Não usar chave administrativa no processo web para resolver essa lacuna.

Também será necessário inventariar as categorias de dados encaminhadas ao provedor de e-mail, finalidade, controlador/operador, retenção e fornecedores. A base legal e eventuais mudanças de termos dependem do fluxo ainda não definido; este relatório não escolhe uma base nem afirma conformidade jurídica.

## 5. Riscos e bugs relevantes

As constatações abaixo vêm da inspeção estática, salvo evidência explícita. Não foram abertas Issues automaticamente.

| Prioridade            | Constatação e impacto                                                                                | Evidência/encaminhamento                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloqueador de escopo  | E-mail definido, mas direção, provedor, resultado e aprovações ainda pendentes                       | Impede escolher contrato e estimativa sem assumir requisitos                                                                                                                                                                                         |
| Alta                  | API atual é voltada a sessão/cookies e origem canônica; não oferece autenticação de conector/webhook | `src/proxy.ts`, `src/lib/supabase/server.ts`; definir identidade e autorização por empresa na Fase 2                                                                                                                                                 |
| Alta                  | Criação de chamado/comentário sem idempotência de integração pode duplicar conteúdo em retries       | Rotas de criação e SQL não têm chave externa/ledger; planejar unicidade e atomicidade antes de receber mensagens                                                                                                                                     |
| Alta                  | Infraestrutura não é sempre classificada como 503                                                    | `src/lib/http/api.ts` converte erros genéricos em 500; handlers RPC lançam `Error`; consultas lançam objetos do Supabase. Autenticação converte erros do provedor em 422; helpers de sessão podem resultar em 401. Alinhar antes do contrato externo |
| Alta                  | Recuperação pode responder sucesso mesmo com erro retornado pelo provedor                            | `src/app/api/auth/route.ts` exclui `recover` do lançamento de erro; manter proteção contra enumeração sem ocultar indisponibilidade operacional                                                                                                      |
| Alta                  | Falta comprovar migração de prévia do convite em homologação/remoto                                  | Sexta migração local versus cinco registradas no README; verificar em ambiente separado antes do fluxo real                                                                                                                                          |
| Alta para recebimento | Falta modelo de identidade do remetente e escopo da caixa                                            | Evitar autorizar por endereço From ou criar usuários/vínculos automaticamente; exige decisão explícita                                                                                                                                               |
| Média                 | Algumas mensagens de validação chegam em inglês                                                      | `failure` devolve mensagem padrão Zod; enum de prioridade inválida reproduzido localmente: `Invalid option: expected one of ...`; padronizar pt-BR                                                                                                   |
| Média                 | Desvio de runtime local                                                                              | Node 26.13.1 nesta execução versus Node 24 especificado; reproduzir homologação/CI em Node 24                                                                                                                                                        |
| Média                 | Documentos históricos misturam pendências resolvidas com estado atual                                | Exemplos: Git antes indisponível, SQL antes não executado e linha do tempo ainda pendente em trechos antigos; consultar evidências datadas e consolidar depois                                                                                       |
| Média                 | Invalidação de cache não cobre escritas externas, retenção ou futuro worker                          | Se a flag for ativada, consumidores externos precisam do protocolo de invalidação; não foi detectado vazamento entre empresas nesta revisão                                                                                                          |
| Média                 | Logs de duração não envolvem todas as rotas                                                          | `observeApi` cobre Auth, catch-all e privacidade; empresas, aceite de convite e cookies não têm esse wrapper. Não há evidência de alertas/Sentry ativos                                                                                              |
| Dependente de volume  | Paginação por offset e lock por organização                                                          | Polling e importação precisam tratar movimentação da fila; sem cursor/watermark e sem teste de carga nesta fase                                                                                                                                      |

Há ainda diferença de validação entre tabela e comando: `tickets.title` aceita 3–160 no CHECK inicial, mas HTTP e `desk_command` exigem 5–160; a regex SQL de slug aceita casos recusados pelo schema HTTP. Escritas normais pelo comando validam título, porém qualquer desenho que opere fora do mesmo contrato deverá enfrentar essas divergências sem contornar as regras existentes.

## 6. Pendências herdadas e limites da evidência

- Jornadas completas no Supabase hospedado com usuários reais: não reexecutadas; comprovar criação de empresa, chamado, atribuição, comentário, resolução/reabertura, convite e troca de empresa.
- RLS/concorrência: existem testes SQL e `scripts/test-data-api.mjs` com duas sessões em `Promise.all`, vencedor único e evento único. O resultado histórico da CI é com banco local do runner; acesso/concorrência no banco remoto seguem sem evidência desta fase.
- E-mails: confirmar provedor, SMTP/domínio, templates hospedados, callbacks, recuperação e entrega real. Templates locais não comprovam entrega.
- Operação: backups, restauração, retenção, logs, alertas e isolamento entre preview/produção precisam de evidência operacional.
- Privacidade: confirmar identificação pública e contratos de operadores; classificar o tráfego de e-mail antes de alterar documentos versionados.
- A fila de exclusão efetiva é administrativa; o pedido já retorna protocolo. Descadastro de marketing é síncrono e atômico. Não confundir exemplos de processamento assíncrono com código entregue.

## 7. Decisões para a próxima fase

1. Confirmar o fluxo de e-mail e o resultado esperado, provedor/caixa e quem poderá enviar mensagens para cada empresa.
2. Registrar responsável e prazo; a pergunta já foi enviada e permanece sem resposta nesta entrega.
3. Desenhar contrato e alternativas em `docs/integracao.md`, com mapeamento, identidade, duplicação/conflitos, dados pessoais e operação.
4. Submeter esse desenho à aprovação e aguardar antes de iniciar a Fase 3 em branch própria.

O pedido contém duas referências a liberação de produção: regra 1 exige aprovação da Fase 7; Fase 6 menciona aprovação explícita do responsável. Até consolidar esse gate, vale a restrição mais forte: **nenhuma alteração de produção nesta integração sem aprovação explícita que resolva essas condições**. A autorização antiga para deploy de melhorias visuais não é usada para esta nova integração.

Próximo passo proposto: Fase 2, após completar as definições pendentes. A Fase 1 termina com a apresentação deste relatório.
