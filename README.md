# EquipeDesk

SaaS de atendimento interno em português do Brasil. Next.js App Router, React, TypeScript estrito, Tailwind CSS, Supabase Auth e PostgreSQL com RLS. A aplicação oferece uma demonstração explorável sem credenciais e uma integração com Supabase para persistência e autenticação real.

Documentação atualizada em **13/11/2026**. Os resultados abaixo registram as verificações realizadas até essa data; não representam monitoramento contínuo do serviço.

## Site publicado e estado atual

- **Produção:** [miakaelsondesk.vercel.app](https://miakaelsondesk.vercel.app).
- **Login:** [acessar a conta](https://miakaelsondesk.vercel.app/login).
- **Hospedagem:** Vercel, projeto `miakaelson.desk`.
- **Autenticação e banco:** Supabase hospedado, com as cinco migrações do projeto aplicadas.
- **Limitação de requisições:** Upstash Redis REST, recurso `miakaelson-desk-rate-limit`, plano Free, região `gru1`, com atualização automática para planos pagos desativada na criação.
- **Administrador geral:** conta solicitada pelo titular criada, e-mail confirmado e privilégio verificado em `platform_admins`. E-mail de acesso, senha e chaves administrativas não são publicados neste README.

O endereço principal direciona visitantes sem sessão para o login. O login administrativo foi testado no site e direcionou para `/aceitar-termos`; a leitura e o aceite dos termos ficaram a cargo do usuário. A validação não avançou para criação de empresa nem para operações de chamados em produção.

## Funcionalidades implementadas

| Área | Entrega |
|---|---|
| Interface | Layout para desktop e celular, espaços de trabalho por empresa, fila, indicadores, busca e filtros |
| Chamados | Abertura, detalhe, comentários, atribuição, resolução e reabertura com motivo; controle de versão para concorrência |
| Empresas e equipe | Múltiplas empresas, associações por usuário, papéis de solicitante, atendente e administrador, convites e troca de empresa |
| Administrador geral | Acesso administrativo a todas as empresas, inclusive futuras, por registro protegido no banco e script de provisionamento |
| Autenticação | Login, cadastro, recuperação e alteração de senha, callback e sessão em cookies via Supabase SSR |
| Consultas | Filtros, contagem e paginação no banco; busca, filtros e página na URL; detalhe consultado por empresa e UUID |
| Erros e validação | Schemas por ação de autenticação, erros de consulta propagados, distinção entre empresa inexistente e falha de infraestrutura, nova tentativa no carregamento da conversa |
| Privacidade | Termos e política versionados, aceite, preferências de cookies, pedidos de direitos, resumo da conta, descadastro de marketing e fila administrativa de privacidade |
| Segurança | RLS, comandos transacionais, proteção CSRF, CSP com nonce, cookies protegidos, limites de corpo e de requisições, validação do ambiente e bloqueio de caminhos privados |
| Desenvolvimento | Demonstração em memória, seed local, testes unitários, SQL e navegador, scripts de verificação e workflow de CI |

Implementação e validação são registradas separadamente: as funcionalidades disponíveis no código ainda exigem as jornadas completas com usuários reais descritas nas pendências.

## Histórico das entregas

### Melhorias de 12/11/2026

- Corrigido o aceite de convite para abrir a empresa retornada pela API, mostrar erros, mover o foco para o aviso e permitir nova tentativa.
- Validados os campos de autenticação conforme a ação; motivo de reabertura alinhado ao limite de 3–1000 caracteres.
- Corrigido o tratamento de falhas de consulta de membros, comentários e eventos, evitando apresentar falhas de infraestrutura como listas vazias.
- Adicionados filtros, contagens e paginação no servidor, com consulta de detalhe independente da página da fila. A busca aceita até 200 caracteres e trata curingas SQL como texto literal.
- Implementado o administrador geral, sem concessão desse privilégio pelo cadastro público.
- Aplicadas correções de segurança e revisão de dependências. A auditoria registrada nessa etapa caiu de 14 alertas para zero; esse resultado corresponde à execução daquela revisão.
- Implementados os fluxos de privacidade, documentos versionados, templates de e-mail, inventário de licenças e rotina administrativa de retenção. A configuração dos templates hospedados e o agendamento da retenção permanecem pendentes.

### Recuperação do site em 13/11/2026

O site retornava HTTP 503 com `{"error":"Serviço temporariamente indisponível."}`. Os logs mostravam `environment_invalid`: havia uma variável `SUPABASE_SERVICE_ROLE_KEY` no processo web e faltavam as duas variáveis do limitador Redis REST.

Foi removida a variável administrativa proibida pela validação do aplicativo. Após aceite dos termos pelo titular, foi criado e conectado o Redis gratuito, e seus valores REST foram configurados nos nomes esperados pelo projeto. A configuração de produção passou na validação, e um teste real confirmou incremento e expiração atômicos no Redis.

O deploy `dpl_CzDkCqbHQLUrvkgXZ7DcWyVJ9MQH` foi reconstruído e publicado com as novas variáveis. O site voltou a responder com HTML e HTTP 200 na tela de login. O diagnóstico e o procedimento de recuperação estão em [publicação e recuperação](docs/deploy.md).

### Banco e conta administrativa em 13/11/2026

O provisionamento identificou que o Supabase ainda não tinha as tabelas da aplicação. Após conferir as migrações pendentes com `db push --dry-run`, foram aplicadas, em ordem:

| Migração | Finalidade |
|---|---|
| `202611110001_initial.sql` | Estrutura inicial, empresas, membros, convites, chamados, comentários, eventos, RLS e comandos |
| `202611120001_platform_admins.sql` | Registro e autorização de administradores gerais |
| `202611120002_command_validation.sql` | Validações adicionais e quota de comandos |
| `202611120003_privacy.sql` | Aceites, preferências e pedidos de privacidade |
| `202611120004_retention.sql` | Estruturas e rotina administrativa de retenção |

A conta administrativa foi criada com e-mail confirmado e a senha solicitada foi definida. Foram verificados o login com a chave pública, a leitura do próprio registro de administrador e o login pelo formulário publicado. Arquivos temporários de configuração foram removidos após o uso; a senha não foi gravada nos arquivos do projeto. Consulte [administrador geral](docs/platform-admin.md) para provisionar ou revogar esse acesso.

## Reformulação do frontend em 13/11/2026

O acesso e o painel foram reformulados para uma equipe interna que usa computador e celular igualmente. A direção visual usa superfícies brancas e cinza neutro, Helvetica, azul `#002FA7`, divisórias finas e uma escala comum de componentes.

- Login, cadastro, recuperação e alteração de senha com campos de 16 px, ações maiores, mostrar/ocultar senha, textos de envio e erros com foco e preservação dos valores.
- Formulário de acesso com POST e envio habilitado após a hidratação, evitando o envio nativo dos campos pela URL antes do carregamento do JavaScript.
- Painel com títulos diretos, indicadores reais do espaço, filtros identificados e remoção de controles sem ação disponível.
- Fila em tabela no computador e em cartões com rótulos no celular, com quebra de conteúdos longos e sem depender de arrastar horizontalmente.
- Menu móvel com contenção de foco, Escape, retorno ao acionador e bloqueio do conteúdo de fundo.
- Estados de carregamento de rota, conversa e dados de privacidade; atualização da busca anunciada, limpeza de filtros e nova tentativa.
- Páginas legais, equipe, formulários e avisos usando o mesmo sistema visual; escolhas de cookies no fluxo da página, sem cobrir os campos; suporte a movimento reduzido.

Consulte a [análise de conforto e as mudanças por critério](docs/frontend-ux.md) para o diagnóstico de legibilidade, hierarquia, espaçamento, navegação, estados, fluidez e consistência. As jornadas de navegador desta etapa usam dados fictícios da demonstração e não operam os chamados reais de produção.

A reformulação foi publicada no deploy `dpl_FPTe7y5D66PYXbhXRHq1d4teFiDU`. O acesso público respondeu com HTTP 200 e o controle de mostrar e ocultar a senha funcionou em 1440 px e 390 px, com campos de 16 px, sem rolagem lateral nem erros JavaScript durante a verificação. Dos 40 cenários Playwright, 38 passaram na primeira bateria e os dois restantes passaram em reexecuções após ajustes na espera dos testes. Tipos, lint e verificação dos documentos legais também passaram. Capturas do acesso publicado em [desktop](artifacts/redesign-production-desktop.png) e [celular](artifacts/redesign-production-mobile.png).

## Tecnologias e versões

| Componente | Versão fixada |
|---|---|
| Node.js / pnpm | 24 / 11.25.0 |
| Next.js / React | 16.4.6 / 19.3.1 |
| TypeScript / Tailwind CSS | 5.9.3 / 4.1.18 |
| Supabase SSR / cliente JS | 0.12.7 / 2.119.0 |
| Zod | 4.6.7 |
| Vitest / Playwright | 5.1.0 / 1.65.0 |

O `package.json` e o `pnpm-lock.yaml` são as referências para instalação reproduzível. Para alterações no Next.js, siga o `AGENTS.md` e a documentação da versão instalada em `node_modules/next/dist/docs/`.

## Iniciar a demonstração visual

Requisitos: Node.js 24 e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem variáveis Supabase, o desenvolvimento utiliza dados de demonstração em memória. Em produção, esse modo precisa de `DEMO_MODE=true`. Reiniciar o servidor restaura os dados. Ele serve para explorar a interface; a segurança do PostgreSQL deve ser verificada no ambiente abaixo.

## Banco e autenticação locais

Instale e inicie Docker Desktop. O Supabase CLI está fixado nas dependências do projeto.

```sh
pnpm db:start
pnpm db:reset
pnpm exec supabase status
```

Copie `.env.example` para `.env.local` e preencha a URL e a chave pública exibidas por `supabase status`. Defina `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Reinicie o Next.js depois de configurar as variáveis. A aplicação usa o usuário autenticado e a chave pública; a chave administrativa nunca pertence ao navegador.

Para popular contas locais, exporte `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **apenas no terminal do script** e execute `pnpm demo:seed`. O script recusa domínios remotos. `DEMO_PASSWORD` substitui a senha padrão local `EquipeDesk-local-2026!`.

| Conta local | Aurora | Horizonte |
|---|---|---|
| marina@aurora.example | Administrador | Sem acesso |
| lucas@aurora.example | Solicitante | Sem acesso |
| bia@horizonte.example | Sem acesso | Administrador |
| rafa@compartilhado.example | Atendente | Solicitante |

Para restaurar o banco **local**, exporte `CONFIRM_LOCAL_RESET=yes` e execute `node scripts/reset-demo.mjs`. Isso aplica novamente as migrações e cria as contas. Os e-mails locais podem ser inspecionados na caixa disponibilizada pelo Supabase CLI.

## Configuração dos ambientes

Use `.env.example` como referência local. Na Vercel, configure as variáveis por ambiente e faça um novo deploy depois de alterá-las.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Origem do site; em produção, `https://miakaelsondesk.vercel.app`, sem caminho adicional |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase; nunca uma chave administrativa |
| `RATE_LIMIT_REDIS_URL` | Endpoint REST HTTPS do Redis |
| `RATE_LIMIT_REDIS_TOKEN` | Token REST com permissão de escrita; segredo exclusivo do servidor |
| `DEMO_MODE` | Demonstração explícita sem Supabase em produção; não substitui autenticação e persistência reais |
| `TRUST_PROXY` | Confiança nos cabeçalhos encaminhados; ativar somente com ingresso que os sobrescreva de forma confiável |
| `LEGAL_ENTITY_NAME`, `PRIVACY_CONTACT_EMAIL`, `LEGAL_ENTITY_CNPJ`, `LEGAL_ENTITY_ADDRESS` | Identificação pública e canal de privacidade |

A integração Upstash gerou `KV_REST_API_URL` e `KV_REST_API_TOKEN`; foram configurados os valores correspondentes em `RATE_LIMIT_REDIS_URL` e `RATE_LIMIT_REDIS_TOKEN`, que são os nomes lidos pelo aplicativo. O limitador usa Redis em produção e memória local no desenvolvimento sem Redis. Na próxima publicação, falha no Redis retornará HTTP 503 nas escritas e na rota de autenticação. Páginas e leituras seguem disponíveis com os controles de acesso.

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` pertencem somente ao processo administrativo de provisionamento. A validação atual recusa `SUPABASE_SERVICE_ROLE_KEY` no servidor web de produção. O aplicativo usa a chave pública e a sessão do usuário nas operações normais.

Mantenha bancos e variáveis separados para desenvolvimento, demonstração, preview e produção. Configure Site URL, callbacks e envio de e-mails no Supabase hospedado; a configuração local não comprova a configuração remota. Consulte [publicação](docs/deploy.md) e [operação de privacidade](docs/privacy-operations.md).

## Verificação

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm db:test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`db:test` exige Docker e Supabase local iniciados. Playwright tem projetos desktop e celular e salva traces somente em falhas. Os testes da demonstração usam contexto de navegador isolado. A CI instala com lockfile, inicia o Supabase, aplica migrações e executa as verificações. Configuração de CI não equivale a uma execução concluída; consulte a entrega para as evidências efetivamente obtidas nesta máquina.

Para regenerar os tipos a partir do banco local após uma migração, execute `pnpm db:types` e revise o diff.

## Arquitetura e contrato

Consulte [contrato HTTP](docs/api.md), [arquitetura e matriz de papéis](docs/architecture.md), [tarefas e critérios de aceite](docs/tasks.md), [publicação, recuperação e roteiro de três minutos](docs/deploy.md). Cobrança, anexos e IA permanecem no backlog.

As correções iniciadas em 12/11/2026 e suas evidências estão no [registro de melhorias](docs/progress.md).

O perfil de [administrador geral](docs/platform-admin.md) permite gerenciar todas as empresas. A criação desse acesso requer a migração correspondente e o script administrativo; o cadastro público não concede esse privilégio.

Consulte o [relatório de segurança](docs/security-report.md) antes de publicar. Produção exige HTTPS, origem canônica, Supabase e Redis REST para limitação distribuída; configuração inválida ou limitador indisponível bloqueiam o serviço. Verifique o ambiente com `node --env-file=.env.local scripts/check-env.mjs` e os padrões de segredos com `node scripts/scan-secrets.mjs`.

Os testes de regras puras verificam autoria, papéis, versão e estados de atendimento. Os testes SQL verificam a camada do banco. As jornadas de navegador verificam fluxos de interface e respostas da API. Conflitos concorrentes, convites e RLS precisam ser avaliados com PostgreSQL real; a demonstração em memória não comprova essas garantias.

### Evidências já obtidas

| Verificação | Resultado registrado |
|---|---|
| Revisão de segurança local de 12/11 | 59 testes unitários em seis arquivos; 22 cenários existentes de navegador e quatro novos de segurança aprovados após ajuste dos testes |
| Qualidade local | Lint, geração de tipos, TypeScript e build aprovados na etapa registrada |
| Build da Vercel em 13/11 | Compilação de produção, TypeScript, geração de páginas e publicação concluídos |
| Ambiente de produção | Validação aprovada após corrigir as variáveis |
| Redis real | Resposta HTTP 200 e contador com incremento e expiração atômicos funcionando |
| Site público | Redirecionamento de visitante sem sessão para login, com resposta final HTTP 200 |
| Navegador em produção | Tela de login sem erros JavaScript nem falhas HTTP de recursos; sem rolagem horizontal na verificação móvel |
| API em produção | GET em `/api/empresas` retornou 405, esperado para uma rota somente POST, passando pelo limitador |
| Migrações remotas | As cinco migrações foram aplicadas com sucesso |
| Administrador real | Login no Supabase e no site aprovado; e-mail confirmado e registro em `platform_admins` verificado; destino `/aceitar-termos` |

Os números da suíte local são evidências históricas descritas no [registro de melhorias](docs/progress.md) e no [relatório de segurança](docs/security-report.md), não uma nova execução da suíte completa em 13/11. A aplicação das migrações e o teste de login não substituem os testes SQL de isolamento e concorrência. Os documentos de 12/11 preservam o estado daquela revisão; esta seção incorpora as verificações posteriores de infraestrutura e autenticação.

Capturas da verificação publicada: [desktop](artifacts/production-login-restored.png) e [celular](artifacts/production-login-mobile-restored.png).

## Privacidade, termos e direitos

As páginas `/privacidade`, `/termos`, `/meus-dados`, `/descadastro` e `/licencas` descrevem a versão atual. O cadastro exige aceite versionado, ciência da política e autodeclaração de 18 anos ou mais; marketing é independente e desmarcado. Cookies opcionais podem ser recusados, e não há rastreadores ativos.

As migrações `202611120003_privacy.sql` e `202611120004_retention.sql` já foram aplicadas à produção em 13/11/2026. Em novos ambientes, aplique-as após as migrações anteriores. Leia [a operação de privacidade](docs/privacy-operations.md) para atendimento de pedidos, retenção, incidentes, templates de e-mail, contratos com operadores e pendências de produção. `node scripts/check-legal.mjs` verifica os snapshots dos documentos e os rodapés dos e-mails. A presença dessas páginas não comprova contratos assinados nem conformidade integral.

## Pendências e próximos passos

- Concluir o aceite dos termos pelo titular da conta administrativa e validar a entrada no workspace.
- Executar as jornadas completas no Supabase real: criação de empresa, abertura de chamado, atribuição, comentário, resolução, reabertura, convites e troca de empresa com papéis diferentes.
- Executar os testes SQL e da API de dados para RLS, acesso entre empresas, proteção do último administrador e disputas concorrentes. Esses testes não foram executados no banco remoto durante o provisionamento.
- Adicionar perfis para identificação de membros, autores e responsáveis; completar a linha do tempo unificada e a gestão de convites pendentes; revisar os limites restantes entre SQL e HTTP.
- Configurar e verificar e-mails transacionais, templates hospedados, callbacks e recuperação de senha com entrega real.
- Confirmar backups, restauração, retenção de logs, alertas e monitoramento; agendar e validar a rotina administrativa de retenção em ambiente apropriado.
- Completar os dados públicos de identificação ainda ausentes e a revisão dos contratos, operadores, licenças e procedimentos de privacidade descritos nos documentos específicos.
- Cobrança, assinaturas, anexos, IA e disparos de marketing permanecem fora da entrega atual.

O roteiro detalhado e os critérios de aceite estão em [tarefas](docs/tasks.md). A publicação do site e a criação do administrador estão concluídas; os testes completos de uso e isolamento permanecem pendentes.

## Interação e conforto no uso diário

A interface oferece visualizações Lista e Kanban, tema claro/escuro/sistema no rodapé e navegação inferior em telas pequenas. O Kanban exibe os chamados da página atual e respeita os filtros e a paginação da fila. Arraste no computador ou use os botões de ação no teclado e no toque; resolução e reabertura pedem confirmação, e a reabertura exige motivo.

As transições de chamados atualizam a interface imediatamente. Uma recusa do servidor restaura o estado anterior, informa o erro por toast e atualiza a fila. A API continua validando permissão, estado e versão do chamado. O comportamento foi coberto por teste de resposta concorrente 409; a demonstração não substitui testes de concorrência no PostgreSQL.

Use Ctrl/Cmd + K para abrir os atalhos. No workspace, a busca encontra empresas, ações e chamados da página carregada; também oferece busca na fila completa ou abertura por UUID. Fora dele, oferece os espaços de trabalho e a central de dados. Tab, setas e Enter permitem operar a paleta pelo teclado.

Os diálogos usam Radix UI para foco e fechamento por Escape. As animações respeitam a preferência por movimento reduzido, e o carregamento do workspace usa skeletons. Sonner apresenta os retornos de ações; next-themes mantém a escolha de tema no navegador e recebe o nonce da política CSP.
