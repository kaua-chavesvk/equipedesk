import { expect, it } from 'vitest';
import { conversationTimeline } from '../../src/lib/conversation-timeline';

it('intercala comentários e eventos sem repetir o registro de comentário', () => {
  const result = conversationTimeline([{ id: 'comment', created_at: '2026-11-13T12:01:00Z' }], [
    { id: 'resolve', kind: 'resolved', created_at: '2026-11-13T12:02:00Z' },
    { id: 'open', kind: 'created', created_at: '2026-11-13T12:00:00Z' },
    { id: 'duplicate', kind: 'commented', created_at: '2026-11-13T12:01:00Z' },
  ]);
  expect(result.map(item => item.entry.id)).toEqual(['open', 'comment', 'resolve']);
});
