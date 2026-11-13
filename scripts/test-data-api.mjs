/** Real local Supabase REST/Auth verification; never uses a privileged key. */
import assert from 'node:assert/strict';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Execute somente contra Supabase local.');
const password = process.env.DEMO_PASSWORD || 'EquipeDesk-local-2026!';
const base = url.replace(/\/$/, '');
let checks = 0;
function passed(label) { checks += 1; console.log(`OK ${checks}: ${label}`); }
async function request(path, token, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  return { status: response.status, ok: response.ok, headers: response.headers, data: raw ? JSON.parse(raw) : null };
}
async function signIn(email) {
  const result = await request('/auth/v1/token?grant_type=password', null, { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, `Login falhou para ${email}. Execute o seed local primeiro.`);
  assert.ok(result.data.access_token && result.data.user.id);
  return { token: result.data.access_token, id: result.data.user.id };
}
async function command(user, slug, action, payload) {
  return request('/rest/v1/rpc/desk_command', user.token, {
    method: 'POST', body: { p_slug: slug, p_action: action, p_payload: payload },
  });
}
function success(result, label) {
  assert.ok(result.ok, `${label}: HTTP ${result.status}, ${result.data?.message || 'falha sem mensagem'}`);
  return result.data;
}
function denied(result, label) {
  assert.ok([401, 403].includes(result.status), `${label}: esperado 401/403, recebido ${result.status}`);
}
const [marina, lucas, bia, rafa] = await Promise.all([
  signIn('marina@aurora.example'), signIn('lucas@aurora.example'),
  signIn('bia@horizonte.example'), signIn('rafa@compartilhado.example'),
]);
passed('Quatro sessões reais via Supabase Auth');
const organizations = success(await request('/rest/v1/organizations?select=id,slug', lucas.token), 'Leitura de empresas');
assert.deepEqual(organizations.map((org) => org.slug), ['aurora']);
passed('Empresa externa invisível na API de dados');
const shared = success(await request('/rest/v1/memberships?select=organization_id,role&user_id=eq.' + rafa.id, rafa.token), 'Papéis compartilhados');
assert.deepEqual(shared.map((row) => row.role).sort(), ['agent', 'requester']);
passed('Mesma identidade possui papéis distintos por empresa');
const title = `Verificação REST ${crypto.randomUUID()}`;
const manipulated = await command(lucas, 'aurora', 'create_ticket', {
  title, description: 'Chamado criado pela jornada de isolamento na API real.', priority: 'medium',
  requester_id: bia.id, organization_id: '10000000-0000-4000-8000-000000000002',
});
assert.equal(manipulated.ok, false);
assert.match(manipulated.data?.message ?? '', /^422:Campos desconhecidos/);
passed('RPC recusa campos de autor e empresa manipulados');
const ticket = success(await command(lucas, 'aurora', 'create_ticket', {
  title, description: 'Chamado criado pela jornada de isolamento na API real.', priority: 'medium',
}), 'Abertura');
assert.equal(ticket.requester_id, lucas.id);
assert.equal(ticket.organization_id, organizations[0].id);
passed('Autor e empresa vêm do contexto autorizado');
const ticketQuery = `/rest/v1/tickets?select=*&id=eq.${ticket.id}`;
assert.equal(success(await request(ticketQuery, lucas.token), 'Leitura própria').length, 1);
assert.deepEqual(success(await request(ticketQuery, bia.token), 'Leitura externa'), []);
const search = await request(`/rest/v1/tickets?select=id&title=eq.${encodeURIComponent(title)}`, bia.token, { headers: { Prefer: 'count=exact' } });
assert.deepEqual(success(search, 'Busca externa'), []);
assert.match(search.headers.get('content-range') || '', /\/0$/);
passed('Leitura por ID, busca e contagem externas retornam zero');
let roleChanged = false;
try {
  success(await command(marina, 'aurora', 'update_member', { id: rafa.id, role: 'requester' }), 'Troca de papel');
  roleChanged = true;
  assert.deepEqual(success(await request(ticketQuery, rafa.token), 'Outro solicitante'), []);
  const blocked = await command(rafa, 'aurora', 'comment', { id: ticket.id, body: 'Tentativa sem acesso' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.data.message, /^404:/);
  passed('Troca de papel afeta imediatamente leitura e comentário de outro solicitante');
} finally {
  if (roleChanged) success(await command(marina, 'aurora', 'update_member', { id: rafa.id, role: 'agent' }), 'Restauração do papel');
}
denied(await request(`/rest/v1/tickets?id=eq.${ticket.id}`, marina.token, { method: 'PATCH', body: { requester_id: bia.id } }), 'Autor imutável');
denied(await request('/rest/v1/comments', bia.token, { method: 'POST', body: {
  organization_id: ticket.organization_id, ticket_id: ticket.id, author_id: bia.id, body: 'Tentativa direta externa',
} }), 'Comentário direto bloqueado');
passed('Escrita direta não contorna imutabilidade de autoria ou autorização de comentários');
const externalCommand = await command(bia, 'aurora', 'transition', { id: ticket.id, action: 'assign', version: 1 });
assert.equal(externalCommand.ok, false);
assert.match(externalCommand.data.message, /^404:/);
passed('Comando externo é recusado sem revelar o chamado');
const race = await Promise.all([marina, rafa].map((user) => command(user, 'aurora', 'transition', { id: ticket.id, action: 'assign', version: 1 })));
assert.equal(race.filter((result) => result.ok).length, 1);
assert.match(race.find((result) => !result.ok).data.message, /^409:/);
const eventsQuery = `/rest/v1/ticket_events?select=id,kind&ticket_id=eq.${ticket.id}`;
let events = success(await request(eventsQuery, marina.token), 'Histórico da disputa');
assert.equal(events.filter((event) => event.kind === 'assign').length, 1);
assert.equal(events.length, 2);
passed('Disputa concorrente tem um vencedor e apenas um evento de atribuição');
success(await command(lucas, 'aurora', 'comment', { id: ticket.id, body: 'Informação adicional do solicitante.' }), 'Comentário autorizado');
const organizationFilter = 'organization_id=eq.' + ticket.organization_id;
for (const table of ['memberships', 'comments', 'ticket_events']) {
  const path = '/rest/v1/' + table + '?select=organization_id&' + organizationFilter;
  assert.ok(success(await request(path, marina.token), 'Controle positivo de ' + table).length > 0);
  assert.deepEqual(success(await request(path, bia.token), 'Leitura externa de ' + table), []);
}
passed('Membros, comentários e eventos da empresa são invisíveis para a sessão externa');
for (const [action, payload] of [
  ['remove_member', { id: marina.id }],
  ['update_member', { id: marina.id, role: 'requester' }],
]) {
  const result = await command(marina, 'aurora', action, payload);
  assert.equal(result.ok, false);
  assert.match(result.data.message, /^409:/);
}
passed('O único administrador da empresa não pode ser removido nem rebaixado');
const resolved = success(await command(marina, 'aurora', 'transition', { id: ticket.id, action: 'resolve', version: 2 }), 'Resolução');
assert.equal(resolved.status, 'resolved');
const before = success(await request(eventsQuery, marina.token), 'Histórico antes da falha').length;
const invalidReopen = await command(lucas, 'aurora', 'transition', { id: ticket.id, action: 'reopen', version: 3 });
assert.equal(invalidReopen.ok, false);
assert.match(invalidReopen.data.message, /^422:/);
events = success(await request(eventsQuery, marina.token), 'Histórico após falha');
assert.equal(events.length, before);
passed('Comentário e resolução funcionam; falha de reabertura preserva histórico');
console.log(`${checks} verificações conectadas aprovadas. Chamado de evidência: ${ticket.id}`);
