# Configurações de aparência e conta — levantamento da Fase 1

Data: **16/11/2026**, America/Sao_Paulo. Base de código: `d4a6bd4`. Branch de trabalho criada nesta etapa: `feature/configuracoes-conta`.

## 1. Escopo e decisões confirmadas

O pedido atual trata de aparência, idioma, preferências e conta. A Fase 1 termina neste relatório, sem implementação. Os documentos de descoberta/desenho da integração de e-mail que já estavam no diretório de trabalho foram preservados; essa integração ainda não está implementada.

Respostas explícitas do usuário nesta fase:

- **Idiomas: português do Brasil e inglês.** Português continua sendo o padrão. O identificador regional do inglês e os critérios de formatação serão definidos no desenho.
- **Foto: visível para colegas que compartilham uma empresa com a pessoa**, além da própria pessoa. Vínculo real compartilhado será necessário; ser administrador geral não deve, por si só, tornar alguém colega de todas as pessoas.

Ainda são propostas/exemplos do pedido, não decisões finais: escopo por usuário/empresa, tamanho máximo da foto, resolução final, densidade e alto contraste. O tema atual claro/escuro/sistema e a paleta existente são o ponto de partida a preservar no desenho. Os exemplos de **2 MB** e **256 × 256 px** podem ser propostos na Fase 2, sem serem apresentados como limites já implementados.

## 2. Fontes e evidências

Foram lidos `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/tasks.md`, `docs/frontend-ux.md`, `docs/privacy-operations.md` e `docs/api.md`. Também foram examinados layouts, componentes de aparência/conta/privacidade/workspace, proxy, schemas HTTP, tipos Supabase, seis migrações, configuração local e testes existentes relacionados.

Documentação da versão instalada consultada: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` e a referência de `Image`, em especial o aviso sobre imagens autenticadas e o loader padrão.

| Verificação realizada                                                        | Resultado observado                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short` inicial                                                 | Havia mudanças documentais anteriores: `docs/progress.md`, `docs/descoberta-integracao.md` e `docs/integracao.md`; preservadas   |
| `git switch -c feature/configuracoes-conta`                                  | Branch criada; sem commit/push                                                                                                   |
| Busca de tabelas/políticas de perfis e Storage nas seis migrações e tipos    | Não há tabela de perfis, bucket de fotos nem política de Storage declarados no projeto                                           |
| Busca de `.storage`, `createSignedUrl`, upload e caminhos de avatar em `src` | Nenhum fluxo de foto/Storage implementado encontrado                                                                             |
| Inspeção de `ui-providers.tsx` e do pacote next-themes instalado             | Tema com classe no HTML, padrão sistema, chave local padrão `theme`; sem persistência por conta                                  |
| Busca de infraestrutura de locale/dicionários e dependências                 | Não há dicionários, provider de locale ou biblioteca de internacionalização configurada                                          |
| Busca de `desk_cookie_choice` em `src`/testes                                | Endpoint escreve cookie; página legal o descreve; nenhum leitor funcional da escolha no código da interface atual foi encontrado |
| `pnpm why sharp`                                                             | Sharp 0.35.5 existe como dependência transitiva do Next.js, sem pipeline de avatar ou dependência direta do produto              |

Esta fase é inspeção estática e documentação. Não foram executados novos lint, tipos, testes, build, SQL, E2E ou inspeções visuais de 390/1440 px para esta frente. A presença de testes anteriores não comprova as novas configurações. Não foram consultados buckets/políticas do Supabase hospedado: a ausência local não prova ausência de um recurso manual no provedor.

## 3. Estado atual e lacunas

| Área                  | O que existe                                                                  | O que falta                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Tema                  | next-themes; claro, escuro e sistema; seletor no rodapé; escolha no navegador | Configurações autenticadas, persistência por conta, precedência entre conta/navegador e tratamento na troca de usuário |
| Cores e fontes        | CSS global com tokens claros/escuros; Helvetica; Tailwind 4 importado         | Escala única de texto, densidade e alto contraste configuráveis                                                        |
| Movimento             | MotionConfig/reduced motion e media queries CSS                               | Escolha manual e aplicação consistente entre CSS, Motion e componentes                                                 |
| Idioma                | HTML pt-BR e textos predominantemente literais em português                   | Tradução completa pt-BR/inglês, locale persistido, erros traduzíveis e regras de fallback                              |
| Datas/números         | Uso localizado de `toLocaleDateString`/`toLocaleString('pt-BR')`              | Serviço comum de formatos e fuso; política de SSR/hidratação; não há fluxo monetário no produto                        |
| Nome                  | Metadado `auth.user_metadata.name`; campo opcional no cadastro                | Tabela de perfis, edição autenticada e identificação dos demais membros                                                |
| Foto                  | Iniciais e classes de avatar                                                  | Bucket privado, RLS, normalização, URLs temporárias, remoção, versionamento e integração com todos os locais           |
| Preferências pessoais | Marketing no banco e tema local                                               | Tabela privada do usuário para preferências de aparência/uso; fila e home persistidas                                  |
| Cookies               | Endpoint e cookie necessário versionado; sem trackers ativos                  | Leitura/apresentação coerente da escolha atual, reutilizando a lógica existente                                        |
| Marketing             | Preferência com RLS e revogação na central de dados                           | Apenas acesso contextual pela futura configuração; não duplicar tabelas ou comando                                     |
| E-mail/senha          | Recuperação e alteração de senha existentes                                   | Troca de e-mail com reautenticação/confirmação; validar entrega no ambiente hospedado                                  |
| Exclusão              | Pedido de direitos com protocolo, atendimento administrativo                  | Orquestração de remoção de arquivos e perfis quando a exclusão for efetivamente atendida                               |

## 4. Perfis, nomes e visibilidade

### Origem atual dos dados

`src/lib/data.ts` resolve o próprio nome com `auth.user_metadata.name`, depois prefixo do e-mail e, por fim, “Você”. Ao carregar membros reais, usa `memberships`, atribui “Você” para a própria pessoa e **“Membro da equipe”** para as demais, com e-mail vazio. Não consulta perfis. A demonstração tem nomes fictícios completos e, portanto, pode esconder essa limitação do fluxo real.

`src/app/api/auth/route.ts` grava `name` nos metadados durante signup. O schema permite 1–100 caracteres após trim, mas não há ação para editar o perfil. A API de privacidade retorna o nome do mesmo metadado no resumo da conta. Não existe nome civil/legal separado no modelo atual; o nome de exibição não deve alterar aceites, seus hashes, autoria ou identidade do usuário.

`src/lib/supabase/database.types.ts` não inclui `profiles` nem preferências de interface. As tabelas `privacy_preferences` existentes são de **marketing**, não de aparência. A foto depende de um novo modelo de perfil, migração, tipos e RLS.

### Inventário dos pontos de exibição

| Local                            | Código/origem atual                                      | Situação para nome/foto                                                                    |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Cabeçalho do workspace           | `workspace.tsx`, `initials(data.user.name)`              | Mostra iniciais da própria pessoa; sem foto                                                |
| Rodapé da barra lateral          | Mesmo componente; nome, papel e iniciais                 | Deve refletir edição do perfil e manter papel vindo da autorização                         |
| Responsável na lista de chamados | `memberName(assignee_id)` e avatar com `initials(...)`   | Nome real de terceiros ainda ausente; cor depende do índice da linha                       |
| Kanban                           | `ticket-board.tsx` recebe função de nome do responsável  | Texto sem avatar; exige decisão de consistência no desenho                                 |
| Detalhes do chamado              | `memberName` para solicitante e responsável              | Apenas texto; considerar perfil sem ampliar acesso ao chamado                              |
| Comentários                      | `author_name` da demonstração ou `memberName(author_id)` | Nome sem foto; nomes de terceiros podem ser genéricos                                      |
| Eventos da linha do tempo        | Rótulo da ação e motivo/data; ícone de relógio           | `actor_id` existe nos dados, mas ator/nome/foto não são mostrados na renderização atual    |
| Lista de membros                 | `memberName`, iniciais e classes `color-${i%4}`          | Nomes reais/fotos dependem do perfil; cor varia com ordenação                              |
| Resumo dos próprios dados        | `/api/privacidade`                                       | Nome ainda vem dos metadados; integrar perfil quando ele passar a ser a origem de exibição |

A função `initials` e as cores não formam um componente único de avatar. Será necessário padronizar nome, iniciais, cor estável e imagem em um lugar compartilhado. A mudança de nome deve atualizar sua apresentação atual sem reescrever o histórico de autoria. O tratamento de membros removidos e autores históricos precisa de fallback, respeitando a visibilidade autorizada.

### Risco de reutilizar a autorização administrativa

`private.role_in` concede papel efetivo admin a administradores gerais em qualquer empresa, independentemente de membership. Esse helper atende aos chamados, mas **não representa o vínculo real compartilhado exigido para a foto**. A política de perfil/foto precisará verificar `memberships` reais de ambas as pessoas, sem incluir preferências privadas nessa leitura. A consulta não pode expor nomes de empresas ou suas listas como efeito da checagem.

A página Equipe hoje é restrita a administradores. Isso não impede que colegas autorizados vejam uma foto em uma conversa à qual já têm acesso; a nova visibilidade não concede acesso à página Equipe nem ao chamado. Preferências da conta permanecem visíveis/editáveis apenas ao titular, mesmo se a foto/nome tiverem leitura compartilhada.

## 5. Foto e Supabase Storage

O repositório não declara bucket, limite de arquivo, MIME permitido, RLS em `storage.objects`, armazenamento de caminho ou rotina de limpeza. Não há preview/recorte nem upload no cliente/servidor. É infraestrutura nova, distinta dos anexos de chamados que continuam no backlog.

Dependências a resolver no desenho:

- Bucket privado reproduzível por migração/configuração; caminho ligado ao UUID do titular e versão única do arquivo. Banco guarda caminho e versão, não URL assinada.
- INSERT/UPDATE/DELETE restritos ao próprio usuário; leitura/assinatura de imagem apenas após permissão de colega/titular, sem listar o bucket para todos. Testar também acesso direto ao Storage/Data API, não só pela interface. [RLS do Storage](https://supabase.com/docs/guides/storage/security/access-control).
- JPEG, PNG e WebP com validação de conteúdo real, limite de bytes e de pixels, rejeição de imagens inválidas e processamento de orientação/recorte/metadados. MIME/extensão do navegador são insuficientes.
- Confirmar tamanho/resolução finais. Recorte no navegador é conveniência; reprocessamento no servidor deve gerar arquivo final normalizado e remover metadados, incluindo EXIF/GPS. Sharp transitivo não significa que isso já acontece; uma biblioteca usada diretamente pelo produto deve ter dependência e versões explicitamente controladas.
- RLS que permite upload direto no próprio caminho, sozinha, não comprova normalização. O desenho deve impedir servir/publicar como avatar um original enviado diretamente ao Storage sem passar pelo processamento. Avaliar fluxo de estágio/finalização sem tornar originais acessíveis a colegas.
- Upload e alterações de nome/perfil precisam de compensação: Storage e PostgreSQL não compartilham transação atômica. Não substituir o caminho vigente antes do sucesso e não deixar originais/arquivos órfãos sem limpeza.

### Conflitos com o servidor atual

`src/proxy.ts` recusa mídia diferente de JSON com 415 e Content-Length acima de 32 KiB com 413 nas APIs. `readJson` também impõe o limite durante leitura. Um POST multipart de foto em `/api` falhará. A futura exceção precisa ser limitada ao endpoint de foto, preservando sessão, CSRF, quota, limite de streaming e o comportamento das demais APIs; alternativamente, o desenho pode usar estágio no Storage sob sessão do titular. Não liberar uploads genericamente.

A CSP atual usa `img-src 'self' data: blob:`. URLs assinadas do host Supabase são externas e seriam bloqueadas. O desenho deverá optar por origem de imagem explicitamente autorizada ou serviço autenticado de imagem no mesmo domínio. Não inserir curinga indiscriminado nem tratar uma URL como prova de autorização.

Next.js alerta que o otimizador padrão de imagens não encaminha headers de autenticação; o uso de imagens privadas deve evitar cache público e ser definido explicitamente. Referência local: documentação `Image`, aviso sobre `unoptimized`. A configuração atual não tem `remotePatterns` para Storage.

### Expiração, troca e exclusão

URLs assinadas são credenciais temporárias compartilháveis. A checagem acontece antes de gerar a URL; remover um vínculo não invalida automaticamente uma URL já emitida. TTL curto reduz a janela, mas não produz revogação instantânea. O Supabase documenta que invalidar uma URL específica exige excluir, mover ou renomear o objeto subjacente. O TTL final é uma decisão da Fase 2. [URLs e revogação](https://supabase.com/docs/guides/storage/serving/downloads).

Remover ou trocar foto exige remover o objeto anterior e limpar caches aplicáveis, sem reutilizar uma URL permanente. Excluir apenas a linha de perfil, ou apenas metadados SQL de Storage, não garante remoção do arquivo. A documentação exige a Storage API para apagar objetos. [Remoção de objetos](https://supabase.com/docs/guides/storage/management/delete-objects).

O processo atual de privacidade recebe um pedido e permite responder após atendimento administrativo; ele não executa hard-delete automático da conta. A futura entrega deve integrar remoção de objetos, perfil e preferências ao procedimento efetivo de exclusão, com ordem, falhas/reprocessamento e evidência. Não criar botão paralelo que ignore vínculos, último administrador ou retenções.

## 6. Tema, cores, escala e movimento

| Responsabilidade        | Arquivo/local                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ThemeProvider e seletor | `src/components/ui-providers.tsx`: classe em html, defaultTheme sistema, nonce CSP, useTheme/setTheme; seletor protegido contra divergência de hidratação           |
| Rodapé                  | `src/components/cookie-consent.tsx`: `LegalFooter`, links legais e `ThemeSelect`; apesar do nome do arquivo, não é banner de consentimento                          |
| Montagem global         | `src/app/layout.tsx`: lê nonce, monta providers e rodapé; HTML pt-BR fixo e suppressHydrationWarning                                                                |
| Tokens claros           | `src/app/globals.css`, `:root`: accent #002FA7, ink #202126, muted #61636E, canvas #F7F7F8, surface branco e controles/divisórias                                   |
| Tokens escuros          | Mesmo CSS, `.dark`: accent #9AB7FF, ink #EEF0F6, canvas #131721, surface #1B202C e variantes                                                                        |
| Tipografia              | CSS global, Helvetica Neue/Helvetica/Arial, body 15 px, entrelinha 1.6; fontes de controles 16 px e muitos tamanhos por componente em px                            |
| Tailwind                | `@import "tailwindcss"` no CSS, plugin `@tailwindcss/postcss` em `postcss.config.mjs`; sem arquivo tailwind.config ou bloco @theme específico do produto encontrado |
| Movimento               | MotionConfig reducedMotion=user; Entrance/DeskDialog usam useReducedMotion; CSS com prefers-reduced-motion, inclusive skeletons                                     |

O next-themes instalado usa chave padrão **`theme` no localStorage**, confirmada na implementação do pacote, pois a aplicação não passa storageKey. O script inicial usa nonce e aplica o tema antes da hidratação. Não há cookie de tema ou registro por usuário. Trocar de conta no mesmo navegador mantém a escolha local; ela nunca concede permissões.

Não há densidade configurável, modo explícito de alto contraste, controle manual de movimento ou tokens de escala de texto. Como existem muitos tamanhos em px, alterar apenas `html.font-size` não ampliará a interface inteira. A Fase 2 deverá definir escala coerente com o CSS existente e verificar 110%/125%, quebra de textos em inglês, foco e alvos de toque em 390/1440 px. Não há medição nova de contraste nesta fase, portanto não se afirma conformidade 4,5:1 ou WCAG integral.

## 7. Idioma e formatos

Não há infraestrutura de internacionalização no código atual. O `<html lang="pt-BR">` é fixo; rótulos de estados/papéis, formulários, paleta, toasts, erros e textos acessíveis estão distribuídos como strings literais. Alguns schemas devolvem mensagens padrão Zod em inglês, o que é uma inconsistência atual e não um locale configurado.

O inglês foi aprovado e é viável, mas exige uma camada de locale/dicionários e revisão de cobertura, não apenas um seletor. O guia da versão instalada apresenta dicionários e roteamento por idioma; a Fase 2 deve avaliar a estratégia por conta/cookie ou segmento de rota, preservando links de convite, callback, origem CSRF e URLs existentes. Não traduzir automaticamente slugs, enums persistidos, IDs, conteúdo de chamados ou nomes próprios.

Será necessário tratar:

- Preferência da conta como fonte persistente, fallback pt-BR e conveniência local para tela anterior ao login; mesma escolha em renderização de servidor e cliente.
- Dicionários tipados, pluralização, aria-labels, mensagens de erro e fallback para chaves ausentes. Escolher biblioteca ou utilitário próprio no desenho; nenhuma dependência foi adicionada.
- Formatação central com locale de interface e padrões de data/hora/número explícitos. O pedido define padrão brasileiro e 24 horas; a convivência disso com interface em inglês será registrada na Fase 2, sem assumir que idioma muda todos os formatos.
- Fuso detectado no navegador e ajuste manual com identificador IANA validado. O servidor não detecta esse fuso pela sessão atual; evitar formato diferente entre SSR e hidratação.
- Tradução de páginas legais é revisão de conteúdo versionado, não substituição silenciosa dos termos aceitos. Distinguir idioma da interface e versão jurídica; não modificar hashes/snapshots nesta fase.
- Atualizar testes que hoje buscam rótulos em português; manter cobertura em ambos os idiomas sem fazer o locale alterar autorização.

Atualmente `workspace.tsx` formata datas como dia e mês abreviado em pt-BR; `privacy-center.tsx` usa toLocaleString; `privacy-admin.tsx` usa toLocaleDateString. Não há timeZone explícito nem preferência de hora. Não há moeda/preço no produto atual; não criar valores ou um módulo financeiro para preencher essa configuração.

## 8. Cookies, marketing e preferências de uso

| Preferência              | Armazenamento e leitura atuais                                                                                                                          | Integração necessária                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tema                     | localStorage `theme`, lido por next-themes                                                                                                              | Preservar escolha e definir precedência/migração ao perfil da conta                                                                                                                                   |
| Cookies opcionais        | POST `/api/consentimento/cookies` grava `desk_cookie_choice` como `versão:allow` ou `versão:reject`, 180 dias, HttpOnly/SameSite=Lax/Secure em produção | Não há leitor funcional da escolha nem seletor de cookies atual encontrado. Há seção informativa `/privacidade#cookies`; reutilizar endpoint e adicionar leitura/controle somente no desenho aprovado |
| Marketing                | `public.privacy_preferences`: user_id, marketing, unsubscribe_hash, updated_at; RLS de leitura do próprio usuário e escrita por `privacy_command`       | `/api/privacidade` lê; `PrivacyCenter` permite autorizar/revogar. Link por token usa `/api/privacidade/descadastro`; nova página deve reaproveitar esses comandos                                     |
| Fila Lista/Kanban        | `useState(false)` em Workspace                                                                                                                          | Seleção volta para Lista quando o componente é remontado; não há persistência por conta                                                                                                               |
| Busca/filtros/página     | URL e estado local, consultas paginadas                                                                                                                 | Preservar links explícitos; definir precedência frente a defaults pessoais                                                                                                                            |
| Home/última visualização | Sem preferência persistente                                                                                                                             | Exige validação de destino interno e cuidado na troca de empresa/conta; manter helper safeRedirect                                                                                                    |
| Notificações             | Toasts de ações locais; sem configuração de eventos por pessoa                                                                                          | Preferência salva não pode anunciar recebimento de avisos se não houver consumidor implementado                                                                                                       |

O teste existente em `journey.spec.ts` verifica que o fluxo atual não cria `desk_cookie_choice` desnecessariamente. `docs/privacy-operations.md` e trechos do README ainda mencionam banner/escolha de cookies anterior; registrar e consolidar essa divergência sem reinstalar trackers ou popup artificial.

A integração de e-mail está somente desenhada em `docs/integracao.md`. Supabase Auth/SMTP, sozinho, não implementa notificações de chamados. Preferências de eventos devem ter estado de disponibilidade coerente e contrato compatível com a futura integração, sem prometer um envio que ainda não ocorre. Consentimento de marketing permanece separado das preferências operacionais.

## 9. Conta, identidade e direitos

- **Nome:** há campo de cadastro, mas não edição pós-cadastro. Definir origem única do nome exibido, migração dos metadados existentes e concorrência/versionamento do perfil. Metadados/nome jamais são fonte de papel ou autorização.
- **E-mail:** não há ação/schema para alteração. `updateUser` existente só altera senha. A configuração local tem `double_confirm_changes=true`, mas isso não comprova configuração hospedada nem reautenticação recente. O novo fluxo depende de confirmação no endereço novo e verificação real de reautenticação no servidor, não flag enviada pelo cliente.
- **Senha:** reaproveitar `/redefinir-senha`, ação `update_password`, recuperação e callback existentes; não criar armazenamento de senhas próprio.
- **Exclusão:** usar `/meus-dados` e o pedido de direitos atual. Planejar cleanup de foto/perfil/preferências no atendimento efetivo; a resposta administrativa não é execução da exclusão.
- **Preferências pessoais:** serão dados privados do titular. Separar modelo de perfil compartilhável de tema, idioma, fuso, notificações e outras escolhas privadas; não colocá-las em uma projeção legível por colegas.

A própria pessoa deve continuar podendo remover sua foto e exercer seus direitos quando deixar de participar de todos os workspaces. Como a página principal de configurações foi solicitada dentro de `/e/{slug}`, o desenho precisa prever acesso autenticado à própria conta/remoção fora da dependência de uma empresa ativa, aproveitando a central de dados ou uma entrada de conta apropriada.

## 10. Riscos prioritários e dependências

| Prioridade  | Risco/dependência                                                                      | Consequência para a próxima fase                                                                                    |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Alta        | Não existem perfis ou Storage no modelo do projeto                                     | Migração, tipos, bucket privado e políticas entram no escopo, não apenas UI                                         |
| Alta        | Administrador geral tem acesso efetivo a todas as empresas                             | Política de foto precisa de membership compartilhada real, sem herdar essa exceção                                  |
| Alta        | Upload é bloqueado globalmente e pode contornar sanitização se feito direto no Storage | Desenhar limite específico e finalização verificada, mantendo a sessão/RLS e bloqueio de originais não normalizados |
| Alta        | Foto, perfil e exclusão usam serviços distintos                                        | Compensação, cleanup e testes de falhas; cascata SQL não elimina o arquivo                                          |
| Alta        | URL assinada continua válida por sua janela                                            | TTL curto, armazenamento privado e política explícita de revogação/cache                                            |
| Média       | CSP/img e otimização atual não preveem imagem privada externa                          | Definir entrega e cache antes de inserir avatares em telas                                                          |
| Média       | Nome de terceiros é genérico no fluxo real                                             | Integrar perfis a membros/autores/responsáveis e fallback de histórico, sem carregar Auth admin                     |
| Média       | Idiomas exigem revisar muitas strings/erros/formatos                                   | Planejar extração/tradução e SSR; não limitar inglês à página de configurações                                      |
| Média       | Texto usa tamanhos em px e paleta manual                                               | Escala de texto e contraste exigem revisão visual real nos dois temas e idiomas                                     |
| Média       | Tema local e cookies têm escopos diferentes da conta                                   | Definir prioridades na troca de conta/dispositivo e migração sem perder escolha atual                               |
| Média       | Documentos legais são versionados                                                      | Revisar finalidade de foto, visibilidade, retenção e remoção antes de coletar; não sobrescrever versões já aceitas  |
| Operacional | Ambiente hospedado/bucket não inspecionado                                             | Confirmar recursos e políticas em homologação separada antes do preview/piloto                                      |

## 11. Arquivos e conclusão da fase

Alterações desta frente: este relatório (`docs/levantamento-configuracoes.md`) e registro factual em `docs/progress.md`; branch local criada. Nenhum código, dependência, migração, política, documento legal versionado, banco ou produção foi alterado. Não houve upload de arquivo pessoal, deploy, commit ou push.

O próximo passo é **Fase 2: documentar a proposta em `docs/configuracoes.md`**, incluindo pt-BR/inglês e visibilidade entre colegas já confirmados, limites da imagem, escopo das preferências, APIs/RLS, pipeline de imagem, exclusão, escala, formatos, testes e rollback. Esse desenho deverá ser apresentado para aprovação antes da Fase 3. A Fase 1 termina com este relatório.
