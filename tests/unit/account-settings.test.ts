import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
vi.mock('server-only', () => ({}));
import {
  DEFAULT_ACCOUNT_PREFERENCES as defaults,
  displayNameSchema,
  preferencesUpdateSchema,
  mergePreferences,
  avatarSourceMetadataSchema,
  avatarCropSchema,
  workspacePreferenceSchema,
} from '../../src/features/account-settings/contracts';
import {
  attestAvatarUpload,
  attestAvatarFinalization,
} from '../../src/lib/server/avatar-attestation';
import { formatAccountDate } from '../../src/features/account-settings/format';

describe('configurações da conta', () => {
  it('preserva Unicode e normaliza espaços externos sem aceitar controles', () => {
    expect(displayNameSchema.parse('  João da Conceição  ')).toBe('João da Conceição');
    for (const name of ['', ' '.repeat(5), 'a'.repeat(101), 'Pessoa\nOutra', 'Pessoa\u0000']) {
      expect(displayNameSchema.safeParse(name).success).toBe(false);
    }
  });
  it('mantém padrões privados sem ativar notificações ou alterar o objeto original', () => {
    expect(defaults).toMatchObject({
      locale: 'pt-BR',
      theme: 'system',
      timezone: null,
      notify_comment: false,
    });
    expect(mergePreferences(defaults, { patch: { theme: 'dark' }, version: 1 })).toMatchObject({
      theme: 'dark',
      theme_explicit: true,
    });
    expect(defaults.theme).toBe('system');
  });
  it('não preenche defaults em um patch parcial', () => {
    expect(preferencesUpdateSchema.parse({ patch: { locale: 'en' }, version: 1 }).patch).toEqual({
      locale: 'en',
    });
  });
  it.each([
    { patch: { user_id: 'alheio' }, version: 1 },
    { patch: { locale: 'fr' }, version: 1 },
    { patch: { text_scale: 200 }, version: 1 },
    { patch: { theme: 'purple' }, version: 1 },
    { patch: {}, version: 1 },
    { patch: { notify_comment: 'true' }, version: 1 },
    { patch: { theme: 'dark' }, version: 0 },
  ])('rejeita entrada indevida %j', (input) => {
    expect(preferencesUpdateSchema.safeParse(input).success).toBe(false);
  });
  it('valida o fuso completo após mesclar, inclusive voltando ao automático', () => {
    const manual = mergePreferences(defaults, {
      patch: { timezone_mode: 'manual', timezone: 'America/Sao_Paulo' },
      version: 1,
    });
    expect(manual.timezone).toBe('America/Sao_Paulo');
    expect(() =>
      mergePreferences(defaults, { patch: { timezone_mode: 'manual' }, version: 1 }),
    ).toThrow();
    expect(() =>
      mergePreferences(defaults, { patch: { timezone: 'Invalid/Zone' }, version: 1 }),
    ).toThrow();
    expect(
      mergePreferences(manual, { patch: { timezone_mode: 'auto', timezone: null }, version: 2 })
        .timezone,
    ).toBe(null);
  });
  it('visualização recente aceita apenas enums, sem URLs ou IDs arbitrários', () => {
    expect(
      workspacePreferenceSchema.safeParse({
        view: 'https://externo.example',
        queueView: 'list',
        version: 0,
      }).success,
    ).toBe(false);
    expect(
      workspacePreferenceSchema.parse({ view: 'queue', queueView: 'kanban', version: 0 }),
    ).toBeDefined();
  });
  it('mantém a data brasileira e ajusta a virada do dia pelo fuso', () => {
    const value = '2025-01-02T01:30:00Z';
    expect(formatAccountDate(value, 'America/Sao_Paulo')).toBe('01/01/2025');
    expect(formatAccountDate(value, 'UTC')).toBe('02/01/2025');
    expect(formatAccountDate(value, 'America/Sao_Paulo', true)).toContain('22:30');
  });
});

describe('contratos de foto', () => {
  const source = { mime: 'image/jpeg', bytes: 2_097_152, width: 4096, height: 4096, pages: 1 };
  it('aceita o limite de bytes e rejeita excesso, animação e tipo não permitido', () => {
    expect(avatarSourceMetadataSchema.safeParse(source).success).toBe(true);
    for (const patch of [
      { bytes: 2_097_153 },
      { width: 4097 },
      { pages: 2 },
      { mime: 'image/svg+xml' },
    ]) {
      expect(avatarSourceMetadataSchema.safeParse({ ...source, ...patch }).success).toBe(false);
    }
    expect(avatarCropSchema.safeParse({ x: 0.8, y: 0, width: 0.3, height: 0.3 }).success).toBe(
      false,
    );
  });
  const actor = '10000000-0000-4000-8000-000000000001';
  const intent = {
    id: '20000000-0000-4000-8000-000000000001',
    digest: 'a'.repeat(64),
    bytes: 100,
    version: 1,
    expires: 1_900_000_030,
    keyId: 'test',
  };
  const fixtureSecret = 'unit-test-only-'.repeat(3);
  it('vincula o atestado a usuário, caminho, bytes, versão e prazo', () => {
    const canonical = [
      'avatar-upload-v1',
      actor,
      intent.id,
      `${actor}/${intent.id}.webp`,
      intent.digest,
      '100',
      '1',
      '1900000030',
    ].join('\n');
    expect(attestAvatarUpload(actor, intent, fixtureSecret, 1_900_000_000_000)).toBe(
      createHmac('sha256', fixtureSecret).update(canonical).digest('hex'),
    );
    expect(
      attestAvatarUpload(actor, { ...intent, bytes: 101 }, fixtureSecret, 1_900_000_000_000),
    ).not.toBe(attestAvatarUpload(actor, intent, fixtureSecret, 1_900_000_000_000));
  });
  it('recusa prazos expirados, longos ou segredo fraco e separa a finalização', () => {
    expect(() => attestAvatarUpload(actor, intent, fixtureSecret, 1_900_000_030_000)).toThrow();
    expect(() => attestAvatarUpload(actor, intent, fixtureSecret, 1_899_999_000_000)).toThrow();
    expect(() => attestAvatarUpload(actor, intent, 'test', 1_900_000_000_000)).toThrow();
    expect(attestAvatarFinalization(actor, intent, fixtureSecret)).not.toBe(
      attestAvatarUpload(actor, intent, fixtureSecret, 1_900_000_000_000),
    );
  });
});
