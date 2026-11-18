# MFA administrativo

## Escopo

Somente contas presentes em `platform_admins` acessam a página e a API de MFA. Administrador de uma empresa não recebe esse privilégio. O servidor usa o cliente Supabase da sessão, com chave pública e cookies HttpOnly; cadastro e confirmação de TOTP são delegados ao Supabase Auth. Referências: [enroll](https://supabase.com/docs/reference/javascript/auth-mfa-enroll) e [challengeAndVerify](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify).

`/conta/seguranca` permanece acessível em AAL1 e independentemente da flag de aparência/configurações. Sem isso, um administrador poderia ser bloqueado antes de confirmar o próprio segundo fator. A API exige o papel global também em AAL1; ela não concede privilégios administrativos nem retorna tokens ao JavaScript do navegador. O guard existente valida o AAL dos claims e a identidade da sessão nas operações protegidas.

Um cadastro incompleto é listado como pendente. Se a página for recarregada e a chave não estiver mais disponível, cancele explicitamente o cadastro e inicie outro. Um fator já confirmado não pode ser cancelado por essa API. Não há remoção automática de fatores nem recuperação por e-mail nesta entrega.

## Ativação por ambiente

1. Em homologação, conferir se TOTP permite cadastro e verificação no Supabase Auth. A configuração local está em `[auth.mfa.totp]` no arquivo do CLI; ela não altera automaticamente o projeto hospedado.
2. Publicar o código com `ENFORCE_PLATFORM_ADMIN_AAL2=false` e cadastrar o aplicativo autenticador de cada administrador autorizado. A chave e o QR code são segredos: não anexar a chamados, capturas ou logs.
3. Confirmar o código, sair da conta e entrar novamente. A nova sessão precisa confirmar outro código. Testar código incorreto, sessão expirada, navegação por teclado, celular e inglês.
4. Preparar um responsável com acesso seguro ao painel do Supabase para recuperação e verificar sua identidade por um canal previamente estabelecido. Ensaiar recuperação com uma conta sintética antes de exigir MFA de contas reais.
5. Ativar `ENFORCE_PLATFORM_ADMIN_AAL2=true` no ambiente de homologação e publicar novamente. Validar que a fila administrativa e as mutações protegidas recusam AAL1 e funcionam depois de confirmar TOTP.
6. Repetir o procedimento de cadastro e recuperação com os administradores de produção antes de ativar a opção nesse ambiente. Validar Redis, cookies, HTTPS e ausência de segredos nos logs.

## Recuperação operacional

O responsável pela plataforma deve verificar a identidade do administrador e registrar a solicitação sem incluir chaves TOTP. A remoção de um fator perdido deve ocorrer pelo painel seguro do Supabase ou por uma ferramenta administrativa isolada e autorizada. Nunca adicionar service role ao Next.js para esse fim.

Após remover o fator comprometido/perdido, revogar as sessões pertinentes e exigir novo login e novo cadastro TOTP. Confirmar AAL2 antes de encerrar o incidente. Manter mais de um responsável autorizado para evitar depender de uma única pessoa; isso não significa compartilhar contas ou chaves.

Não desligar a exigência global como procedimento normal de recuperação. Não foram implementados códigos de recuperação nem validada a recuperação de uma conta real.

## Limites e validação

- A flag protege somente os pontos Next.js que chamam o guard. O acesso direto ao banco gerenciado ainda obedece às políticas e funções existentes, sem requisito novo de AAL2. Cobertura de AAL no banco é uma etapa separada, pois a tarefa preserva as RLS e funções SQL existentes.
- O limitador do app não substitui os limites de MFA do Supabase Auth, que também devem ser revisados.
- A chave de cadastro fica em memória no cliente durante a configuração. Não é gravada no banco da aplicação, localStorage ou logs. O Supabase administra o segredo TOTP.
- A suíte conectada usa Supabase local descartável e conta sintética, com capturas, vídeo e traces desativados para não registrar a chave. Não comprova operação de recuperação ou cadastro em produção.
- Não há mudança de schema nesta entrega; testes SQL existentes continuam no CI. Vitest cobre contratos, autorização, erros do provedor, propriedade do fator, limite por conta e recusa quando o Redis falha.

## Ensaio hospedado de recuperação — 18/11/2026

Executado no projeto de homologação, com duas contas sintéticas descartáveis e clientes sem persistência de sessão. Nenhum fator de conta real foi alterado. As duas contas foram removidas ao final, inclusive após a primeira assertiva falhar.

- Primeiro cenário: cadastrar e confirmar TOTP, remover o fator pela API administrativa e tentar renovar a sessão anterior. A renovação ainda funcionou: remover o fator isoladamente não foi suficiente no ambiente observado.
- Segundo cenário: revogar explicitamente todas as sessões (`auth.admin.signOut(accessToken, 'global')`) antes de remover o fator. A renovação com o refresh token antigo foi recusada; `getUser` com o JWT anterior também foi recusado neste ensaio.
- O novo login retornou AAL1, sem o fator perdido. Um novo fator TOTP foi cadastrado e confirmado; a sessão alcançou AAL2.

O segundo cenário passou, mas usou o access token da própria conta sintética, disponível somente em memória. Isso não demonstra recuperação de uma conta real cujo token não esteja disponível ao operador. Antes da ativação obrigatória, validar no painel administrativo um procedimento de revogação por usuário que não dependa de pedir tokens ao titular. Não solicitar tokens de sessão, QR codes ou segredos TOTP ao usuário.

JWTs já emitidos podem continuar válidos até expirar em verificações locais ou serviços que não consultam a sessão. O resultado de `getUser` neste ensaio não prova revogação universal de acesso direto ao banco. Referência: https://supabase.com/docs/guides/auth/signout.

A exigência global permanece desativada enquanto essa etapa operacional não estiver validada. Não houve alteração de RLS, migração, dependência ou configuração de produção.
