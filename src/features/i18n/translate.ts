import english from './en.json';

export type Locale = 'pt-BR' | 'en';
const messages: Record<string, string> = english;

export function translator(locale: Locale) {
  return (message: string, values: Record<string, string | number> = {}) => {
    const key = message.trim();
    if (!key) return message;
    const translated = locale === 'en' ? (messages[key] ?? key) : key;
    const text = translated.replace(/\{(\w+)\}/g, (match, name: string) =>
      String(values[name] ?? match),
    );
    return (message.match(/^\s+/)?.[0] ?? '') + text + (message.match(/\s+$/)?.[0] ?? '');
  };
}
