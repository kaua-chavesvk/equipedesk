# EquipeDesk — estado do trabalho em 18/11/2026

## Resultado e ambientes

Os filtros pessoais da fila estão implementados e passaram pela validação funcional. As entregas recentes de segurança, MFA, convites e filtros estão na branch `codex/security-phase2` e no [PR #1](https://github.com/kaua-chavesvk/equipedesk/pull/1), ainda em rascunho. Este pacote não foi mesclado na main nem publicado em produção nesta etapa. O Supabase local descartável no CI é diferente do projeto hospedado de homologação.

Atualização operacional de 18/11: o commit `58aabe1` foi publicado no Preview, as duas migrações recentes foram aplicadas ao Supabase de homologação e passaram 22 assertivas SQL remotas e sete verificações HTTP autenticadas. O [relatório de homologação](homologacao-seguranca-2026-11-18.md) registra ambientes, limpeza, limites e as prioridades restantes.

## Segurança de autenticação

Em produção, há teto global de 600 requisições/minuto para `/api/auth`, 60 por IP conhecido e limite adicional de dez tentativas por combinação de IP com e-mail normalizado no login. Sem IP confiável, o limite adicional usa o e-mail, sob o teto global. As chaves Redis usam HMAC, sem IP ou e-mail em texto puro na chave. Isso reduz o problema do pequeno balde compartilhado; limites globais e controles próprios do Supabase continuam relevantes.

Na Vercel, o código aceita um único IP válido de `X-Vercel-Forwarded-For`. Em outro ingresso, `TRUST_PROXY=true` permite `X-Real-IP` somente com a premissa de que o proxy sobrescreve esse cabeçalho e bloqueia acesso direto à origem. O protocolo encaminhado também é restrito a valores e ambientes confiáveis.

Foi acrescentada CSP candidata em Report-Only para observar incompatibilidades; não há coletor central configurado. Dependabot e CodeQL foram adicionados. Não se introduziu cache de aceite dos termos por TTL sem invalidação confiável.

Na revisão hospedada anterior, o mínimo de senha era seis caracteres e o timeout de inatividade estava em zero; o app exige oito. Essas configurações não foram alteradas silenciosamente. Proteção de senhas vazadas e política de sessão no provedor continuam pendentes de configuração/validação.

## MFA administrativo

Somente administradores gerais de `platform_admins` acessam `/conta/seguranca` e a API de MFA. O usuário cadastra um autenticador por QR code ou chave manual e confirma o código de seis dígitos. O Supabase valida e eleva a sessão a AAL2. Novo login exige nova confirmação para elevar a nova sessão.

A API verifica identidade e papel global em cada chamada, limita mutações a dez por minuto por conta e falha fechada quando o Redis está indisponível. Cadastros pendentes podem ser cancelados. Fatores confirmados não podem ser removidos pela tela.

A chave fica em memória durante o cadastro; não é salva pela aplicação em localStorage ou logs. O SVG do Supabase é convertido em data URL base64 para exibição no Next. O roteiro de recuperação está em [admin-mfa.md](admin-mfa.md).

`ENFORCE_PLATFORM_ADMIN_AAL2` permanece desativado por padrão até preparar os administradores e validar recuperação em homologação. A proteção vale nos pontos Next.js que chamam o guard. Não foi acrescentada exigência de AAL2 às políticas RLS ou funções SQL existentes. Códigos de recuperação e recuperação de conta real não foram implementados/testados nesta entrega.

## Convites

Administradores de empresa podem listar pendentes e expirados, revogar e gerar novo link. A migração `202611170001_invite_renewal.sql` revoga o anterior e emite o substituto na mesma transação, usando os comandos existentes. Uma falha desfaz a operação inteira.

O compartilhamento é manual. Não existe reenvio automático por e-mail nesta entrega. O usuário informou que ainda não possui provedor/domínio remetente.

## Filtros pessoais e interface

A fila ganhou “Atribuídos a mim” e “Meus urgentes”. Até dez filtros por conta e empresa guardam nome, busca, estado, prioridade, responsável e Lista/Kanban. O atalho de urgentes inclui todos os estados; refine o estado antes de salvar se desejar apenas os chamados em andamento. Aplicar um atalho reinicia a paginação.

Os filtros ficam no Supabase e podem ser carregados em outros dispositivos da mesma conta. Não há push em tempo real para atualizar simultaneamente todas as telas abertas.

A migração `202611170002_saved_ticket_filters.sql` cria a tabela `user_ticket_filters`, uma nova política de leitura pessoal e uma RPC de escrita com identidade da sessão, participação, validação e limite. Políticas e funções anteriores não foram reescritas. Colegas não leem esses atalhos; revogar a participação retira acesso. A exclusão da conta ou empresa remove os registros por chave estrangeira.

Cada conjunto possui versão. Duas sessões que gravam a mesma versão produzem um vencedor e um conflito 409. A interface pede recarregamento em vez de sobrescrever a outra gravação. Timeout também exige recarregar, porque o banco pode ter concluído a escrita antes da perda da resposta.

Português/inglês, estilos existentes, Lista/Kanban, paleta Ctrl/Cmd+K e navegação móvel foram preservados. Estados vazios já permitiam criar chamado e limpar filtros. A demonstração oferece o atalho rápido e informa que a persistência requer conta conectada. Não há dependência ou variável de ambiente nova para filtros. O cache da fila inclui responsável na chave.

## Evidências executadas

O [job verify do commit 4f016b8](https://github.com/kaua-chavesvk/equipedesk/actions/runs/44159116041) passou:

- Lint, TypeScript, build e verificações de documentos/segredos.
- 172 testes unitários em 22 arquivos.
- Suíte SQL, incluindo 14 assertivas novas para filtros.
- 15 verificações pela API de dados, incluindo concorrência de filtros e isolamento.
- Testes de Storage.
- Dump/restauração em banco local descartável, comparação de dados, RLS e recusa de escrita direta, incluindo filtros pessoais.
- Quatro testes de navegador com Supabase: configurações/convites, acesso administrativo, MFA e filtros entre contextos de navegador com conflito.
- 49 testes gerais de interface aprovados e um ignorado.

O [CodeQL da mesma revisão](https://github.com/kaua-chavesvk/equipedesk/actions/runs/44159116088) passou. Esses resultados não comprovam teste de carga, pentest externo, recuperação em produção ou restauração de arquivos Storage.

## Auditoria de dependências

A consulta de 18/11 ainda reportou `GHSA-fc5q-39xc-vjpf` em `picomatch <=4.0.7`, usado pelas ferramentas de desenvolvimento. A auditoria indicou ausência de versão corrigida e a versão mais recente consultada continuou em 4.0.7. [Aviso de segurança](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).

Nenhuma exceção foi adicionada. Auditoria e validação funcional são independentes: `verify` passou, `dependency-audit` falhou e o CI agregado permanece reprovado. O alerta não comprova exploração da aplicação e não deve ser tratado como resolvido por afetar dependências de desenvolvimento.

## Pendências e sequência

Prioridade operacional imediata: o Redis temporário de homologação vence em 19/11/2026. O titular confirmou que ainda não o vinculou à conta Upstash; o link privado de Claim foi recuperado e entregue na conversa. Não foi gravado no repositório. A homologação respondeu aos testes atuais, mas a continuidade depende dessa ativação.

1. Resolver ou revisar formalmente a pendência de dependência com evidência de mitigação/correção.
2. Concluído: aplicar as migrações recentes em homologação e validar SQL e jornada HTTP no ambiente hospedado. Uma nova avaliação visual do Preview não integra esse ensaio.
3. Preparar administradores e ensaiar recuperação antes de ativar a exigência AAL2 hospedada.
4. Publicar o código correspondente e conferir o ambiente oficial; este pacote ainda não foi publicado.
5. Configurar provedor/domínio de e-mail, entrega real, destino de alertas e observabilidade externa.
6. Completar restauração de arquivos Storage e recuperação de backup real em destino apropriado.
7. Seguir a Fase 3 com ações em lote e central de notificações. Indicadores de SLA dependem de definir os prazos por prioridade.
8. A Fase 4 contempla notificações por canal, SLA/relatórios, anexos privados, respostas prontas/tags e exportação/auditoria consultável.
