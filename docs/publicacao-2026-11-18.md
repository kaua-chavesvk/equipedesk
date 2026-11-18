# Publicação em produção — 18/11/2026

Código publicado: `1280206f8981e4fd74ccd4be2a43bf250104299a`, branch `codex/security-phase2`.

- URL oficial: https://miakaelsondesk.vercel.app.
- Deployment: `dpl_Auikp68YQMHDPKMCrF3jSLFogHfj`, READY, produção.
- Build remoto com validação de ambiente, compilação e TypeScript aprovados.
- Migrações `202611170001` e `202611170002` aplicadas ao projeto de produção; dez versões locais/remotas sincronizadas.
- HTTP público: `/login`, `/favicon.ico`, `/privacidade` retornaram 200. API de filtros sem sessão retornou 401. CSP Report-Only presente em HTML/API verificados.
- `ENFORCE_PLATFORM_ADMIN_AAL2=false` persistido em Production: o código TOTP foi publicado, mas o cadastro confirmado de homologação não equivale ao cadastro das contas de produção. Preview continua exigindo AAL2.

A revisão contém 178 testes unitários aprovados; o timeout de arraste desktop e o alerta de picomatch permanecem documentados em `validacao-atual.md`. Publicação não equivale a correção dessas pendências. Não houve nova jornada autenticada completa em produção nesta operação.

A primeira tentativa criou um projeto temporário por ausência do vínculo local na pasta isolada. O build desse projeto falhou sem configuração de produção; o endereço oficial não foi afetado. O vínculo foi corrigido antes do deployment oficial. A limpeza do projeto temporário ficou pendente porque a Vercel exige confirmação humana explícita para exclusão irreversível; nenhuma confirmação foi contornada.

README e vídeo estão na branch publicada; deploy não realiza merge da PR nem altera a branch padrão do GitHub.
