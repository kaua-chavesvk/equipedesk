import { describe, expect, it } from 'vitest';
import { invitationLink } from '../../src/features/invitations/management';

describe('link de renovação de convite', () => {
  it('usa a origem da aplicação e aceita o token hexadecimal emitido pelo banco', () => {
    const token = 'ab'.repeat(32);
    expect(invitationLink(token, 'https://desk.example')).toBe('https://desk.example/convite/' + token);
  });

  it.each([undefined, 42, '/login', '//evil.example', 'x'.repeat(64), 'ab'.repeat(31)])(
    'recusa uma resposta com token inválido (%s)',
    token => expect(invitationLink(token, 'https://desk.example')).toBeNull(),
  );
});
