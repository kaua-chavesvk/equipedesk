import { expect, it, vi } from 'vitest';
import { observeApi } from '../../src/lib/http/observe-api';

it('correlaciona o HTTP 503 sem registrar URL, query, cabeçalhos ou conteúdo da resposta', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const id = '00000000-0000-4000-8000-000000000001';
    const handler = observeApi('/api/privacidade/descadastro', async () =>
      Response.json({ error: 'conteúdo privado' }, { status: 503 }),
    );
    const response = await handler(new Request('https://desk.example/?token=teste-sigiloso', {
      method: 'POST',
      headers: { 'x-request-id': id, authorization: 'Bearer teste-sigiloso' },
    }));
    expect(response.headers.get('x-request-id')).toBe(id);
    expect(JSON.parse(error.mock.calls[0][0])).toEqual({
      type: 'api_request',
      route: '/api/privacidade/descadastro',
      method: 'POST',
      status: 503,
      requestId: id,
      durationMs: expect.any(Number),
      time: expect.any(String),
    });
  } finally {
    error.mockRestore();
  }
});
