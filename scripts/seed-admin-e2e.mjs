import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
assert.ok(url && key && password);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.auth.admin.listUsers();
if (error) throw new Error('Falha ao localizar a conta de teste.');
const marina = data.users.find(user => user.email === 'marina@aurora.example');
if (!marina) throw new Error('Execute o seed local antes do teste de administração.');

const { error: updateError } = await db.auth.admin.updateUserById(marina.id, { password });
if (updateError) throw new Error('Falha ao preparar a senha de teste.');
const { error: cleanupError } = await db.from('privacy_requests').delete()
  .eq('user_id', marina.id)
  .eq('kind', 'access')
  .eq('details', 'Pedido para verificar autorização de resposta.');
if (cleanupError) throw new Error('Falha ao limpar os pedidos da conta de teste.');
