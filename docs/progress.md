# Melhorias — 12/11/2026

## Primeira etapa: convites, validação e falhas de consulta

O aceite de convite abre `/e/{slug}` usando o retorno da API, exibe a mensagem de erro recebida, move o foco para o aviso e permite tentar novamente. Há também um acesso aos espaços de trabalho.

Autenticação usa schemas estritos por ação: login e cadastro exigem e-mail e senha; recuperação exige e-mail; alteração de senha exige senha. O motivo de reabertura exige de 3 a 1000 caracteres após remover espaços externos, alinhado à função SQL existente.

Falhas nas consultas de membros, comentários e eventos são propagadas. A página distingue empresa inexistente de falha de infraestrutura, e a conversa apresenta erro com possibilidade de recarregar. A checagem de tipos gera as definições de rotas do Next.js antes de executar o TypeScript.

## Evidências executadas nesta máquina

- `pnpm test`: 33 testes passaram em 4 arquivos.
- `pnpm test:e2e`: 20 testes passaram, distribuídos entre desktop e celular.
- `pnpm lint`: passou.
- `pnpm typecheck`: passou com geração prévia dos tipos de rotas.
- `pnpm build`: passou; compilação de produção, checagem TypeScript e geração das páginas concluídas.

Os testes de navegador usam a demonstração. Nos cenários de aceite de convite, as respostas da API são simuladas para verificar navegação, apresentação de erro e nova tentativa. Os testes unitários de consulta simulam falhas do Supabase; eles não comprovam conectividade nem RLS em PostgreSQL real.

O Vitest emitiu aviso sobre carregamento ESM da configuração e depreciação de uma API do Node. O navegador também registrou aviso de hidratação envolvendo o estilo `caret-color: transparent` durante a captura de tela automatizada; os testes passaram, mas esse aviso permanece para revisão.

## Continuação

O acompanhamento das próximas melhorias está em [tasks.md](tasks.md). Ao final da primeira etapa, estavam pendentes paginação e filtros no banco, perfis de membros, revisão dos demais limites SQL/HTTP, histórico unificado e convites pendentes. A segunda etapa está registrada abaixo. A validação com Supabase real e os testes SQL não foram executados nesta etapa. Nenhuma migração de banco foi alterada.

## Segunda etapa: fila paginada no servidor

A integração Supabase passou a executar busca por título e descrição, filtros de estado e prioridade, contagem exata e seleção da faixa da página no banco. O workspace não carrega mais toda a tabela de chamados. Os contadores fazem consultas com `head: true`, sem transferir as linhas. A consulta de detalhe usa diretamente empresa e UUID, sem depender da página ou dos filtros da fila.

A interface recebe somente os chamados da página, mostra os totais devolvidos pelo servidor e mantém busca, filtros e página na URL. A paginação apresenta no máximo cinco botões numerados. A busca tem limite de 200 caracteres e trata curingas SQL como texto literal. A API preserva o padrão de dez itens por página; a interface usa seis.

As consultas usam o cliente autenticado existente e continuam sujeitas à RLS. Não houve alteração de esquema, grants ou políticas de acesso. A execução com PostgreSQL real permanece pendente; os testes unitários verificam a composição das consultas e simulam contagens superiores a mil registros.

Verificações desta etapa: 41 testes unitários passaram em cinco arquivos; os 20 cenários de navegador anteriores passaram, assim como dois novos cenários de paginação e persistência da busca, em desktop e celular. `pnpm typecheck` e `pnpm lint` passaram. A captura de tela automatizada passou a preservar o cursor, evitando a alteração de estilo durante a hidratação observada na etapa anterior.

`pnpm build` também passou, com compilação de produção, TypeScript e geração de páginas concluídos.

## Terceira etapa: administrador geral

Foi adicionada uma migração para o registro `platform_admins`, consultado pela autorização de leitura e pelos comandos existentes. O administrador geral vê todas as empresas, sem precisar de memberships locais. A interface identifica o papel e o script `pnpm admin:provision` permite criar a conta e atribuir o privilégio usando credenciais exclusivamente administrativas no ambiente do processo.

O cadastro público não concede privilégios globais, usuários não podem promover a própria conta e a revogação do registro remove o acesso global nas operações seguintes. Há nove verificações SQL para esses cenários, ainda pendentes de execução em Supabase real. Os 43 testes unitários, a checagem de tipos e o lint passaram. A conta solicitada ainda não foi criada: o ambiente não possui URL nem chave administrativa do Supabase configuradas. Senhas não foram gravadas no código ou nesta documentação.

## Revisão de segurança

O [relatório de segurança](security-report.md) registra os 21 itens solicitados e os cinco complementos, falhas encontradas, correções, evidências e pendências externas. A auditoria de dependências caiu de 14 alertas para zero. Passaram 59 testes unitários, 22 cenários existentes de navegador e quatro cenários novos de segurança após ajuste dos testes, além de tipos, lint e build. O teste com servidor de produção confirmou recusa 503 quando faltam as configurações obrigatórias. SQL real, serviços externos e histórico Git continuam sem validação neste ambiente.

## Ciclo de correções de 13/11/2026

| Prioridade | Correção no workspace | Regressão |
|---|---|---|
| Alta | Páginas e leituras continuam durante falhas do Redis. Escritas continuam bloqueadas e a checagem de publicação exige Redis. | [Proxy e configuração](../tests/unit/security.test.ts) |
| Alta | Caminhos de retorno passam pela validação de camadas codificadas. | [Redirecionamentos](../tests/unit/security.test.ts) |
| Alta | Prévia de convite para e-mail confirmado correspondente, com empresa, papel e mensagens por situação. O aceite substitui a entrada de navegação do convite. | [Isolamento e convites no PostgreSQL](../supabase/tests/isolation.test.sql) |
| Média | Requisições ao Supabase têm limite de oito segundos e preservam o cancelamento do chamador. | [Tempo limite](../tests/unit/supabase-fetch.test.ts) |
| Média | A conversa intercala comentários com eventos persistidos e elimina a duplicação do registro de comentário. | [Linha do tempo](../tests/unit/conversation-timeline.test.ts) |
| Média | Acesso com título neutro e rodapé legal sem pedir escolha de cookies opcionais inativos. | [Jornadas do navegador](../tests/e2e/journey.spec.ts) |

### Executado

- Seis cenários Playwright selecionados passaram em desktop e celular após corrigir o clique antes da hidratação do convite. O aceite usa respostas simuladas nessa suíte.
- 72 testes unitários em nove arquivos. Lint, tipos e build local concluídos durante o ciclo.
- Verificador pré-build simulado localmente. Em produção simulada, identificou variáveis obrigatórias ausentes.

- Consulta de leitura às variáveis Vercel sem imprimir valores. DEMO_MODE não constava em produção.
- Auditoria de dependências sem vulnerabilidades conhecidas na consulta realizada. Verificação dos documentos legais e varredura dos arquivos concluídas. O histórico Git está indisponível neste checkout.
- Tentativa de executar pnpm db:test. A conexão local na porta 54322 foi recusada e o Docker não está disponível nesta sessão.

### Configurado ou pendente

- O build de produção da Vercel passa pela checagem de ambiente no próximo deploy. O workflow de CI já inclui lint, tipos, testes unitários, SQL, build e navegador. A execução remota desse workflow e a publicação ficaram fora desta etapa.
- O teste de RLS, concorrência real entre sessões, último administrador e aceite no PostgreSQL aguardam banco local ou staging. O prazo existente dos convites é de sete dias. A entrada inicial ainda contém o token. O cabeçalho no-referrer e a substituição da entrada após o aceite reduzem a exposição no navegador. A consulta inicial ainda pode aparecer nos logs da infraestrutura.
- Perfis, gestão de convites pendentes, entrega real de e-mails, configuração hospedada de callbacks, testes de volume e rede lenta com sessão real permanecem pendentes.
- Retenção, restauração, monitoramento externo e alertas de Redis, HTTP 503, autenticação e latência dependem de ambiente e acesso apropriados. A revisão de identificação e contratos requer os dados do titular.
- EquipeDesk é a marca exibida no produto. O domínio e o nome do projeto Vercel são identificadores de infraestrutura da instalação existente. O slug da empresa identifica seu espaço.

## Conforto e interação — 13/11/2026

- Tema claro, escuro e sistema com preferência persistida e nonce CSP; seletor sem divergência de hidratação.
- Lista/Kanban na fila paginada, arraste por ID do chamado no computador e ações equivalentes por botão para toque e teclado.
- Transições otimistas com controle de versão, reversão em falha e atualização da fila. Resolução/reabertura usam diálogo acessível; o motivo continua obrigatório na reabertura.
- Paleta Ctrl/Cmd + K, navegação inferior móvel, skeletons, toasts e animações com respeito a movimento reduzido.
- README e inventário de licenças atualizados. Capturas em `artifacts/workspace-kanban-dark-desktop.png` e `artifacts/workspace-dark-mobile.png`.
- Verificações concluídas: 81 testes unitários em 13 arquivos, lint, tipos, auditoria sem vulnerabilidades conhecidas, documentos legais e varredura de segredos. Build de prévia Vercel concluído (`dpl_44z1ZZVUbszb1vwM5ghgzoELF7EA`).
- Os testes focados de reversão, paleta, tema e arraste passaram em desktop e celular (arraste físico somente desktop, com alternativa por botão no toque). Uma rodada completa foi interrompida por pausa prolongada e escassez de memória do computador; a repetição está em andamento. Testes de demonstração não comprovam RLS ou concorrência em PostgreSQL real.

### Validação e publicação concluídas

O [CI do commit 2ad2ead](https://github.com/kaua-chavesvk/equipedesk/actions/runs/43516599266) concluiu com sucesso: lint, tipos, 81 testes unitários, testes SQL, RLS pela API autenticada, build, um E2E de restrição administrativa com Supabase local e a suíte de demonstração com 47 E2E aprovados e um ignorado (arraste no projeto móvel). Esse resultado remoto substitui as tentativas locais interrompidas como evidência da suíte completa. Não representa um teste de carga ou uma execução no banco de produção.

O deployment de produção `dpl_Fzh3GHoCnNmGcH69mtEVWyq5F1MH` concluiu o build e atende `https://miakaelsondesk.vercel.app`. A conferência publicada verificou login HTTP 200, tema escuro persistido após recarregar, paleta por teclado, foco restaurado ao fechar, ausência de rolagem horizontal em 390 px e nenhum erro JavaScript no fluxo. Captura em `artifacts/production-login-dark-mobile.png`.

## Integração de e-mail — descoberta e desenho em 16/11/2026

A Fase 1 foi encerrada com [relatório de descoberta](descoberta-integracao.md), baseado no commit `d4a6bd4`. Instalação com lockfile, lint, tipos, 81 testes unitários em 13 arquivos e build passaram na execução local; scanner de arquivos/histórico e verificação dos documentos legais passaram. Runtime local: Node 26.13.1, diferente do Node 24 especificado para CI. Não foram repetidos SQL/E2E nem envio real nesta revisão. As consultas GitHub não retornaram Issues ou PRs abertas.

O usuário escolheu e-mail e autorizou seguir pelo envio transacional primeiro. A Fase 2 produziu [o desenho para aprovação](integracao.md): Auth/SMTP separado das notificações, Resend como provedor de referência, outbox transacional, worker Edge com permissões restritas, destinatários autorizados, idempotência, callbacks assinados, retenção, flags dinâmicas, testes e rollback. A revisão consultou a documentação oficial de Supabase, Resend e LGPD, com fontes no desenho.

Esta etapa altera apenas documentação. Não houve implementação, dependência instalada, migração, configuração de credenciais/DNS/SMTP, envio de e-mail, commit/push ou deploy. Os cenários novos estão planejados e não são apresentados como testes executados. Antes da Fase 3, aguardar aprovação explícita do desenho; domínio, responsável, prazo, volume contratado e condições do piloto permanecem pendentes para homologação. Produção segue bloqueada pelas regras desta integração.

## Configurações de aparência e conta — Fase 1 em 16/11/2026

Criada a branch local `feature/configuracoes-conta`, preservando os documentos anteriores de integração de e-mail. O usuário confirmou interface em português do Brasil e inglês e foto visível para colegas com empresa compartilhada. O [levantamento](levantamento-configuracoes.md) registra o tema next-themes/localStorage, tokens CSS, ausência de perfis/Storage/i18n, pontos de nome/avatar, cookies e marketing, dependências de upload privado, exclusão e formatos.

A revisão foi estática, com buscas no código, seis migrações, tipos, pacote next-themes e `pnpm why sharp`, além da documentação instalada de Next.js e fontes oficiais de Storage. Não foram executados novos testes/build nem verificações visuais, de bucket remoto ou de políticas hospedadas nesta frente. Código, migrações, documentos legais versionados e produção permanecem sem alterações. Próximo passo após apresentação do relatório: Fase 2 em `docs/configuracoes.md`, com aprovação antes de implementação.

### Fase 2 — desenho de configurações em 16/11/2026

Produzido [o desenho para aprovação](configuracoes.md): preferências por usuário, pt-BR/inglês com formatos brasileiros, tema e escala/densidade/contraste/movimento, perfis e RLS, foto de até 2 MiB normalizada para WebP 256 px, publicação por sessão/atestado restrito, URL curta da aplicação com permissão por acesso, compensação/remoção e operação. A troca de e-mail fica condicionada à comprovação dos controles no provedor; senha, cookies, marketing e pedidos de direitos reaproveitam os fluxos existentes.

A proposta inclui APIs, limites, padrões, testes, preview e rollback. Foram revisadas fontes locais e documentação oficial de Supabase/Sharp e Next.js instalado. Não houve implementação, instalação de dependências, criação de credenciais/bucket, migração, foto enviada, alteração de documento legal versionado, commit/push ou deploy. Verificações documentais/segredos são registradas na entrega; testes novos são apenas planejados. Aguardar aprovação do desenho antes da Fase 3, como exigido no pedido original.

### Implementação das configurações e das fotos — branch de trabalho

Após aprovação, a branch `feature/configuracoes-conta` recebeu perfil, preferências privadas, RLS, bucket privado, comandos versionados, página de configuração e fluxo de foto. O upload usa a sessão do titular, reprocessa o arquivo para WebP de 256 px e exige os atestados do servidor para cadastrar e publicar a nova versão. A foto usa URL curta da aplicação com checagem de permissão em toda leitura. A operação de exclusão está descrita em `privacy-operations.md`.

O [CI do commit 9180bb5](https://github.com/kaua-chavesvk/equipedesk/actions/runs/43911089134) aprovou SQL, API de dados, Storage HTTP com três sessões, lint, tipos, Vitest, build e a suíte de demonstração (47 aprovados e um ignorado). A execução local mais recente do Vitest contabilizou 99 testes e o build local também concluiu. A suíte SQL local não rodou nesta máquina porque a conexão em 127.0.0.1:54322 foi recusada. Os testes da tela autenticada seguem no CI da branch.

O inglês está disponível na página de configurações. A tradução do restante da aplicação segue pendente. O e-mail da conta permanece somente para leitura e as notificações dependem da integração própria. A consulta à Vercel confirmou ausência de variáveis para Preview. A homologação precisa usar um Supabase de teste com as migrações e credenciais isoladas. A branch segue separada da publicação de produção.

### Homologação hospedada das configurações e fotos

O [Preview](https://equipedesk-configuracoes-preview.vercel.app/conta/configuracoes) foi publicado com configuração própria e as oito migrações aplicadas no Supabase de homologação. O teste no navegador confirmou login, persistência do nome, tema escuro, inglês e escala de 125%, além de ausência de rolagem horizontal em 390 px.

O teste de foto confirmou upload, conversão para WebP de 256 × 256, remoção do arquivo no bucket privado e HTTP 404 na URL anterior. Após o teste, a fila ainda registrava uma tarefa de limpeza pendente. A troca de e-mail ficou desativada. O Redis temporário provisionado para o Preview tinha expiração em 19/11/2026. A publicação das configurações e das fotos em produção segue como etapa separada.
