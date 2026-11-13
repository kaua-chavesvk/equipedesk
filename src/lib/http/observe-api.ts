import { randomUUID } from 'node:crypto';

type ApiHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Promise<Response>;

export function observeApi<Args extends unknown[]>(route: string, handler: ApiHandler<Args>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const incomingId = request.headers.get('x-request-id');
    const requestId = incomingId && /^[0-9a-f-]{36}$/i.test(incomingId) ? incomingId : randomUUID();
    const start = performance.now();
    let status = 500;

    try {
      const response = await handler(request, ...args);
      status = response.status;
      response.headers.set('X-Request-Id', requestId);
      return response;
    } finally {
      const log = JSON.stringify({
        type: 'api_request',
        route,
        method: request.method,
        status,
        requestId,
        durationMs: Math.round(performance.now() - start),
        time: new Date().toISOString(),
      });
      if (status >= 500) console.error(log);
      else if (status >= 400) console.warn(log);
      else console.info(log);
    }
  };
}
