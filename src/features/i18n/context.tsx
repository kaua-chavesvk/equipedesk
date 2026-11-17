'use client';

import { createContext, useContext, useMemo } from 'react';
import { translator, type Locale } from './translate';

export const LocaleContext = createContext<Locale>('pt-BR');

export function useTranslations() {
  const locale = useContext(LocaleContext);
  return useMemo(() => translator(locale), [locale]);
}

export function useLocale() {
  return useContext(LocaleContext);
}
