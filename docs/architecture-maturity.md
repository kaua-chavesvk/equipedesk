# Observabilidade, cache e processamento assíncrono

## Sentry no App Router

O logger de API registra método, rota estática, status, duração e ID da requisição. Use esse ID para correlacionar um HTTP 503 com o evento de segurança do proxy ou do handler. Separe métricas por rota e ambiente e acompanhe taxa de 5xx, p95 de duração e falhas do Redis. Capture exceções inesperadas no Sentry. Para respostas 5xx já tratadas, alerte pelos logs, pois elas não chegam ao hook de erro do Next.js.

Exemplo de integração após instalar `@sentry/nextjs` e criar o projeto no Sentry. Comece com erros de servidor e mantenha o envio de erros de navegador como uma segunda etapa, sujeita à revisão de CSP e dos dados enviados.

```ts
// src/instrumentation.ts
import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

export const onRequestError: Instrumentation.onRequestError = async (_, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return;
  const { captureMessage, flush } = await import('@sentry/nextjs');
  const id = request.headers['x-request-id'];
  const requestId = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
  captureMessage('Falha inesperada no App Router', {
    level: 'error',
    tags: { route: context.routePath, routeType: context.routeType, requestId },
  });
  await flush(1500);
};
```

```ts
// src/sentry.server.config.ts
import { init } from '@sentry/nextjs';

init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    return {
      event_id: event.event_id,
      timestamp: event.timestamp,
      environment: event.environment,
      platform: 'node',
      level: 'error',
      message: 'Falha inesperada no App Router',
      tags: { route: event.tags?.route, routeType: event.tags?.routeType, requestId: event.tags?.requestId },
    };
  },
});
```

O exemplo usa captura manual e envia somente categorias fixas e o padrão de rota, sem stack, URL, cookies ou payload. Valide o evento com uma exceção controlada em staging. Se precisar de stack traces e source maps, revise a sanitização antes de ativar o plugin Webpack. Guarde `SENTRY_AUTH_TOKEN` somente no ambiente de build, caso habilite o upload. A documentação oficial explica a inicialização e a configuração do Webpack. https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/webpack-setup/

## Cache da fila

`queryTickets` recebe o workspace autorizado nesta requisição. A sessão é lida fora do cache. Em caso de miss, um cliente sem cookies consulta o Supabase sob o JWT do usuário, com RLS. O JWT não entra na chave de cache. A entrada usa empresa, usuário, papel, filtros e paginação. Buscas de texto livre, páginas profundas, contagens e detalhes continuam consultando o Supabase. A criação e a transição de chamados via API expiram a tag da empresa após o commit.

O código vem desligado por padrão. Em staging, ligue `TICKET_CACHE_ENABLED=true`, aqueça a lista, altere o papel de um usuário e verifique acesso e acertos de cache. O intervalo de 20 segundos inicia a revalidação automática e pode servir a resposta antiga durante a atualização. Escritas feitas diretamente no Supabase e rotinas de retenção precisam emitir invalidação própria para garantir atualização imediata. Se remoções de dados exigirem expurgo imediato, valide também a remoção física no armazenamento do cache antes de habilitar o recurso para tickets com conteúdo sensível.

O Upstash existente atende ao limitador. Redis para cache só agrega valor se houver necessidade medida de compartilhar dados com workers, outros serviços ou múltiplas instalações da aplicação, ou de controlar TTL e coordenação fora do Next.js. Use namespace e orçamento separados do limitador. https://nextjs.org/docs/app/api-reference/functions/unstable_cache

## Teste administrativo

Execute com Supabase local e o seed descrito no README. Prepare a conta com `scripts/seed-admin-e2e.mjs` usando uma senha de teste, URL local e a chave administrativa apenas no processo de seed. Depois execute:

```sh
pnpm exec playwright test --config playwright.supabase.config.ts
```

O teste entra com uma sessão real de administradora de empresa e verifica que a fila global não aparece e que o banco recusa a tentativa de responder a um pedido. A leitura posterior verifica que o pedido ficou aberto. O teste tem configuração própria para evitar que o servidor da demonstração substitua o Supabase.

## Fila de privacidade

O pedido de exclusão já retorna rapidamente com um protocolo. A revogação de marketing é uma atualização atômica e deve ser efetiva antes de confirmar o descadastro. Enfileire tarefas posteriores, como preparar a triagem de exclusão ou sincronizar uma preferência já revogada com um futuro provedor de campanhas.

O exemplo abaixo agenda a **triagem**, sem excluir contas. Coloque-o em uma migração de staging. O trigger grava o trabalho na mesma transação que registra o pedido, mantendo a API atual. A função SQL do worker usa `SKIP LOCKED` para impedir que duas execuções processem o mesmo trabalho. O efeito local e a retirada da fila são atômicos. Uma exceção desfaz o lote inteiro e a execução seguinte pode tentar novamente.

```sql
create table private.privacy_review_jobs (
  request_id uuid primary key references public.privacy_requests(id) on delete cascade,
  queued_at timestamptz not null default now()
);

create table private.privacy_review_inbox (
  request_id uuid primary key references public.privacy_requests(id) on delete cascade,
  ready_at timestamptz not null default now()
);

create function private.queue_privacy_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.privacy_review_jobs(request_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function private.queue_privacy_review() from public, anon, authenticated;

create trigger queue_deletion_review
after insert on public.privacy_requests
for each row when (new.kind = 'delete')
execute function private.queue_privacy_review();

create function public.drain_privacy_review_jobs() returns integer
language sql security definer set search_path = '' as $$
  with picked as (
    select request_id from private.privacy_review_jobs
    order by queued_at, request_id limit 25 for update skip locked
  ), ready as (
    insert into private.privacy_review_inbox(request_id)
    select p.request_id from picked p
    join public.privacy_requests r on r.id = p.request_id
    where r.status = 'submitted'
    on conflict do nothing
    returning request_id
  ), done as (
    delete from private.privacy_review_jobs j
    using picked p where j.request_id = p.request_id returning j.request_id
  )
  select count(*)::integer from done;
$$;
revoke execute on function public.drain_privacy_review_jobs() from public, anon, authenticated;
grant execute on function public.drain_privacy_review_jobs() to service_role;
```

Agende pelo Supabase Cron como uma função SQL. Para triagem inteiramente no banco, essa é a opção mais direta. Se o trabalho incluir serviços externos, use uma Edge Function agendada e uma fila durável com lease, tentativas limitadas, fila de falhas e chave de idempotência por operação. Confirme o consumo somente após o efeito estar persistido. Chaves administrativas ficam com o worker e não entram no navegador ou no processo web. Monitore a idade do trabalho mais antigo e falhas recorrentes. A exclusão efetiva depende de aprovação, revisão de retenções e um plano explícito para as relações com empresas e chamados.

https://supabase.com/docs/guides/cron
https://supabase.com/docs/guides/queues/pgmq

A chamada agendada também pode passar por uma Edge Function, usando autenticação servidor a servidor. Para a opção abaixo, configure a função com `verify_jwt = false` e use a validação `auth: 'secret'` do wrapper. O Cron envia a chave secreta pelo cabeçalho `apikey`, recuperada do Vault. Use um agendamento por ambiente.

```ts
// supabase/functions/privacy-review-worker/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
  fetch: withSupabase({ auth: 'secret' }, async (request, context) => {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    }
    const { data, error } = await context.supabaseAdmin.rpc('drain_privacy_review_jobs');
    if (error) {
      console.error(JSON.stringify({ event: 'privacy_review_batch_failed' }));
      return Response.json({ error: 'Não foi possível processar o lote.' }, { status: 503 });
    }
    return Response.json({ processed: data });
  }),
};
```

O consumidor acima roda fora da requisição original do usuário. A caixa de triagem é uma tabela privada para um consumidor autorizado, separada da tela administrativa atual. Teste em staging com um pedido sintético, duas execuções concorrentes e uma falha de transação antes de agendar. A documentação oficial detalha [a autenticação da Edge Function](https://supabase.com/docs/guides/functions/auth) e [o uso de Cron e Vault](https://supabase.com/docs/guides/functions/schedule-functions).
