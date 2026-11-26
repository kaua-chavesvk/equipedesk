# Validação atual — 18/11/2026

Resultado local desta revisão de apresentação e organização do código. Ambiente: Windows, Node.js 26.13.1, pnpm 11.25.0. O CI usa Node.js 24; essa diferença é uma limitação da reprodução local, não uma execução em máquina limpa.

| Verificação                                        | Resultado                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Instalação com lockfile antes das alterações       | Aprovada                                                                                                                            |
| ESLint após refatoração                            | Aprovado                                                                                                                            |
| TypeScript após separação dos handlers             | Aprovado                                                                                                                            |
| Vitest após refatoração                            | 178 testes aprovados em 23 arquivos                                                                                                 |
| Documentos legais versionados                      | Hashes e templates conferidos                                                                                                       |
| Scanner de segredos                                | Arquivos atuais e histórico sem achados                                                                                             |
| E2E selecionados: journey e workspace-interactions | 39 aprovados, 2 falhas, 1 ignorado                                                                                                  |
| Repetição das duas interações                      | Atualização otimista passou em desktop e celular; arrastar no desktop continuou com timeout; variante de toque ignorada por projeto |

A falha de arrastar ocorre antes de uma requisição de transição ser observada. Não foi atribuída à API sem evidência; permanece aberta para investigação da interação nativa no navegador. Os testes de criação, comentário, resolução, reabertura, disputa de versão e isolamento pela API demo passaram. Esta execução não representa nova validação SQL ou Supabase remoto.

O build final (`pnpm build`) concluiu compilação, TypeScript, geração de páginas e coleta de traces. A formatação final (`pnpm format:check`) foi aprovada. A auditoria de dependências anterior mantém um alerta alto de picomatch sem versão corrigida informada. Avisos de Vite/CommonJS e depreciação do Node foram observados.

Contagens em relatórios antigos pertencem às respectivas execuções. Este documento centraliza o resultado vigente; não alterar evidências históricas para simular que testes novos existiam antes.

A gravação `artifacts/equipedesk-demo.webm` tem 177,96 segundos, resolução 1280 × 800, e usa a demonstração local e legendas técnicas. Não contém conta real nem configuração de MFA. Não houve deploy nesta revisão.

## Revisão de portfólio — 26/11/2026

Instalação com lockfile, lint, tipos e 178 testes unitários em 23 arquivos aprovados na nova cópia local. A verificação legal passou após normalização de finais de linha no Windows; conteúdo protegido preservado. Actions foram resolvidas via tags oficiais para SHA completo. MIT escolhida pelo titular. GIF de três quadros extraído do vídeo demonstrativo existente; captura desktop refeita sem aviso sobreposto e sem sublinhado permanente. A revisão da faixa lateral usa fundo de documento para a captura completa.

Demo pública: projeto separado criado, aguardando configuração Redis no painel; não anunciada como disponível. Esta revisão não foi publicada no site oficial.

Build local desta revisão concluído com sucesso. Alteração final de fundo lateral é apenas CSS. A suíte E2E completa não foi repetida nesta revisão; as falhas antigas continuam registradas.
