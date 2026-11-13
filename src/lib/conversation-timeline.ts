type Entry = { id?: unknown; created_at?: unknown };
type Event = Entry & { kind?: unknown };

export function conversationTimeline(comments: Entry[], events: Event[]) {
  return [
    ...comments.map(entry => ({ type: 'comment' as const, entry })),
    ...events.filter(entry => entry.kind !== 'commented').map(entry => ({ type: 'event' as const, entry })),
  ].sort((a, b) => Date.parse(String(a.entry.created_at)) - Date.parse(String(b.entry.created_at))
    || String(a.entry.id).localeCompare(String(b.entry.id)));
}
