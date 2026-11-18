import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseCommand } from '@/lib/server/workspace-api/commands';
import type { Workspace } from '@/lib/data';
const { store } = vi.hoisted(() => ({
  store: { tickets: [] as unknown[], comments: {}, events: {}, members: [] },
}));
vi.mock('@/lib/data', () => ({ demoStore: async () => store }));
import { executeDemo } from '@/lib/server/workspace-api/demo';
function workspace(role: 'admin' | 'requester' = 'admin'): Workspace {
  return {
    demo: true,
    organizations: [],
    organization: { id: 'org', slug: 'demo', name: 'Demo', role },
    user: { id: 'owner', name: 'Owner', email: 'owner@example.invalid' },
    members: [],
    tickets: [
      {
        id: 'ticket',
        organization_id: 'org',
        requester_id: 'owner',
        assignee_id: null,
        status: 'open',
        version: 1,
        title: 'Ticket example',
        description: 'Description example',
        priority: 'medium',
        created_at: '2026-11-18T00:00:00Z',
      },
    ],
  };
}
beforeEach(() => {
  store.events = {};
  store.comments = {};
  store.tickets = [];
  store.members = [];
});
describe('workspace command boundaries', () => {
  it('validates creation and rejects unexpected fields', () => {
    expect(
      parseCommand('chamados', undefined, undefined, 'POST', {
        title: 'Example ticket',
        description: 'Description example',
      }).action,
    ).toBe('create_ticket');
    expect(() =>
      parseCommand('chamados', undefined, undefined, 'POST', {
        title: 'Example ticket',
        description: 'Description example',
        organization_id: 'other',
      }),
    ).toThrow();
  });
  it('normalizes invitation email and rejects unsupported route', () => {
    expect(
      parseCommand('convites', undefined, undefined, 'POST', {
        email: 'MEMBER@example.com',
        role: 'agent',
      }).validated.email,
    ).toBe('member@example.com');
    expect(() => parseCommand('unknown', undefined, undefined, 'POST', {})).toThrow(
      'Recurso não encontrado.',
    );
  });
  it('rejects stale transitions without changing ticket or history', async () => {
    const w = workspace();
    await expect(
      executeDemo(w, 'transition', { action: 'assign', version: 2 }, 'ticket'),
    ).rejects.toMatchObject({ status: 409 });
    expect(w.tickets[0].version).toBe(1);
    expect(store.events).toEqual({});
  });
  it('enforces requester role using shared domain rules', async () => {
    const w = workspace('requester');
    await expect(
      executeDemo(w, 'transition', { action: 'assign', version: 1 }, 'ticket'),
    ).rejects.toMatchObject({ status: 403, message: 'Seu papel não permite assumir chamados.' });
    expect(store.events).toEqual({});
  });
  it('allows requester to reopen own resolved ticket and records one event', async () => {
    const w = workspace('requester');
    w.tickets[0].status = 'resolved';
    const response = await executeDemo(
      w,
      'transition',
      { action: 'reopen', version: 1, reason: 'Ainda preciso de ajuda' },
      'ticket',
    );
    expect(response.status).toBe(200);
    expect(w.tickets[0]).toMatchObject({ status: 'open', version: 2, assignee_id: null });
    expect(Object.values(store.events)[0]).toHaveLength(1);
  });
  it('does not expose another requester ticket even if passed in workspace', async () => {
    const w = workspace('requester');
    w.tickets[0].requester_id = 'other';
    w.tickets[0].status = 'resolved';
    await expect(
      executeDemo(
        w,
        'transition',
        { action: 'reopen', version: 1, reason: 'Ainda preciso de ajuda' },
        'ticket',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(store.events).toEqual({});
  });
});
