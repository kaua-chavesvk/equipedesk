import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Credentials belong only to this process, never to the application bundle.
const input = z.object({
  url: z.url(), key: z.string().min(1), email: z.email(),
  password: z.string().min(8), name: z.string().min(1),
}).safeParse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  name: process.env.ADMIN_NAME ?? 'Administrador geral',
});
if (!input.success) {
  console.error('Configure URL, chave administrativa, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres) no ambiente do script.');
  process.exit(1);
}
const { url, key, email, password, name } = input.data;
const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
try {
  // Check that the migration exists before creating an account.
  const { error: schemaError } = await client.from('platform_admins').select('user_id').limit(1);
  if (schemaError) throw new Error('Aplique a migração platform_admins antes de provisionar o acesso.');
  let user;
  for (let page=1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({page,perPage:1000});
    if (error) throw new Error('Não foi possível consultar as contas. Confira a configuração administrativa.');
    user = data.users.find(u=>u.email?.toLowerCase()===email.toLowerCase());
    if (user || data.users.length<1000) break;
  }
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}});
    if (error || !data.user) throw new Error('Não foi possível criar a conta. Confira os requisitos de senha do Supabase.');
    user=data.user;
  }
  const { error } = await client.from('platform_admins').upsert({user_id:user.id});
  if (error) throw new Error('A conta existe, mas a atribuição de administrador geral falhou. Execute novamente após verificar a migração.');
  console.log('Administrador geral provisionado. Contas preexistentes mantêm a senha e os dados originais.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao provisionar administrador.');
  process.exitCode=1;
}
