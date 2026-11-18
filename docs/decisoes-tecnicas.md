# Decisões técnicas: guia para apresentar o projeto

Use este guia para estudar o código e demonstrar o comportamento. Ele não substitui a compreensão prática nem deve ser apresentado como experiência que você não teve.

## Por que existe version?

Duas pessoas podem abrir a versão 3 de um chamado. A primeira alteração produz a versão 4. A segunda envia 3 e recebe conflito; deve recarregar e decidir novamente. Isso evita uma atualização perdida. Confira `src/features/tickets/rules.ts`, `desk_command` nas migrações e os testes de concorrência SQL/API.

## Como a RLS isola empresas?

A identidade vem do Supabase Auth, e as políticas filtram as linhas conforme usuário, empresa e papel. O slug recebido na URL não é autorização. Teste um usuário de outra empresa e um solicitante tentando ler o chamado de outra pessoa. Confira `supabase/tests/` e `src/lib/data.ts`.

## O que faz desk_command?

A RPC executa um comando de negócio no PostgreSQL: verifica acesso, estado e versão, aplica a alteração e registra o evento de forma transacional. Se uma etapa falha, a transação não deve deixar resultado parcial. Locks e verificações de versão protegem disputas. Leia a função nas migrações em ordem; a última definição é a vigente.

## Por que Redis?

Um contador em memória pertence a uma única instância. Na hospedagem serverless há múltiplas instâncias, então o limite precisa de estado compartilhado. Redis mantém incremento e expiração atômicos. Leia `src/lib/rate-limit.ts` e teste indisponibilidade, limites e identidade do cliente. A aplicação não deve confiar indiscriminadamente em cabeçalhos encaminhados.

## Demo não é produção

A demo usa memória por sessão e regras puras; reiniciar o processo pode perder alterações. A produção usa RPC, RLS e persistência. Os módulos em `src/lib/server/workspace-api/` separam consultas, convites, validação de comandos e execução demo/produção. Explique também o que os testes de demonstração não comprovam: isolamento real, entrega de e-mails e restauração.

## Preparação para entrevista

Abra dois clientes e reproduza um conflito; mostre a regra e o teste que o captura. Explique o caminho UI → API → RPC → RLS e a diferença entre autenticação e autorização. Mostre um erro de permissão, não apenas o caminho feliz. Se usar assistência de IA, explique seu processo de revisão e validação com transparência.
