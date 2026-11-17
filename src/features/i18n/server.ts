import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { accountPreferences } from '@/lib/server/account-settings';
import { translator } from './translate';

export const requestLocale = cache(async () => {
  const preferences = await accountPreferences().catch(() => null);
  if (preferences) return preferences.locale;
  return (await cookies()).get('desk_locale')?.value === 'en' ? 'en' : 'pt-BR';
});

export async function serverTranslations() {
  return translator(await requestLocale());
}
