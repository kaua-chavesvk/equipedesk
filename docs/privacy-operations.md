# Privacidade e operação — 12/11/2026

## Identificação pública autorizada

- Nome informado: **mikaelson desk**.
- Canal de privacidade: **mikaelson.desk@gmail.com**.
- Endereço informado: **Professor Edgard de Arruda, 1825, Dom Lustosa**.
- CNPJ, cidade, UF, CEP e nome de encarregado formal: não informados. Não foram inventados. Completar os dados obrigatórios de identificação antes de iniciar vendas.

Os valores públicos podem ser substituídos por `LEGAL_ENTITY_NAME`, `PRIVACY_CONTACT_EMAIL`, `LEGAL_ENTITY_CNPJ` e `LEGAL_ENTITY_ADDRESS`. O endereço de administrador não foi reaproveitado como contato público. A configuração divulgada é um canal de atendimento, não uma declaração de nomeação de encarregado.

## Funcionalidades entregues

- `/privacidade`, `/termos` e `/licencas`, com links no rodapé global.
- Cadastro exige aceite afirmativo dos termos, ciência da política e declaração de 18 anos ou mais. Marketing tem opção separada, inicialmente desmarcada. Não são coletados CPF, data de nascimento, documentos ou pagamentos. Nome de exibição é opcional.
- O trigger de criação de usuário registra os dados de aceite na mesma transação do cadastro, quando as declarações e versões são válidas. `privacy_command` permite aceite autenticado de contas existentes. Usuário, versão, hashes dos documentos, fonte e data do banco ficam em `legal_acceptances`, sem IP ou user-agent. Metadados modificados posteriormente no usuário não criam ou alteram a evidência.
- A aplicação exige novo aceite para acessar workspaces e suas APIs quando não existe registro da versão atual. As páginas de direitos e os comandos de revogação continuam independentes desse aceite. A API gerenciada do Supabase não é substituída por esse bloqueio de interface; não configure clientes paralelos para operar o produto sem os controles contratuais de acesso.
- Banner com permissão ou recusa dos opcionais, em condições equivalentes. Guarda somente a escolha e a versão em cookie necessário por 180 dias. Não há trackers, analytics ou publicidade instalados. Consentimento desta versão não libera automaticamente fornecedores futuros.
- `/meus-dados` registra pedidos de acesso, correção, exclusão e outros direitos com protocolo; mostra histórico e permite baixar resumo da conta. O resumo não representa uma exportação de todos os chamados da empresa. `/admin/privacidade` oferece fila e resposta fundamentada, restrita ao administrador geral.
- Descadastro de marketing autenticado e por token opaco, armazenado somente como hash. Link público exige confirmação antes de revogar, evitando que scanners de e-mail mudem a preferência só por acessar a página. Não há campanhas ativas ou serviço de disparo conectado.
- Seis templates de e-mail do Supabase incluem rodapé com privacidade, contato e descadastro de comunicações promocionais. Autenticação e segurança não são condicionadas a marketing. Os templates locais precisam ser copiados/configurados no projeto Supabase hospedado.

## Antes de produção

1. Aplicar `202611120003_privacy.sql` e `202611120004_retention.sql` após as migrações anteriores. Executar os testes SQL e jornadas de cadastro real, recuperação, aceite de conta antiga, opt-in, revogação e pedido de exclusão.
2. Guardar os snapshots de `docs/legal/2026-11-12`. `scripts/check-legal.mjs` verifica a correspondência dos documentos aos hashes usados pelo cadastro. Alteração material exige nova versão, novos snapshots, migração dos hashes e novo aceite; não sobrescrever silenciosamente versões aceitas.
3. Contratar/verificar os operadores e suboperadores conforme a matriz e o modelo de DPA abaixo. Registrar regiões, transferências internacionais, controles, prazos e procedimentos de devolução/eliminação.
4. Configurar no Supabase hospedado os seis templates de `supabase/templates`, Site URL, redirects e expiração de OTP. A configuração TOML só configura o ambiente local; não prova atualização do serviço remoto.
5. Definir retenção efetiva dos logs e backups no provedor. Metas operacionais: 30 dias para logs de segurança do app e 90 dias para backups, com redução quando possível. Não há afirmação pública de que esses prazos já estão configurados. Considerar separadamente eventual obrigação de guarda de registros de acesso a aplicações, inclusive o artigo 15 do Marco Civil da Internet, conforme enquadramento e operação real.
6. Agendar a rotina de retenção diariamente em processo administrativo separado do servidor web. Testar restauração e fazer a primeira execução em staging. Não configurar `service_role` no processo web.
7. Designar quem recebe e atende o canal de privacidade e quem responde incidentes; a existência de uma caixa postal não comprova atendimento nem nomeação formal de encarregado.

## Retenção e exclusão

Os prazos estão descritos na política. A rotina `public.run_privacy_retention` elimina chamados resolvidos há mais de 12 meses, com comentários e eventos, e registros legais/pedidos cujo prazo de retenção já venceu. Preserva chamados reabertos e retenções justificadas em `private.retention_holds`. Só `service_role` pode executá-la; usuários não podem apagar evidências.

O script `scripts/run-retention.mjs` exige confirmação explícita de descarte, limita o lote a 100 itens por categoria e mostra somente contagens. A rotina usa bloqueio de empresa antes do chamado, na mesma ordem dos comandos do produto, e registra contagens por 90 dias. Definir e revisar retenções legais antes da execução. O agendamento não foi criado e nenhum dado real foi descartado nesta entrega.

A conta é mantida enquanto houver vínculo ativo. Após encerramento, a meta de eliminação ou anonimização dos dados de conta é de até 30 dias, salvo impedimento documentado e informado ao titular. Evidências de aceite e pedidos podem permanecer de forma minimizada por até cinco anos após o encerramento/conclusão, conforme necessidade comprovada de exercício de direitos. Esses cinco anos são uma política operacional sujeita à avaliação do caso, não um prazo legal obrigatório para todo tipo de dado.

Pedidos de exclusão não causam hard-delete imediato. O responsável deve verificar identidade, vínculos de administrador, conteúdo compartilhado, dados sob controle da empresa, retenções e efeitos sobre terceiros; executar a exclusão/anonimização pelo processo administrativo; registrar o que foi eliminado, o que permaneceu, a base e o prazo; responder ao titular. Marcar um pedido como respondido não executa essa operação.

## Atendimento a titulares

1. Receber via painel ou canal público; confirmar protocolo. Não pedir documento de identidade por padrão.
2. Verificar a identidade proporcionalmente ao risco. Conta autenticada normalmente basta para consultar o próprio resumo; pedidos de alto impacto podem precisar de verificação adicional pelo canal existente, sem cópia desnecessária de documentos.
3. Identificar o controlador dos dados: o fornecedor para conta/segurança; a empresa contratante para dados dos chamados.
4. Fornecer acesso simplificado imediatamente quando viável ou declaração completa no prazo legal de 15 dias. O `due_at` da fila é uma meta de triagem de 15 dias para todos os pedidos; não substitui a análise dos prazos específicos de cada direito.
5. Atender correção, revogação, oposição e exclusão conforme o caso, informando fundamentos quando não puder atender integralmente. Responder no painel e pelo canal previamente verificado, sem expor dados de outros titulares.

## Incidente com dados pessoais

O controlador precisa comunicar à ANPD e aos titulares quando houver risco ou dano relevante, observadas a Resolução CD/ANPD nº 15/2024 e normas específicas. O prazo operacional adotado é **três dias úteis a partir da ciência de que dados pessoais foram afetados**, sem esperar a investigação inteira terminar. Não presumir prorrogações por porte ou exceções sem análise jurídica.

- Registrar a ciência com data/hora, sistemas, categorias de dados, titulares e controlador envolvidos; preservar evidências com acesso restrito.
- Conter o incidente, revogar acessos/chaves comprometidos, avaliar risco e envolver o controlador imediatamente. Operadores devem avisar o controlador sem demora injustificada, com prazo contratual definido.
- Preparar comunicação à ANPD pelo canal oficial e informação clara aos titulares: natureza dos dados, riscos, medidas, orientações e contato. Se faltarem informações, avaliar a comunicação preliminar e a complementação prevista no regulamento.
- Manter registro dos incidentes com dados pessoais por pelo menos cinco anos. Evitar guardar dados pessoais brutos sem necessidade dentro do relatório do incidente.
- Nomear responsável e substituto para o envio e controlar dias úteis/feriados aplicáveis. O app não identifica automaticamente um incidente notificável e não envia comunicação à ANPD.

Fontes oficiais: [procedimento de comunicação à ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis), [regulamento e guarda de registros](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca), [LGPD](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html).

## Menores de idade

A versão atual é exclusiva para maiores de 18 anos e usa autodeclaração, sem coletar nascimento. Isso não é verificação documental de idade. Não há fluxo de consentimento parental e não se pode anunciar atendimento a crianças como implementado. Recebida notícia de dados de menor, interromper o tratamento desnecessário e avaliar eliminação e encaminhamento com o controlador, observando melhor interesse e regras aplicáveis. Uma futura liberação a menores exige desenho e validação próprios, inclusive verificação do responsável quando o consentimento for a base adotada.

## E-mails, ofertas e cobrança

Não há disparo de marketing, checkout, planos pagos ou assinaturas nesta versão. Portanto, não há compra, taxa ou renovação para cobrar/cancelar. Não adicionar checkout antes de implementar conjuntamente: identificação completa do fornecedor, preço total e taxas, periodicidade e data/valor de renovação, aceite específico da contratação, confirmação por meio durável, cancelamento pelo mesmo canal e fluxo de arrependimento de sete dias quando aplicável às relações de consumo.

Campanhas futuras devem verificar a preferência atual antes de cada envio e manter descadastro sem login por token opaco, incluindo cabeçalhos de descadastro exigidos pelo provedor e padrão one-click quando aplicável. Os templates operacionais fornecidos não autorizam uso promocional de mensagens de recuperação ou confirmação. Nenhum e-mail foi enviado nesta entrega.

Fonte oficial para contratação eletrônica e arrependimento: [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm) e [CDC, artigo 49](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8078-11-setembro-1990-365086-normaatualizada-pl.html).

## Fornecedores e DPA — revisão pendente

| Fornecedor/função | Situação verificada | Pendências |
|---|---|---|
| Vercel / hospedagem | Projeto remoto identificado; variáveis incompletas | DPA/termos vigentes, região, suboperadores, logs/backups, transferências internacionais e retenção |
| Supabase / Auth e banco | Usuário informou projeto existente; conexão ainda não concluída nesta revisão | Identificação do projeto, migrações, região, contrato/DPA, backups e templates |
| Redis REST / limite de requisições | Configuração em andamento | Provedor, plano, termos/DPA, região e eliminação das chaves temporárias |
| E-mail transacional | Não configurado/verificado | SMTP, DPA, rastreamento desativado, autenticação de domínio e supressão |

Modelo de aditivo, **não assinado e não substitutivo de revisão jurídica**: partes e contatos; definição de controlador/operador; objeto, finalidade e duração; categorias de dados/titulares; instruções documentadas; confidencialidade e controle de acesso; suboperadores e mecanismo de aviso; medidas técnicas; comunicação de incidentes; apoio aos direitos do titular; auditoria/evidências; região e transferências internacionais; devolução, retenção e eliminação no término; responsabilidade e encerramento. Conferir os termos efetivos de cada fornecedor e registrar o aceite por pessoa autorizada. Esta entrega não afirma que um contrato foi celebrado.

## Conteúdo, licenças e acessibilidade

Não foram encontrados checkout, cronômetros promocionais, avaliações ou logotipos de clientes no código da interface. Os dados de demonstração são fictícios. Foram removidas promessas de notificações automáticas inexistentes e reforçada a identificação de demonstração. Logos e depoimentos futuros exigem registro de autorização e origem, sem inventar resultados.

`docs/licenses.json` contém inventário de 75 dependências de produção, e `THIRD_PARTY_NOTICES.md` preserva os avisos encontrados. Fontes são do sistema, sem download; ilustrações são CSS e ícones são Lucide. Três pacotes não incluíram aviso na raiz consultada (`@next/env`, `@next/swc-win32-x64-msvc` e `client-only`); a metadata declara MIT, mas o texto aplicável e eventuais notices de código compilado precisam ser conferidos antes de redistribuir binários. O inventário não é uma auditoria completa do código de terceiros nem uma licença geral para conteúdo novo.

A interface recebeu ajustes de contraste, foco visível e redução de movimento. Formulários usam rótulos e checkboxes acessíveis; o banner não prende o foco nem exige aceitar opcionais. Não há imagens informativas sem texto alternativo nesta versão; os desenhos decorativos ficam ocultos de leitores de tela. Testes de teclado e contraste cobrem cenários selecionados, sem declaração de conformidade integral WCAG. Revisão com leitor de tela e usuários com deficiência continua necessária.
