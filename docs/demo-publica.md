# Demonstração pública

Projeto separado preparado na Vercel: `equipedesk-demo`. A aplicação não deve receber URL ou chaves Supabase; usa somente dados fictícios em memória.

Configurar no painel da Vercel, ambiente Production:

- `DEMO_MODE=true`
- `NEXT_PUBLIC_SITE_URL`: origem HTTPS pública da demonstração
- `RATE_LIMIT_REDIS_URL` e `RATE_LIMIT_REDIS_TOKEN`: Redis REST dedicado à demonstração
- `ENFORCE_PLATFORM_ADMIN_AAL2=false`

A Vercel não exporta os valores sensíveis do projeto existente. Não copiar placeholders `[SENSITIVE]` para outro ambiente. Não remover a exigência de Redis para contornar a configuração. Não usar banco ou contas reais na demo.

Depois de configurar o recurso, publicar a branch revisada e testar o botão Conhecer a demonstração, criação/transição com dados fictícios, bloqueio de operações reais e HTTP público sem autenticação Vercel. Somente após essa verificação incluir a URL como demo disponível no README.

As alterações em memória não têm garantia de persistência entre instâncias serverless ou novos deploys. O fluxo serve para explorar a interface, não para uso operacional.
