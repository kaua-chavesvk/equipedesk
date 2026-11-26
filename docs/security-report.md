# Relatório de segurança — 12/11/2026

## Escopo e resultado

Revisão do código local, dependências, migrações, configuração e rotas HTTP do EquipeDesk. Esta revisão não é uma garantia contra invasões nem um pentest de um serviço publicado. Não há Supabase, Redis ou domínio de produção conectados neste ambiente. As mudanças de banco precisam ser aplicadas e testadas antes da publicação.

## Falhas encontradas e correções

| Gravidade             | Falha encontrada                                                          | Correção                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta                  | Requisições mutáveis sem `Origin` eram aceitas                            | Produção exige origem canônica e rejeita `Sec-Fetch-Site: cross-site`; desenvolvimento aceita clientes de teste sem cabeçalhos de navegador              |
| Alta                  | Ausência de limite de requisições                                         | Redis REST com incremento e expiração atômicos; 10 requisições/minuto no endpoint Auth e 120/minuto nas demais APIs, por origem de rede confiável        |
| Alta                  | API de dados permitia contornar o limitador HTTP do app                   | Migração adiciona quota de 120 comandos/minuto por usuário autenticado na função transacional                                                            |
| Alta                  | RPC aceitava campos adicionais ignorados pela implementação               | Lista de campos permitidos por comando e rejeição de payload que não seja objeto; título exige 5–160 caracteres também no comando SQL                    |
| Alta                  | Chaves públicas e URLs não tinham verificação de configuração             | Rejeição de chave `service_role`/`sb_secret_` como pública, prefixos públicos para segredos, URLs sem HTTPS e configuração incompleta                    |
| Média                 | Não havia CSP nem proteção explícita contra framing                       | CSP com nonce por resposta, `frame-ancestors 'none'`, `X-Frame-Options: DENY` e demais cabeçalhos                                                        |
| Média                 | Cookie SSR não tinha política explícita de endurecimento                  | `HttpOnly`, `SameSite=Lax`, `Secure` em produção e caminho `/`; helper de autenticação no navegador sem uso foi removido                                 |
| Média                 | JSON era lido sem limite explícito e erro de sintaxe virava erro genérico | Leitura incremental limitada a 32 KiB, inclusive sem Content-Length; 400 para JSON inválido, 413 para excesso e 415 para tipos não aceitos               |
| Média                 | Equipe administrativa podia ser aberta diretamente por não administrador  | Página de equipe restrita a administrador; API e banco continuam verificando papéis                                                                      |
| Média                 | Redirecionamento no formulário não rejeitava barras invertidas            | Helper compartilhado restringe redirecionamentos a caminhos locais sem barras invertidas ou caracteres de controle                                       |
| Média                 | Links de recuperação usavam expiração implícita do serviço                | Expiração local de OTP explicitada em 900 segundos; hospedagem deve espelhar esse ajuste no Supabase                                                     |
| Média                 | Eventos suspeitos não tinham registro estruturado                         | Logs JSON para CSRF, limites, configuração inválida, caminhos privados, falhas de autenticação e acesso negado, sem credenciais ou conteúdo dos chamados |
| Crítica/alta/moderada | Auditoria encontrou 14 alertas em dependências                            | Zod atualizado de 4.3.6 para 4.6.7; `tar` fixado em 7.5.23 e `minimatch` vulnerável substituído por 11.0.8 via overrides; lockfile atualizado            |

Os alertas iniciais eram: 1 crítico, 9 altos e 4 moderados. `tar` era dependência de desenvolvimento do Supabase CLI, não uma biblioteca de upload do produto. Após as atualizações, `pnpm audit --json` retornou zero alertas conhecidos. Isso descreve o resultado do banco de avisos consultado nesta data, não ausência de vulnerabilidades desconhecidas. Os avisos de Zod e minimatch podem ser conferidos nas fontes [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) e [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Cobertura dos itens solicitados

| Item                       | Situação                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Autenticação            | Supabase Auth com sessão validada no servidor, PKCE no callback e checagem de usuário para alterar senha; operação real pendente de conexão                                                   |
| 2. Banco                   | RLS, grants restritos, funções com `search_path` vazio, isolamento por empresa, validação adicional e quota de comandos; testes SQL pendentes                                                 |
| 3. HTTPS                   | Redirecionamento canônico e HSTS em produção; certificado TLS e proxy de hospedagem ainda precisam ser configurados                                                                           |
| 4. Formulários no servidor | Schemas estritos Zod, limites e leitor JSON limitado em todos os Route Handlers de escrita                                                                                                    |
| 5. XSS                     | Conteúdo textual escapado pelo React; não foi encontrado uso de `dangerouslySetInnerHTML`, `innerHTML` ou `eval` no código da aplicação; CSP por nonce                                        |
| 6. Monitoramento           | Logs estruturados implementados; agregação, retenção e alertas externos não estão conectados                                                                                                  |
| 7. Admin                   | Equipe restrita na página, API e banco; administrador geral atribuído apenas pelo processo administrativo                                                                                     |
| 8. Ambiente                | Validação em runtime antes de servir rotas; modelo `.env.example` atualizado; sem valores reais encontrados/configurados                                                                      |
| 9. Limites                 | Redis distribuído obrigatório em produção; memória limitada apenas em desenvolvimento; quota SQL adicional                                                                                    |
| 10. Cabeçalhos             | CSP, HSTS, nosniff, DENY, no-referrer, Permissions-Policy, COOP e no-store nas respostas privadas                                                                                             |
| 11. Cookies                | HttpOnly, Secure em produção, SameSite=Lax; sessão continua gerenciada pelo Supabase                                                                                                          |
| 12. CSRF                   | Origem canônica obrigatória para mutações em produção, verificação de Fetch Metadata e JSON obrigatório; nenhuma exceção pública de webhook                                                   |
| 13. Recuperação            | Link verificado e consumido pelo provedor; OTP local de 15 minutos; comportamento remoto ainda precisa ser validado                                                                           |
| 14. Arquivos               | Uploads não existem neste produto e são recusados com 415; não há um subsistema de anexos considerado seguro ou liberado                                                                      |
| 15. Debug                  | Indicadores desativados, source maps públicos de produção desativados, mensagens internas não enviadas em erros 500; use `next start`, nunca `next dev`, em produção                          |
| 16. Dependências           | Atualizadas as dependências apontadas pelo audit; CI passa a bloquear alertas moderados ou superiores                                                                                         |
| 17. Arquivos expostos      | Sem diretório `public` neste projeto; bloqueio adicional de .env, .git, .tools, node_modules, SQL, maps, backups e logs; testes HTTP de caminhos privados                                     |
| 18. Histórico Git          | Indisponível: esta pasta não contém repositório Git; scanner preparado para revisar histórico quando disponível e CI usa checkout completo                                                    |
| 19. Rotação de chaves      | Nenhuma chave real identificada pelos padrões pesquisados; nenhuma chave revogada ou trocada sem evidência de comprometimento e acesso ao provedor                                            |
| 20. Testes                 | Testes unitários e de navegador adicionados; ver evidências abaixo; teste de PostgreSQL real e validação externa ainda são necessários                                                        |
| 21. Relatório              | Este documento, com falhas, correções, limitações e operação                                                                                                                                  |
| Chaves de API              | Somente URL e chave pública do Supabase podem ir ao navegador; chave administrativa fica exclusivamente no terminal dos scripts                                                               |
| Hash de senhas             | Supabase Auth armazena hashes com bcrypt e salt. Argon2id não foi implementado nem é o algoritmo do provedor atual                                                                            |
| Consultas parametrizadas   | SDK/PostgREST e RPC com argumentos; SQL sem execução dinâmica de entrada do usuário; padrões de busca escapados                                                                               |
| CORS                       | Sem `Access-Control-Allow-Origin: *` na aplicação; preflight de APIs recusado e mutações de outra origem bloqueadas. A API gerenciada do Supabase continua dependente de tokens, grants e RLS |
| Revisão final              | Feita no código e nos testes locais; liberação externa condicionada aos itens de implantação                                                                                                  |

O Supabase documenta seu algoritmo de armazenamento de senha em [Password security](https://supabase.com/docs/guides/auth/password-security). Trocar o algoritmo para Argon2id exigiria mudar a arquitetura de autenticação; não foi criado um segundo armazenamento de senhas no aplicativo. A aplicação nunca persiste senhas em tabelas próprias.

## Configuração obrigatória antes da publicação

1. Aplicar todas as migrações, inclusive `202611120001_platform_admins.sql` e `202611120002_command_validation.sql`, em staging; executar `pnpm db:test` e o teste conectado da API de dados.
2. Configurar `NEXT_PUBLIC_SITE_URL` com a origem HTTPS exata, URL HTTPS e chave pública do Supabase. A chave administrativa não deve existir no processo web. Desabilitar `DEMO_MODE` para uso real.
3. Configurar `RATE_LIMIT_REDIS_URL` e `RATE_LIMIT_REDIS_TOKEN` em um serviço Redis REST compatível com `EVAL`. Em produção, ausência ou falha do limitador retorna 503. O backend Redis foi testado por simulação, não conectado a um serviço real.
4. Na Vercel, com a variável de sistema `VERCEL=1`, a aplicação usa um único IP válido de `X-Vercel-Forwarded-For`. Fora dela, configure `TRUST_PROXY=true` somente quando o ingresso sobrescrever `X-Real-IP` e `X-Forwarded-Proto` e o acesso direto à origem estiver bloqueado. A aplicação aceita apenas `http` ou `https` como valores encaminhados do protocolo.
5. Em produção, `/api/auth` tem teto global de 600 requisições por minuto e 60 por IP conhecido. Login tem limite adicional de 10 por IP e e-mail normalizado. Quando o IP não está disponível, o limite de login é de 10 por e-mail, sob o teto global. Outras APIs mantêm 120 por IP conhecido e usam um teto compartilhado de 600 na ausência dele. Os limites são por janela de 60 segundos e as chaves usam HMAC com o token do Redis.
6. Mantenha `ENFORCE_PLATFORM_ADMIN_AAL2=false` até preparar os administradores. A interface em `/conta/seguranca` implementa cadastro TOTP com `mfa.enroll` e confirmação com `mfa.challengeAndVerify`, sem service role no processo web. Valide renovação da sessão e recuperação para um administrador que perdeu o fator conforme [o roteiro](admin-mfa.md). A opção protege os pontos administrativos Next.js que usam o guard. Para cobrir acesso direto via PostgREST e RPC, a política precisa também ser aplicada no Supabase. Essa parte exige uma mudança de banco separada.

## Revisão da Fase 2 em 17/11/2026

A auditoria de dependências passou a apontar `GHSA-fc5q-39xc-vjpf`, atualizado em 17/11: ReDoS em `picomatch <=4.0.7`, sem versão corrigida publicada na consulta. Os caminhos reportados pertencem às dependências de desenvolvimento de ESLint/Vitest. Não foi acrescentada exceção nem reduzido o nível da auditoria. O CI executa auditoria e validação funcional em jobs independentes, para testar a aplicação mantendo a auditoria reprovada como pendência de publicação. Conferir [o aviso](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) e atualizar a dependência transitiva quando houver correção compatível. O build do Next também pode conter cópias empacotadas; a classificação como desenvolvimento não comprova ausência de exposição no framework. A aplicação não oferece campos de glob fornecido pelo usuário.

A CSP candidata usa `base-uri 'none'` em `Content-Security-Policy-Report-Only`, junto à política aplicada com `base-uri 'self'`. O navegador permite observar as violações no console. A coleta centralizada depende de definir um destino de relatórios e revisar a retenção, porque relatórios podem incluir URLs da página. Os cabeçalhos desta entrega permitem a inspeção manual no navegador.

Dependabot consulta os ecossistemas npm e GitHub Actions semanalmente. O workflow CodeQL usa JavaScript/TypeScript, modo de build `none`, análise de PRs para `main`, pushes na `main` e execução semanal. A permissão `security-events: write` fica restrita ao job de análise.

A suíte `supabase/tests/isolation.test.sql` verifica isolamento e versões antigas. O script `scripts/test-data-api.mjs` já envia duas atribuições simultâneas por sessões distintas ao PostgreSQL local. A revisão acrescenta a verificação do responsável, estado e versão persistidos após a disputa e a reabertura pelo solicitante com motivo. A execução no CI anterior está registrada em https://github.com/kaua-chavesvk/equipedesk/actions/runs/44098181819. Os novos asserts precisam de uma nova execução com Supabase local. Esta máquina está sem Docker, Podman e psql.

### Configurações de identidade observadas

A consulta de configuração de produção retornou mínimo de seis caracteres, enquanto a aplicação e o arquivo local exigem oito. O tempo limite de inatividade hospedado está em `0s`. TOTP está habilitado no provedor para cadastro e verificação. A proteção de senhas vazadas precisa de confirmação no painel. O alinhamento de senha, o prazo de inatividade e a ativação de AAL2 devem ser ensaiados na homologação e publicados com os administradores preparados.

A consulta de aceites mantém a checagem por usuário, versão de termos e versão de privacidade. O índice existente começa por `user_id`. Antes de adicionar cache, medir o tempo dessa consulta. Um cache positivo só preserva revogação imediata com invalidação confiável. Uma janela de TTL isolada altera essa garantia.

### Entregas operacionais pendentes

- SMTP e mensagens transacionais precisam de provedor, domínio remetente e conta de teste autorizada. Conferir entrega, links, expiração e recuperação em caixa real antes de registrar sucesso.
- O CI já ensaia dump e restauração do banco sintético em um banco separado dentro do Supabase local descartável, com comparação de dados e isolamento por RLS. Esse ensaio não restaura arquivos Storage nem comprova recuperação de backup real de produção. O backup de banco e a cópia dos arquivos do Storage precisam ser verificados juntos para esse segundo objetivo.
- Os logs estruturados existentes informam rota padronizada, status, duração e ID da requisição. Alertas precisam de destino e critério operacional definidos. Monitoramento externo de erros exige configuração do serviço.
- Perfis e a linha do tempo unificada já existem. A gestão de convites agora lista pendentes e expirados, revoga e gera novo link na mesma transação que invalida o anterior. O envio automático depende do provedor de e-mail.

5. Configurar certificado TLS, redirecionamento na borda, limites de corpo e proteção contra DDoS na hospedagem. HSTS inclui subdomínios: todos devem suportar HTTPS.
6. No Supabase hospedado, definir expiração de e-mail/OTP de 900 segundos, confirmação de e-mail, URLs de callback exatas e revisar limites próprios de Auth e CAPTCHA. O limitador do app não substitui os controles do endpoint Auth público do Supabase.
7. Conectar logs da hospedagem a retenção e alertas para aumento de `auth_failed`, `csrf_rejected`, `rate_limit`, `access_denied`, `environment_invalid` e `rate_limit_unavailable`. Evitar registrar URLs de convites e query strings de callbacks no ingresso.
8. Habilitar MFA para contas administrativas no provedor e completar a jornada pela interface de MFA antes de ativar AAL2 no ambiente hospedado. A presença da interface não significa que contas reais já cadastraram o fator ou que existe enforcement de AAL2 no banco.
9. Configurar backups, recuperação e acesso à administração do Supabase. Validar isolamento com credenciais reais de solicitante, atendente, administrador local e administrador geral.

## Segredos e resposta a incidente

`node scripts/scan-secrets.mjs` inspeciona padrões conhecidos nos arquivos atuais e, se presente, nos diffs de todo o histórico Git disponível. Os resultados mostram somente localização e categoria, nunca o segredo. O scanner é heurístico; não detecta todo formato de credencial ou senha. A CI usa `--require-history` e falha se não conseguir revisar o histórico.

Neste ambiente: arquivos atuais revisados, nenhum padrão detectado e histórico indisponível. Não foi constatado comprometimento de chave. Se um segredo real for encontrado no histórico ou nos logs, revogar no provedor, gerar substituto, atualizar apenas o ambiente servidor, invalidar sessões pertinentes e verificar uso indevido. Remover a linha do Git sem revogar a chave não resolve o incidente. As senhas fornecidas na conversa não foram gravadas no repositório e devem ser substituídas por uma senha exclusiva antes do provisionamento de uma conta real.

## Limitações deliberadas

- CSP permite estilos inline porque a interface usa atributos de estilo; scripts inline genéricos e `eval` não são permitidos na CSP de produção. Em desenvolvimento, `unsafe-eval` é necessário ao Next.js.
- Não existe console de segurança ou envio automático de alertas externos nesta entrega.
- A quota SQL conta transações concluídas: operações que falham sofrem rollback e não consomem sua quota. Leituras diretas e tentativas inválidas na API gerenciada exigem os limites e a proteção de borda do Supabase; a quota não é uma defesa isolada contra DDoS.
- Não foi executado ataque de carga, pentest externo, teste de TLS de domínio hospedado, teste de Redis real ou teste de recuperação via e-mail remoto.
- Não há promessa de 27 controles distintos: foram revisados os 21 itens enumerados e os cinco complementos enviados, sem inventar o título que não foi capturado.

## Evidências

- Auditoria inicial: 14 alertas; auditoria após atualização: zero.
- Testes unitários: 59 passaram em seis arquivos.
- Navegador: 22 cenários existentes passaram na suíte; os quatro novos casos de segurança passaram na reexecução após corrigir os testes (desktop e celular). Eles cobrem CSRF, cabeçalhos, JSON inválido, excesso de corpo, recusa de upload, caminhos privados, escape de HTML e bloqueio de script sem nonce.
- `pnpm typecheck` e `pnpm lint`: passaram.
- `pnpm build`: passou, incluindo compilação de produção e TypeScript.
- Smoke test com `next start` em produção: API retornou 503 por configuração ausente, com HSTS, DENY, nosniff e cache privado/no-store; sem `X-Powered-By` ou detalhes internos na resposta. Servidor de teste encerrado após a verificação.
- Scanner: nenhum padrão de segredo nos arquivos atuais; histórico Git indisponível.
- `scripts/check-env.mjs`: reprovou corretamente este ambiente para produção, apontando ausência de SITE_URL, Supabase e limitador distribuído.
- SQL: adicionados cenários de campos desconhecidos, payload inválido e quota por usuário; execução real pendente.
