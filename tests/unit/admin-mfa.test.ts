import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mfaInput } from '@/features/security/mfa';
import { adminMfaStatus, changeAdminMfa, requirePlatformAdmin, totpQrImage } from '@/lib/server/admin-mfa';
import { requireAccount } from '@/lib/server/account-settings';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/account-settings', () => ({ requireAccount: vi.fn() }));

const id = 'bc2e733b-3b12-4df1-8c76-80420fa8f924';
const factor = { id, factor_type: 'totp', status: 'unverified' };
function fixture(factors = [factor], aal = 'aal1') {
  const mfa = {
    listFactors: vi.fn().mockResolvedValue({ data: { all: factors }, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: { id, totp: { qr_code: 'data:image/svg+xml;utf-8,synthetic', secret: 'synthetic-test-key' } }, error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
    unenroll: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const auth = {
    mfa,
    getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: 'admin', aal } }, error: null }),
  };
  return { auth: auth as unknown as Parameters<typeof adminMfaStatus>[0], mfa, getClaims: auth.getClaims };
}
afterEach(() => vi.clearAllMocks());

describe('contrato MFA', () => {
  it.each([
    { action: 'verify', factorId: id, code: '12' },
    { action: 'verify', factorId: id, code: '12345a' },
    { action: 'verify', factorId: '../other', code: '123456' },
    { action: 'enroll', userId: 'other' },
    { action: 'cancel', factorId: id, code: '123456' },
  ])('recusa payload inválido ou campos extras', input => {
    expect(mfaInput.safeParse(input).success).toBe(false);
  });
  it('preserva zeros à esquerda no código', () => {
    expect(mfaInput.parse({ action: 'verify', factorId: id, code: '001234' })).toMatchObject({ code: '001234' });
  });
});

describe('segundo fator', () => {
  it('não expõe segredo nem inclui fatores de outro tipo no status', async () => {
    const { auth } = fixture([factor, { ...factor, id: 'phone', factor_type: 'phone' }]);
    await expect(adminMfaStatus(auth, 'admin')).resolves.toEqual({ verified: false, factors: [{ id, status: 'unverified' }] });
  });
  it.each(['aal1', 'aal2'])('usa AAL validado do mesmo usuário: %s', async aal => {
    const { auth } = fixture([], aal);
    expect((await adminMfaStatus(auth, 'admin')).verified).toBe(aal === 'aal2');
    await expect(adminMfaStatus(auth, 'other')).rejects.toMatchObject({ status: 503 });
  });
  it('falha fechada se o provedor não consegue listar fatores', async () => {
    const { auth, mfa } = fixture();
    mfa.listFactors.mockResolvedValue({ data: null, error: new Error('provider private detail') });
    await expect(adminMfaStatus(auth, 'admin')).rejects.toMatchObject({ status: 503 });
  });
  it('cadastra TOTP e retorna a chave apenas na resposta de cadastro', async () => {
    const { auth, mfa } = fixture([]);
    await expect(changeAdminMfa(auth, 'admin', { action: 'enroll' })).resolves.toEqual({
      factorId: id, qrCode: 'data:image/svg+xml;base64,c3ludGhldGlj', secret: 'synthetic-test-key',
    });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'EquipeDesk' });
  });
  it('não duplica nem substitui autenticador existente', async () => {
    const { auth, mfa } = fixture();
    await expect(changeAdminMfa(auth, 'admin', { action: 'enroll' })).rejects.toMatchObject({ status: 409 });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it('recusa fator que não pertence ao usuário', async () => {
    const { auth, mfa } = fixture([]);
    await expect(changeAdminMfa(auth, 'admin', { action: 'verify', factorId: id, code: '001234' })).rejects.toMatchObject({ status: 404 });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
  it('não remove um fator confirmado mesmo em sessão AAL1', async () => {
    const { auth, mfa } = fixture([{ ...factor, status: 'verified' }]);
    await expect(changeAdminMfa(auth, 'admin', { action: 'cancel', factorId: id })).rejects.toMatchObject({ status: 403 });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });
  it('permite cancelar somente cadastro pendente', async () => {
    const { auth, mfa } = fixture();
    mfa.listFactors.mockResolvedValueOnce({ data: { all: [factor] }, error: null })
      .mockResolvedValueOnce({ data: { all: [] }, error: null });
    await expect(changeAdminMfa(auth, 'admin', { action: 'cancel', factorId: id })).resolves.toEqual({ verified: false, factors: [] });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: id });
  });
  it('código incorreto não concede AAL2 nem vaza erro do provedor', async () => {
    const { auth, mfa } = fixture();
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error('sensitive provider detail') });
    await expect(changeAdminMfa(auth, 'admin', { action: 'verify', factorId: id, code: '001234' }))
      .rejects.toMatchObject({ status: 422, message: 'Código inválido ou expirado. Confira o autenticador e tente novamente.' });
  });
  it('confirma o código e consulta o nível da nova sessão', async () => {
    const { auth, mfa, getClaims } = fixture();
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: 'admin', aal: 'aal1' } }, error: null })
      .mockResolvedValueOnce({ data: { claims: { sub: 'admin', aal: 'aal2' } }, error: null });
    expect((await changeAdminMfa(auth, 'admin', { action: 'verify', factorId: id, code: '001234' }))).toMatchObject({ verified: true });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: id, code: '001234' });
  });
});

describe('imagem TOTP', () => {
  it('preserva o SVG com fragmentos e quebras de linha em uma URL base64 válida', () => {
    const svg = '<svg><path fill="#000" d="M0 0" /></svg>\n';
    const result = totpQrImage('data:image/svg+xml;utf-8,' + svg);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    expect(Buffer.from(result.split(',')[1], 'base64').toString('utf8')).toBe(svg);
  });
  it('recusa URL externa ou formato inesperado sem expor o conteúdo', () => {
    expect(() => totpQrImage('https://external.example/qr')).toThrow('Não foi possível cadastrar o autenticador.');
  });
});

describe('autorização administrativa', () => {
  beforeEach(() => { vi.mocked(requireAccount).mockReset(); });
  it('exige sessão autenticada', async () => {
    vi.mocked(requireAccount).mockRejectedValue({ status: 401 });
    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    [{ data: null, error: null }, 403],
    [{ data: null, error: new Error('unavailable') }, 503],
  ])('recusa ausência de privilégio ou falha de consulta', async (result, status) => {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const scope = { user: { id: 'admin' }, db: { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) } };
    vi.mocked(requireAccount).mockResolvedValue(scope as unknown as Awaited<ReturnType<typeof requireAccount>>);
    await expect(requirePlatformAdmin()).rejects.toMatchObject({ status });
    expect(eq).toHaveBeenCalledWith('user_id', 'admin');
  });
});
