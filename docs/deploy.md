# Publicação e recuperação

1. Crie projetos Supabase separados para demonstração e produção, e ambientes separados na Vercel. Nunca reutilize o banco de produção no preview.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL` para cada ambiente. A chave administrativa pertence somente ao script de seed local.
3. No Supabase Auth, defina Site URL para o domínio do ambiente e adicione a URL exata de `/callback` à lista de redirects; localmente use `http://localhost:3000/callback`. Configure envio de e-mail de confirmação, convite e recuperação.
4. Antes do deploy, obtenha backup e execute `pnpm exec supabase db push` com o projeto correto vinculado. Revise a migração em staging primeiro. Migrações devem permanecer compatíveis com a aplicação anterior durante a transição.
5. Publique usando o lockfile e as mesmas versões da CI. Não configure a chave `service_role` no frontend ou no atendimento.
6. Teste login, abertura, comentário, atribuição, resolução, troca de empresa e UUID de outra empresa. Repita com solicitante e atendente; confirme 404 sem dados e contagens compatíveis.

A versão com administrador geral exige a migração `202611120001_platform_admins.sql` antes da publicação, inclusive para contas comuns, pois a resolução de acesso consulta essa tabela. Siga [o provisionamento administrativo](platform-admin.md) para criar o acesso global. Não conceda esse papel por metadados de cadastro.

A versão de segurança exige também `202611120002_command_validation.sql`, origem HTTPS e Redis REST. Leia os requisitos e limitações do [relatório de segurança](security-report.md), execute `scripts/check-env.mjs` no ambiente de produção e conecte os logs aos alertas da hospedagem. Valide em staging o HTTP 503 em escritas e autenticação durante indisponibilidade do Redis e a continuidade das leituras autorizadas.

Para recuperar uma versão anterior, restaure o deploy anterior na Vercel. Se a migração for incompatível, prepare uma migração corretiva ou restaure o backup em um projeto separado e valide antes de redirecionar tráfego. Não faça downgrade destrutivo de esquema sem preservar os chamados e eventos posteriores.

## Diagnóstico de erro 503 na publicação

Se a página inicial mostrar apenas `{"error":"Serviço temporariamente indisponível."}`, consulte os logs de produção. O evento `environment_invalid` significa que o proxy bloqueou a requisição antes da renderização por configuração inválida. O status Ready do deploy na Vercel não valida as variáveis de execução.

Execute `scripts/check-env.mjs` com as variáveis do ambiente de produção para obter os motivos sem imprimir credenciais. Verifique principalmente:

- `NEXT_PUBLIC_SITE_URL` deve conter a origem HTTPS pública, sem caminho.
- Configure a URL do Supabase e a chave pública; nunca use uma chave administrativa como chave pública.
- Remova `SUPABASE_SERVICE_ROLE_KEY` do ambiente web, inclusive quando adicionada por uma integração. A remoção da variável não revoga a chave no Supabase. Scripts administrativos recebem essa chave apenas em seu próprio processo.
- Configure `RATE_LIMIT_REDIS_URL` e `RATE_LIMIT_REDIS_TOKEN`. No Upstash, use a URL REST HTTPS e o token REST com permissão de escrita, não a URL `redis://` nem o token somente de leitura. Se a integração gerar nomes diferentes, configure os nomes esperados pela aplicação.

Depois de corrigir as variáveis, faça um novo deploy e confirme a resposta HTTP da página inicial e da tela de login. Não ative o modo de demonstração nem desabilite o limitador para contornar uma configuração incompleta de produção.

Em 13/11/2026, a configuração de produção de `miakaelsondesk.vercel.app` apresentou dois motivos: chave administrativa no processo web e Redis REST ausente. A variável administrativa foi removida. Após o titular aceitar os termos, foi criado o recurso `miakaelson-desk-rate-limit` no plano Free do Upstash, com atualização automática de plano desativada, e configuradas as variáveis REST esperadas pela aplicação. A validação do ambiente e um teste real de incremento e expiração atômicos passaram. O deploy `dpl_CzDkCqbHQLUrvkgXZ7DcWyVJ9MQH` foi publicado em produção. O endereço principal redirecionou para login com resposta final HTTP 200; a tela abriu sem erros JavaScript nem falhas HTTP de recursos no navegador. A API `/api/empresas` respondeu 405 ao GET, conforme esperado para uma rota somente POST, passando pelo limitador. A verificação móvel não apresentou rolagem horizontal. Estas verificações não incluem login com credenciais reais nem operações autenticadas no banco.

## Roteiro de três minutos

- **0:00–0:45:** abra Aurora, veja a fila, crie um chamado com título e descrição reconhecíveis e confira o contador.
- **0:45–1:30:** alterne para um atendente autorizado, assuma o chamado, adicione uma resposta e resolva. Mostre conversa e histórico com os eventos.
- **1:30–2:15:** use a conta compartilhada para mudar para Horizonte, onde ela é solicitante. A fila e os contadores mudam com o papel.
- **2:15–3:00:** peça o UUID da Aurora sob a URL da Horizonte; confirme 404. Reabra o chamado autorizado com um motivo e mostre o evento correspondente.

Para provar RLS, repita o acesso pela API de dados do Supabase usando o access token do usuário e a chave pública, conforme os testes SQL. O modo visual sem credenciais não comprova autorização do banco.


## Rollback da aplicação

No painel Vercel, abra Deployments, localize o último deploy de produção validado e use a opção de rollback do projeto. Após a troca, confirme o alias público, abra o login e faça um teste de leitura com uma conta de teste. Registre o deploy restaurado e a causa. Migrações de banco precisam de avaliação separada de compatibilidade e preservação de dados.

O build de produção executa o verificador de ambiente antes da compilação. Durante uma falha do Redis, páginas e APIs de leitura continuam disponíveis com os controles de acesso existentes. Escritas e a rota de autenticação retornam 503 até o Redis voltar.
