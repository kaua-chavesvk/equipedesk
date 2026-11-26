## Estudo de caso: decisões técnicas e aprendizados

Revisado em **19/11/2026**, a partir do código e dos registros de implementação e publicação deste repositório.

### O problema que orienta a arquitetura

O EquipeDesk organiza o atendimento interno de empresas. Uma mesma pessoa pode participar de empresas diferentes, com permissões diferentes em cada uma. Cada consulta e alteração precisa respeitar esse contexto, preservar o histórico e tratar duas pessoas tentando atualizar o mesmo chamado.

### Por que Supabase, PostgreSQL e Next.js?

| Decisão                             | Por que atende ao projeto                                                                                                                                                                                                                                                                                  | Custo ou cuidado que acompanha a escolha                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase Auth + PostgreSQL**      | Reúne identidade, sessão e banco relacional. Empresas, membros, chamados, comentários e eventos têm relações explícitas, que podem ser protegidas por chaves estrangeiras, transações e políticas de acesso. Evita implementar um serviço próprio de autenticação para desenvolver o fluxo de atendimento. | Integrar o provedor não resolve a autorização do produto. Sessões, políticas, migrações, callbacks e configuração dos ambientes continuam sendo responsabilidade da aplicação. |
| **RLS e funções SQL transacionais** | As regras de leitura também ficam no banco, e operações com várias alterações podem ser confirmadas juntas. Isso protege o contexto da empresa e mantém a mudança do chamado consistente com seu evento de histórico.                                                                                      | SQL passa a conter regras importantes do domínio e precisa de revisão e testes próprios. Funções privilegiadas devem verificar explicitamente o usuário e suas permissões.     |
| **Next.js App Router**              | Componentes de servidor carregam o contexto autorizado; componentes de cliente cuidam das interações; Route Handlers validam entradas e expõem as operações HTTP. A sessão integra-se ao cliente SSR do Supabase por cookies.                                                                              | É necessário distinguir código de servidor e navegador e revisar o cache para não compartilhar dados privados entre usuários.                                                  |

Esses motivos explicam a arquitetura implementada; não representam um benchmark entre provedores.

### Como funcionam as permissões

Autenticar identifica a pessoa; autorizar determina o que ela pode fazer naquela empresa. A tabela `memberships` associa usuário, empresa e papel, permitindo que alguém seja atendente em uma empresa e solicitante em outra.

| Papel na empresa  | Alcance dos chamados                          | Responsabilidade adicional                      |
| ----------------- | --------------------------------------------- | ----------------------------------------------- |
| **Solicitante**   | Lê, comenta e reabre os próprios chamados.    | Abre solicitações.                              |
| **Atendente**     | Acessa a fila da empresa e atua nos chamados. | Assume, resolve e reabre chamados.              |
| **Administrador** | Acessa a fila da empresa e atua nos chamados. | Gerencia membros, papéis e convites da empresa. |

No servidor, a sessão e as associações determinam o workspace autorizado. Nas leituras, as políticas de **Row Level Security (RLS)** restringem os registros devolvidos pelo PostgreSQL. Por exemplo, trocar o ID na URL não deve permitir a um solicitante ler o chamado de outra pessoa ou de outra empresa. Esconder um botão na interface não é uma barreira de autorização.

Nas escritas, o cliente não recebe permissão para atualizar livremente as tabelas. As funções transacionais verificam identidade, empresa, papel e condições da operação antes de alterar os dados. Há ainda um **administrador geral**, registrado separadamente em `platform_admins`, com acesso entre empresas. Esse privilégio exige provisionamento administrativo e não é concedido pelo cadastro público; a chave administrativa não pertence ao navegador nem ao processo web normal.

Veja a [matriz de autorização](docs/architecture.md), as [políticas e comandos iniciais](supabase/migrations/202611110001_initial.sql), o [privilégio global](supabase/migrations/202611120001_platform_admins.sql) e os [testes de isolamento](supabase/tests/isolation.test.sql).

### Desafios registrados e como foram tratados

- **Duas atualizações sobre o mesmo chamado.** Cada alteração informa a versão conhecida do registro. A função SQL verifica essa versão e devolve conflito 409 quando outra operação já a modificou. A interface pode antecipar a mudança visual, mas restaura o estado se o servidor recusar. Isso combina resposta rápida com detecção de edição desatualizada. [Implementação e evidências](docs/progress.md#conforto-e-interação--13112026).
- **A fila não pode depender de carregar todos os chamados.** Busca, filtros, contagem e paginação foram levados ao banco. A ordenação inclui data e UUID, e o detalhe é consultado independentemente da página da fila. A decisão limita os registros transferidos; não é uma alegação de desempenho sob carga, que exigiria medição própria. [Consultas implementadas](src/lib/ticket-queries.ts).
- **Um deploy “Ready” ainda pode servir um site indisponível.** Em 13/11, o site retornava 503: havia uma chave administrativa indevida no processo web e faltavam as variáveis esperadas do Redis. A recuperação corrigiu o ambiente e verificou o serviço publicado. O aprendizado é validar configuração e comportamento em execução, além do resultado do build. [Diagnóstico e recuperação](docs/deploy.md#diagnóstico-de-erro-503-na-publicação).
- **Uma demonstração visual não comprova isolamento de dados.** O modo em memória facilita explorar a interface, mas não exercita as políticas do PostgreSQL. Por isso, o projeto separa testes de regras, jornadas de navegador e testes SQL/API com sessões reais. Os registros distinguem o que foi executado em demonstração, Supabase local, homologação e produção. [Evidências por etapa](docs/progress.md).

O aprendizado central é vincular cada requisito a uma garantia verificável: associação com a empresa para autorização, transações para consistência e versão para concorrência. Jornadas completas em produção, operação de e-mails, monitoramento e recuperação continuam detalhados nas pendências deste README.
