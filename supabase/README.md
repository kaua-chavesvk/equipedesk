# Banco e contrato transacional

O esquema só concede leitura filtrada por RLS ao papel `authenticated`. Toda escrita passa por `desk_command(p_slug text, p_action text, p_payload jsonb)`, uma função SECURITY DEFINER com search_path vazio, identidade `auth.uid()` e autorização explícita. Nenhuma chave service role participa das operações comuns. A função retorna JSON. Erros de domínio usam SQLSTATE P0001 com prefixo HTTP (`404:`, `409:` etc.).

| Ação | Payload | Retorno |
|---|---|---|
| create_organization | name, slug | id, slug |
| create_ticket | title, description, priority | linha do chamado |
| comment | id do chamado, body | id do comentário |
| transition | id, action (`assign`, `resolve`, `reopen`), version, reason para reabrir | linha do chamado |
| invite | email, role | id, token, expires_in_days |
| accept_invite | token | id da empresa, slug |
| update_member | id do usuário, role | id |
| remove_member | id do usuário | id |
| revoke_invite | id do convite | id |

Criação e aceite não usam o slug. Os papéis são `admin`, `agent`, `requester`; estados `open`, `in_progress`, `resolved`; prioridades `low`, `medium`, `high`, `urgent`. Não exponha o token em logs. Retorne o link ao administrador somente no momento de criação; a tabela armazena apenas SHA-256 e a concessão SELECT exclui token_hash.

Todas as operações da empresa bloqueiam a linha de organizations antes de alterar vínculos e chamados. Isso fornece ordem de bloqueio consistente, impede a perda concorrente do último administrador e serializa disputas. Chamados também verificam versão sob bloqueio. O custo deliberado no MVP é menor paralelismo por empresa; quando necessário, substituir o bloqueio amplo por bloqueios específicos mantendo a ordem para convites e membros.

As referências de autor e responsável apontam para auth.users, não para memberships: remover acesso preserva autoria e histórico. Contagens devem usar a mesma consulta RLS da fila (sem service role); filtros de estado da lista são adicionais, não mudam o escopo de visibilidade. Paginação: created_at DESC, id DESC.

## Reprodução

Execute `pnpm exec supabase start`, `pnpm exec supabase db reset`, `pnpm exec supabase test db`. Docker é necessário. Gere tipos com `pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts`. Os tipos incluídos são bootstrap alinhados ao esquema; ainda devem ser regenerados com uma instância ativa. Testes SQL usam pgTAP em transação e rollback, com JWT simulado para o papel authenticated, cobrindo leituras e comandos sob RLS. A suite SQL ainda precisa de execução em Docker; não confunda arquivos presentes com resultado validado.

## Teste conectado pela API de dados

Depois do reset e do seed local, exporte `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e, se alterada, `DEMO_PASSWORD`. Execute `node scripts/test-data-api.mjs`. O script usa apenas fetch nativo, assert e a chave pública: autentica as quatro contas de demonstração no endpoint Auth e testa consultas e comandos REST reais. Sem configuração ou banco ativo ele falha; não registra um teste pulado como sucesso.

São verificados isolamento por empresa e solicitante, busca e contagem, manipulação do autor/empresa, proibição de escritas diretas, efeito imediato de troca de papel, comentários e histórico, resolução e disputa concorrente de atribuição. O teste muda temporariamente Rafa de atendente para solicitante em Aurora e restaura o papel em `finally`; execute em ambiente local sem outras jornadas concorrentes. Ele deixa um chamado resolvido de evidência por execução. Use o reset/seed para restaurar a demonstração. A execução conectada depende de Docker e Supabase disponíveis; `node --check scripts/test-data-api.mjs` apenas valida sintaxe JavaScript.
