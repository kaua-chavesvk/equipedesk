import { describe, expect, it } from 'vitest';
import { authInput } from '../../src/lib/http/auth-input';
import { transitionInput } from '../../src/lib/http/api';
import { LEGAL_VERSION } from '../../src/lib/legal';

describe('validação por ação de autenticação', () => {
  it.each([
    { action: 'login', email: 'marina@example.com' },
    { action: 'login', password: 'senha-segura' },
    { action: 'signup', email: 'marina@example.com' },
    { action: 'signup', password: 'senha-segura' },
    { action: 'recover' },
    { action: 'update_password' },
    { action: 'login', email: 'inválido', password: 'senha-segura' },
    { action: 'update_password', password: 'curta' },
    { action: 'logout', password: 'senha-segura' },
  ])('recusa entrada incompleta ou incompatível: %j', payload => {
    expect(authInput.safeParse(payload).success).toBe(false);
  });

  it.each([
    { action: 'login', email: 'marina@example.com', password: 'senha-segura' },
    { action: 'signup', email: 'marina@example.com', password: 'senha-segura', name: 'Marina', termsAccepted: true, adultConfirmed: true, termsVersion: LEGAL_VERSION, privacyVersion: LEGAL_VERSION },
    { action: 'recover', email: 'marina@example.com' },
    { action: 'update_password', password: 'senha-segura' },
    { action: 'logout' },
    { action: 'demo' },
  ])('aceita os campos da ação: %j', payload => {
    expect(authInput.safeParse(payload).success).toBe(true);
  });
});

describe('motivo de reabertura', () => {
  it.each([undefined, '', '   ', 'ab', 'a'.repeat(1001)])('recusa motivo fora dos limites', reason => {
    expect(transitionInput.safeParse({ action: 'reopen', version: 1, reason }).success).toBe(false);
  });

  it.each(['abc', 'a'.repeat(1000)])('aceita os limites de 3 e 1000 caracteres', reason => {
    expect(transitionInput.safeParse({ action: 'reopen', version: 1, reason }).success).toBe(true);
  });

  it('remove espaços externos e mantém motivo opcional nas demais transições', () => {
    expect(transitionInput.parse({ action: 'reopen', version: 1, reason: '  Problema persiste  ' }).reason).toBe('Problema persiste');
    expect(transitionInput.safeParse({ action: 'assign', version: 1 }).success).toBe(true);
    expect(transitionInput.safeParse({ action: 'resolve', version: 2 }).success).toBe(true);
  });
});
