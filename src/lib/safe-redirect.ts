export function safeRedirect(value: string | null, fallback = '/onboarding') {
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  let path = value.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 8; depth++) {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path)) return fallback;
    if (!path.includes('%')) return value;
    try {
      path = decodeURIComponent(path);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
