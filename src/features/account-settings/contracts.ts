import { z } from 'zod';

export const AVATAR_SOURCE_LIMIT = 2 * 1024 * 1024;
export const AVATAR_STORED_LIMIT = 256 * 1024;
export const AVATAR_SIDE = 256;
export const versionSchema = z.number().int().min(1).max(2_147_483_646);
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe seu nome de exibição.')
  .max(100, 'Use no máximo 100 caracteres.')
  .refine((value) => !/\p{Cc}/u.test(value), 'O nome não pode conter caracteres de controle.');
export const profileUpdateSchema = z
  .object({ displayName: displayNameSchema, version: versionSchema })
  .strict();

export function isTimeZone(value: string) {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const preferenceFields = {
  theme: z.enum(['light', 'dark', 'system'], { error: 'Tema inválido.' }),
  theme_explicit: z.boolean(),
  text_scale: z.union([z.literal(100), z.literal(110), z.literal(125)], {
    error: 'Escala de texto inválida.',
  }),
  density: z.enum(['comfortable', 'compact'], { error: 'Densidade inválida.' }),
  contrast: z.enum(['standard', 'high'], { error: 'Contraste inválido.' }),
  motion: z.enum(['system', 'reduce'], { error: 'Preferência de movimento inválida.' }),
  locale: z.enum(['pt-BR', 'en'], { error: 'Idioma inválido.' }),
  format_locale: z.literal('pt-BR', { error: 'Formato inválido.' }),
  timezone_mode: z.enum(['auto', 'manual'], { error: 'Escolha de fuso inválida.' }),
  timezone: z.string().max(64).refine(isTimeZone, 'Fuso horário inválido.').nullable(),
  home_view: z.enum(['list', 'kanban', 'last'], { error: 'Página inicial inválida.' }),
  queue_view: z.enum(['list', 'kanban'], { error: 'Visualização inválida.' }),
  notify_assigned: z.boolean(),
  notify_comment: z.boolean(),
  notify_resolved: z.boolean(),
};

export const preferencesSchema = z
  .object(preferenceFields)
  .strict()
  .superRefine((value, context) => {
    if (
      (value.timezone_mode === 'manual' && value.timezone === null) ||
      (value.timezone_mode === 'auto' && value.timezone !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['timezone'],
        message: 'Selecione um fuso manual ou mantenha a detecção automática.',
      });
    }
  });
export type AccountPreferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_ACCOUNT_PREFERENCES: Readonly<AccountPreferences> = Object.freeze({
  theme: 'system',
  theme_explicit: false,
  text_scale: 100,
  density: 'comfortable',
  contrast: 'standard',
  motion: 'system',
  locale: 'pt-BR',
  format_locale: 'pt-BR',
  timezone_mode: 'auto',
  timezone: null,
  home_view: 'list',
  queue_view: 'list',
  notify_assigned: false,
  notify_comment: false,
  notify_resolved: false,
});
export const preferencesUpdateSchema = z
  .object({
    patch: z
      .object(preferenceFields)
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, 'Informe uma preferência para alterar.'),
    version: versionSchema,
  })
  .strict();

/** Validate the merged state: a partial patch alone cannot validate the timezone pair. */
export function mergePreferences(current: AccountPreferences, input: unknown): AccountPreferences {
  const { patch } = preferencesUpdateSchema.parse(input);
  return preferencesSchema.parse({
    ...current,
    ...patch,
    ...(patch.theme === undefined ? {} : { theme_explicit: true }),
  });
}

export const workspacePreferenceSchema = z
  .object({
    view: z.enum(['overview', 'queue']),
    queueView: z.enum(['list', 'kanban']),
    version: z.number().int().min(0).max(2_147_483_646),
  })
  .strict();

/** Values must come from the image decoder, never from untrusted multipart metadata. */
export const avatarSourceMetadataSchema = z
  .object({
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
      error: 'Use uma foto JPEG, PNG ou WebP.',
    }),
    bytes: z.number().int().min(1).max(AVATAR_SOURCE_LIMIT, 'A foto deve ter no máximo 2 MiB.'),
    width: z.number().int().min(64).max(4096),
    height: z.number().int().min(64).max(4096),
    pages: z.literal(1, { error: 'A foto não pode ser animada.' }),
  })
  .strict();
export const avatarCropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (crop) => crop.x + crop.width <= 1 && crop.y + crop.height <= 1,
    'O recorte precisa ficar dentro da foto.',
  );
export const avatarIntentSchema = z
  .object({
    id: z.uuid().transform((value) => value.toLowerCase()),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().min(1).max(AVATAR_STORED_LIMIT),
    version: versionSchema,
    expires: z.number().int().positive(),
    keyId: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
  })
  .strict();
export type AvatarIntent = z.infer<typeof avatarIntentSchema>;
