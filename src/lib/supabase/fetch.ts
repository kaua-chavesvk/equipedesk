export const SUPABASE_TIMEOUT_MS = 8000;

export function boundedSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return fetch(input, { ...init, signal: caller ? AbortSignal.any([caller, timeout]) : timeout });
}
