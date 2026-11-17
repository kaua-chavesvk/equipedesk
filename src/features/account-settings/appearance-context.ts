'use client';

import { createContext } from 'react';
import type { UserPreferences } from '@/lib/supabase/database.types';

export const AccountAppearance = createContext<UserPreferences | null>(null);
