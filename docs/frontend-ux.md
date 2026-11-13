# Reformulação da interface — 13/11/2026

## Contexto

Escopo confirmado pelo titular: todo o frontend, incluindo acesso e painel. Público: equipe interna, com computador e celular igualmente importantes. O objetivo é tornar leitura, localização de chamados e execução de ações confortáveis nos dois dispositivos.

Foi aplicada a skill `frontend-design`, instalada em `~/.codex/skills/frontend-design`. Direção Swiss: superfícies branca e cinza neutro, Helvetica, azul `#002FA7` como destaque e organização por grades e divisórias. O elemento principal do painel é a fila: tabela no computador e apresentação em cartões no celular. O resumo numérico usa os dados efetivos do espaço; os dados fictícios continuam identificados no ambiente de demonstração.

## Problemas e mudanças, por impacto

| Ponto | Problema observado e efeito no uso | Mudança implementada |
|---|---|---|
| Legibilidade | Texto de 7–11 px em componentes móveis exigia esforço para ler; contrastes e tamanhos variavam entre regras CSS sobrepostas. | Refeito o CSS compartilhado com tokens de cor, texto principal de 15–16 px, campos de 16 px, entrelinhas maiores e contraste mais forte. Informações auxiliares mantêm escala própria. |
| Navegação no celular | A tabela exigia arrastar horizontalmente e vários controles tinham apenas 24–32 px de altura. | Chamados apresentados como cartões com rótulos de estado, prioridade, responsável e data; controles principais com 44–50 px de altura; menu com fundo de bloqueio, contenção de foco, Escape e retorno ao acionador. |
| Hierarquia | Banner decorativo, mensagens genéricas e notificações indisponíveis competiam com os chamados. | Títulos diretos, ação de novo chamado destacada, resumo com contagens reais e remoção do botão de notificações indisponíveis. No celular, o resumo repetido é ocultado para aproximar os chamados do início da tela. |
| Estados | Botões mostravam apenas spinner; erros de formulários e dados ainda não carregados nem sempre tinham contexto claro. | Texto durante envio, atualização da busca anunciada, carregamento de conversa e de privacidade, distinção entre espera e lista vazia, limpeza de filtros e nova tentativa. |
| Espaçamento | Havia densidade excessiva nos controles e bastante espaço ocupado por decoração. | Grupos com separações consistentes, campos de formulário com respiro e grade do painel ajustada por largura; formulário de criação de empresa sem repetir o painel de apresentação do login. |
| Fluidez | Faltavam estados visíveis nas atualizações e o carregamento de rota tinha estrutura diferente do painel. | Preservada a estrutura de navegação durante carregamento, placeholders estáticos, transições curtas de cor e menu e suporte a movimento reduzido. A escolha de cookies fica no fluxo da página para não cobrir campos ou ações. |
| Consistência | Acesso, painel e páginas legais usavam tamanhos e cores diferentes, com sucessivos overrides. | Substituída a folha de estilos anterior por um sistema comum para botões, formulários, avisos, navegação, documentos, equipe e detalhes de chamados. |

## Interações de acesso

- Campo de senha com mostrar/ocultar, sem perder o valor digitado.
- Recuperação acessível junto ao campo de senha e ação de cadastro separada do login.
- Estados de envio com texto e prevenção de cliques repetidos.
- Erros recebem foco e os valores preenchidos permanecem disponíveis para correção.
- O formulário usa POST e o envio só fica habilitado após a hidratação, evitando envio nativo dos campos na URL antes de o JavaScript ficar pronto.
- Demonstração aparece no login somente quando o servidor informa que ela está disponível. Falhas ao abri-la são apresentadas na própria tela.

## Interações do painel

- Navegação ativa identificada com texto, destaque e `aria-current`.
- Filtros de estado expõem a seleção com `aria-pressed`; busca mantém atalho de teclado.
- Resultados atualizados são anunciados sem substituir a fila por uma tela vazia.
- Paginação com nomes acessíveis e indicação da página atual.
- Removidos os checkboxes desabilitados de seleção em lote, pois a ação correspondente não existe.
- Erros de criação de convite aparecem dentro do diálogo ativo.
- Títulos, descrições, comentários e nomes longos podem quebrar linha.
- Papéis de tabela, linha e célula são explícitos para preservar a estrutura acessível na apresentação móvel.

## Limites da entrega

As mudanças são de apresentação e interação. Não alteram políticas de RLS, permissões, contratos HTTP, versão dos documentos legais, quotas nem dados de produção. Os testes de jornada usam a demonstração isolada; não equivalem à validação integral de operações no banco remoto. Não foi realizado teste de uso com participantes nem auditoria completa com leitores de tela reais.

As evidências de validação e publicação desta etapa são registradas no README após a conclusão das verificações.
