import { afterEach, expect, it, vi } from 'vitest';
import { boundedSupabaseFetch, SUPABASE_TIMEOUT_MS } from '../../src/lib/supabase/fetch';

afterEach(() => vi.unstubAllGlobals());

it('limita a espera sem perder o cancelamento do chamador', async () => {
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const createTimeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(timeout);
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());
  vi.stubGlobal('fetch', fetchMock);

  try {
    await boundedSupabaseFetch('https://supabase.example', { signal: controller.signal });
    expect(createTimeout).toHaveBeenCalledWith(8000);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  } finally {
    createTimeout.mockRestore();
  }
});
