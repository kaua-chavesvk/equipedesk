# Plano de entrega e critérios de aceite

| Etapa | Dependência | Propriedade | Critério de aceite |
|---|---|---|---|
| Contrato | Repositório inspecionado | Coordenação e verificação | Endpoints, estados, papéis, limites e erros documentados antes da integração |
| Fundação | Contrato | Coordenação | Next.js, TypeScript estrito, pnpm e lockfile; configurações compartilhadas |
| Dados | Contrato | Agente A — `supabase/**`, tipos | Migração reproduzível; RLS; comandos transacionais; teste de isolamento |
| Interface | Contrato | Agente B — páginas e componentes | Desktop e celular, abertura, conversa, estados de erro e troca de empresa |
| Verificação | Contrato | Agente C — testes, scripts, docs, CI | Regras unitárias, cenários SQL e navegador, roteiro reproduzível |
| Integração | Fundação, dados, interface | Coordenação — API e sessão | Jornada real abre, atribui, comenta, resolve e reabre |
| Entrega | Integração | Coordenação | Lint, tipos, testes e build executados; limitações e dependências declaradas |

## Cenários obrigatórios

- Empresa Aurora e empresa Horizonte, usuários exclusivos e usuário compartilhado com papéis diferentes.
- Dois solicitantes na mesma empresa; busca, contagem e leitura respeitam autoria.
- UUID de chamado da outra empresa retorna 404 em leitura, comentário e transição.
- Alteração de papel produz efeito na próxima operação; histórico continua acessível aos membros autorizados.
- Convite expirado, revogado, reutilizado e com e-mail divergente é recusado.
- Último administrador não pode sair ou ser rebaixado, inclusive em disputa concorrente.
- Dois atendentes disputando a mesma versão: exatamente um vence, sem evento duplicado.
- Falha de escrita não adiciona evento; troca de empresa limpa a tela anterior.
- Formulários têm rótulos, navegação por teclado, foco no erro e valores preservados.

## Evidências

Consulte a resposta de entrega para os comandos efetivamente executados nesta máquina. A existência de uma configuração de CI ou de um teste não significa que ele foi executado. Testes de PostgreSQL e autenticação real precisam de Docker/Supabase local; deploy precisa dos ambientes hospedados.

## Melhorias iniciadas em 12/11/2026

- [x] Encaminhar aceite de convite para a empresa retornada pela API e exibir erro com possibilidade de nova tentativa.
- [x] Validar os campos obrigatórios de autenticação conforme a ação.
- [x] Alinhar o motivo de reabertura entre HTTP, demonstração, regras puras e documentação ao limite SQL de 3–1000 caracteres.
- [x] Propagar falhas de consulta de membros, comentários e eventos, sem convertê-las em listas vazias.
- [x] Distinguir falha de infraestrutura de empresa não encontrada na página do workspace.
- [x] Exibir falha de carregamento da conversa e permitir nova tentativa.
- [ ] Revisar os demais limites entre SQL e HTTP, incluindo título e slug.
- [x] Implementar filtros, contagens e paginação no banco, com detalhe consultado por ID.
- [ ] Adicionar perfis para identificar membros, autores e responsáveis.
- [ ] Unificar a linha do tempo com eventos persistidos e completar a gestão de convites pendentes.
- [ ] Validar as jornadas com Supabase real e credenciais de usuário.

## Correções de 13/11/2026

- [x] Separar a validação do Redis em runtime e no build de produção.
- [x] Validar redirecionamentos internos codificados.
- [x] Exibir prévia de convite ao e-mail confirmado correspondente e limpar a entrada de navegação após o aceite.
- [x] Limitar a espera em requisições ao Supabase.
- [x] Retirar o aviso de escolha de cookies opcionais inativos e neutralizar o título do login.
- [x] Unificar comentários e eventos em ordem cronológica.
- [ ] Executar a suíte SQL, testes com sessões reais e validar a migração de convite em staging.
- [ ] Implementar listagem, reemissão e cancelamento de convites pendentes.
- [ ] Validar entrega de e-mails, backups, retenção e alertas externos.
