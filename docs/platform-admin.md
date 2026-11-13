# Administrador geral

O administrador geral tem acesso administrativo a todas as empresas, inclusive futuras, sem precisar de uma associação em cada uma. Pode consultar chamados, conversas, eventos e equipe, e executar os comandos administrativos existentes. A proteção do último administrador de cada empresa continua ativa.

O privilégio vem exclusivamente de `public.platform_admins`. Metadados enviados pelo cadastro ou pelo navegador não atribuem esse papel. Usuários autenticados podem consultar apenas a própria entrada e não podem inserir, alterar ou remover administradores gerais. As políticas de RLS e os comandos transacionais consultam esse registro no banco em cada operação.

## Provisionamento

1. Configure o Supabase e aplique a migração `202611120001_platform_admins.sql` no projeto pretendido.
2. No ambiente do processo administrativo, configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (8 ou mais caracteres) e, opcionalmente, `ADMIN_NAME`.
3. Execute `pnpm admin:provision`.
4. Entre pelo formulário normal de login. A conta verá todas as empresas e a identificação “Administrador geral” no perfil do workspace.

O script confirma o e-mail ao criar a conta por atribuição administrativa, verifica a existência da migração antes de criar o usuário e não registra a senha ou a chave no terminal. Se a conta já existir, mantém sua senha e seus dados. Não use a chave administrativa no frontend. O script pode ser repetido para concluir uma atribuição que falhou após a criação do usuário.

Para revogar acesso global, remova a entrada em `platform_admins` pelo ambiente administrativo. Associações locais existentes permanecem válidas. Não há concessão ou revogação desse privilégio no cadastro público ou na tela de equipe.

## Validação

Em 13/11/2026, as cinco migrações do projeto foram aplicadas ao Supabase de produção, que ainda não possuía as tabelas da aplicação. A conta solicitada pelo titular foi provisionada como administrador geral, com e-mail confirmado. Foram verificados o login com a chave pública, a leitura do próprio registro em `platform_admins` e o login pelo site publicado (HTTP 200), que direcionou ao aceite dos termos. O aceite ficou a cargo do usuário. Credenciais não foram registradas neste documento; o arquivo temporário de configuração administrativa foi removido após o provisionamento.

`supabase/tests/platform-admin.test.sql` verifica isolamento de usuários comuns, bloqueio de autopromoção, leitura global, comandos sem membership e revogação imediata. Precisa ser executado com PostgreSQL/Supabase real; presença do arquivo não equivale a teste executado.
