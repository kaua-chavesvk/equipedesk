# Homologação de segurança, convites e filtros — 18/11/2026

## Código e ambientes

- Código publicado no Preview: commit `58aabe1`.
- Deployment Vercel: `dpl_8hmH6z2YTFGW4esRKWPiJwefa5gC`, estado READY, ambiente preview.
- URL fixa: https://equipedesk-configuracoes-preview.vercel.app
- URL do deployment: https://miakaelsondesk-lzp7cs0ca-kaua-chavesvk.vercel.app
- Supabase de homologação: `wsowjsayahmrobnyifqb`, nome `equipedesk-homologaçao`.
- A produção permaneceu no commit `715261e694eae15a645d493cbe3393eac5e9005f`, conforme consulta à Vercel.

A proteção de acesso da Vercel foi mantida. A conferência HTTP usou o bypass autenticado do CLI, sem expor a credencial ou tornar o Preview público. Para abrir a URL no navegador, a pessoa precisa ter acesso ao Preview pela Vercel e depois autenticar no EquipeDesk.

O CLI do Supabase chama a branch principal de cada projeto de “production”. Neste ensaio, o alvo foi conferido pelo identificador `wsowjsayahmrobnyifqb`, pertencente ao projeto de homologação. Nenhuma migração foi aplicada ao projeto `egaawazfgzaodzwgzxuc`.

## Migrações

O dry-run apontou somente:

1. `202611170001_invite_renewal.sql`.
2. `202611170002_saved_ticket_filters.sql`.

Ambas foram aplicadas com o worktree isolado já vinculado ao projeto de homologação. A listagem posterior confirmou dez migrações locais/remotas alinhadas. A tabela `user_ticket_filters` está com RLS habilitado.

## Testes SQL no banco hospedado

Foram executadas as suítes versionadas de renovação de convite (oito assertivas) e filtros pessoais (14 assertivas). Um invólucro temporário capturou os resultados TAP, recusou qualquer `not ok` ou contagem divergente e executou rollback. O sucesso foi emitido somente após a verificação das assertivas.

Resultados: oito e 14 assertivas aprovadas. Uma consulta posterior confirmou ausência dos usuários e empresas das fixtures. Não foram executadas todas as suítes históricas no banco hospedado nesta operação; a suíte completa permanece comprovada pelo CI local descartável.

## Jornada HTTP autenticada

Foi criada conta com e-mail sintético no domínio reservado `equipedesk-test.invalid`, senha aleatória e uma empresa exclusiva de ensaio. Não houve envio de e-mail.

Sete verificações passaram:

1. Login no Preview. O limitador Redis respondeu no caminho de autenticação.
2. Criação de empresa pela sessão autenticada.
3. Recusa HTTP 403 na API de MFA para administrador somente da empresa.
4. Filtros pessoais: gravação, leitura persistida e recusa 409 de versão antiga, sem sobrescrita.
5. Convites: criação, listagem de pendentes, renovação com token diferente e revogação.
6. Após concessão temporária de papel global à conta sintética: cadastro TOTP, QR code base64, confirmação com AAL2, status sem segredo e recusa de remoção do fator confirmado.
7. Leitura HTTP 200 da página autenticada da fila com os filtros novos.

Esta jornada conferiu respostas HTTP e conteúdo renderizado pelo servidor. Não foi uma nova avaliação visual/interativa no navegador do deployment hospedado. Os testes de navegador e de tela móvel permanecem documentados no CI do commit `4f016b8`.

## Limpeza e credenciais

O provisionamento e a limpeza usaram um processo CLI separado. Nenhuma chave administrativa foi acrescentada às variáveis do processo web. Senhas, sessões e segredos TOTP não foram impressos ou gravados no repositório.

As relações antigas de empresa usam chaves estrangeiras que exigem remover registros dependentes antes da empresa. A limpeza respeitou essa ordem, limitada às organizações sintéticas identificadas por slug e nome do ensaio. Foram removidos os aceites sintéticos e o papel global temporário, além das contas de teste pelo Auth administrativo.

A conferência final confirmou zero contas e zero empresas do ensaio. Os arquivos temporários com payloads/cookies foram removidos.

## Limites e prioridades restantes

- `ENFORCE_PLATFORM_ADMIN_AAL2=false` foi definido explicitamente neste deployment. O TOTP hospedado funcionou com conta sintética; administradores reais ainda precisam cadastrar o fator e ensaiar recuperação antes de torná-lo obrigatório.
- A proteção AAL2 do Next não foi estendida às políticas SQL existentes.
- A auditoria segue reportando `GHSA-fc5q-39xc-vjpf`; o registro e o npm consultados em 18/11 ainda não apresentam versão corrigida de picomatch. Nenhuma exceção foi adicionada.
- A resposta de provisionamento do Redis temporário foi recuperada em armazenamento local protegido e confirmou expiração em 19/11/2026. O titular informou que ainda não realizou o Claim. O painel privado foi fornecido fora do repositório para vinculação à conta Upstash. O ensaio de hoje confirmou funcionamento, não extensão da validade. Aguardando essa ação autenticada do titular.
- Nenhum pacote desta frente foi publicado em produção nesta operação.
- E-mail transacional, alertas externos, restauração de arquivos Storage e recuperação real de conta continuam pendentes.

## Verificação após vinculação do Redis

Em 18/11/2026, o titular informou que concluiu o Claim na conta Upstash. A verificação posterior confirmou `PING → PONG` com as credenciais já configuradas e HTTP 200 em `/login` no Preview, acessado pelo CLI autorizado da Vercel. Nenhuma variável foi trocada e nenhum deployment adicional foi necessário. O HTTP 200 confere a disponibilidade da página; não representa um novo teste de login autenticado.

A consulta idempotente ao provisionamento temporário retornou `not found`. Por isso, a vinculação fica registrada como confirmação do titular; funcionamento foi verificado diretamente, mas a política de expiração/plano na conta não foi inspecionada. O registro de espera acima descreve o momento anterior à confirmação. Nenhuma credencial ou URL privada de vinculação foi publicada.

A próxima dependência operacional é preparar os administradores reais e ensaiar recuperação de MFA antes de ativar a exigência de AAL2.
