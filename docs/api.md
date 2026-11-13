# Contrato HTTP — EquipeDesk

Todas as respostas privadas usam `Cache-Control: no-store`. Identidade e empresa são resolvidas no servidor; o corpo nunca escolhe o autor ou a empresa. JSON de erro: `{ "error": "Mensagem em português" }`. Campos desconhecidos de comandos devem ser rejeitados. UUIDs identificam recursos. Datas são ISO 8601 em UTC.

## Autenticação e empresas

`POST /api/auth`: a entrada é validada por ação; campos desconhecidos ou de outra ação são rejeitados com 422.

| Ação | Campos |
|---|---|
| `login` | `email` válido e `password` com ao menos 8 caracteres |
| `signup` | `email` válido, `password` com ao menos 8 caracteres e `name` opcional (1–100 caracteres após remover espaços externos) |
| `recover` | `email` válido |
| `update_password` | `password` com ao menos 8 caracteres |
| `logout` | Apenas `action` |
| `demo` | Apenas `action`; disponível somente quando o modo de demonstração está habilitado e Supabase não está configurado |

Recuperação retorna mensagem genérica em caso de sucesso. O callback troca o código PKCE por uma sessão em cookie. O convite é aceito após autenticação, por e-mail verificado.

`POST /api/empresas`: `{name,slug}` cria empresa e primeiro administrador atomicamente. Slug tem letras minúsculas, números e hífens. `POST /api/convites/aceitar`: `{token}` consome convite válido de uso único e retorna `{id,slug}`. A interface usa esse slug para abrir `/e/{slug}`.

## Recursos em `/api/empresas/{slug}`

| Método e caminho | Entrada | Resultado |
|---|---|---|
| GET `/painel` | — | Contagens `open`, `in_progress`, `resolved` sobre exatamente a fila visível |
| GET `/chamados` | `q` (até 200 caracteres), `status`, `priority`, `page` (1–1000000), `pageSize` (1–50; padrão 10) | `{data,total,page,pageSize}`; ordem `created_at DESC,id DESC` |
| POST `/chamados` | `{title,description,priority}` | Chamado criado, 201 |
| GET `/chamados/{id}` | — | Chamado, comentários e eventos visíveis |
| POST `/chamados/{id}/comentarios` | `{body}` | Comentário criado, 201 |
| POST `/chamados/{id}/transicoes` | `{action:"assign"|"resolve"|"reopen",version,reason?}` | Chamado atualizado; reabertura exige motivo |
| GET `/membros` | — | Membros da empresa |
| PATCH `/membros/{id}` | `{role:"admin"|"agent"|"requester"}` | Associação atualizada |
| DELETE `/membros/{id}` | — | Associação removida; histórico preservado |
| POST `/convites` | `{email,role}` | Convite e link de uso único, 201 |
| DELETE `/convites/{id}` | — | Convite revogado |

Título tem 5–160 caracteres, descrição 10–10000, comentário 1–5000 e motivo 3–1000. Prioridades: `low`, `medium`, `high`, `urgent`. Estados: `open`, `in_progress`, `resolved`. Atribuição exige chamado aberto, sem responsável e versão atual. Resolução exige atendimento; reabertura devolve ao estado aberto. O banco registra comando e histórico na mesma transação.

## Status

201 criação; 200 sucesso; 401 sessão ausente/inválida; 403 ação proibida em recurso visível; 404 empresa/recurso invisível; 409 versão antiga, convite consumido ou remoção do último administrador; 422 entrada inválida. A interface mantém os valores do formulário após falha.

## Papéis

Solicitante consulta e comenta apenas os próprios chamados. Atendente e administrador consultam a fila inteira da empresa, assumem e resolvem chamados. Administrador gerencia membros e convites. Associação em uma empresa não concede acesso a outra. Todos os comandos sensíveis passam por `desk_command(p_slug,p_action,p_payload)`; grants e RLS impedem escrita direta para contornar regras.


A integração Supabase aplica busca literal por título e descrição, filtros, contagem exata e paginação antes de transferir os resultados. Os contadores usam consultas sem retorno de linhas e não recebem os filtros da lista. A interface usa seis itens por página por padrão e preserva os filtros na URL. Detalhes são consultados por UUID e empresa, independentemente da página ativa. Todas as consultas usam a sessão do usuário e permanecem sujeitas a RLS.
