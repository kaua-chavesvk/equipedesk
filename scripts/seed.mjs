/** Administrative key is used only by this explicit local development script. */
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do script.');
if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Este script permite apenas Supabase local.');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const password=process.env.DEMO_PASSWORD||'EquipeDesk-local-2026!';
const accounts=[['marina@aurora.example','Marina Costa'],['lucas@aurora.example','Lucas Almeida'],['bia@horizonte.example','Beatriz Lima'],['rafa@compartilhado.example','Rafael Santos']];
const {data:existing,error:listError}=await admin.auth.admin.listUsers();
if(listError)throw listError;
const users={};
for(const [email,name] of accounts){let user=existing.users.find(u=>u.email===email);if(!user){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}});if(error)throw error;user=data.user;}users[email]=user.id;}
const orgs=[{id:'10000000-0000-4000-8000-000000000001',name:'Aurora Studio',slug:'aurora'},{id:'10000000-0000-4000-8000-000000000002',name:'Horizonte Labs',slug:'horizonte'}];
for(const organization of orgs){const {error}=await admin.from('organizations').upsert(organization);if(error)throw error;}
const memberships=[{organization_id:orgs[0].id,user_id:users['marina@aurora.example'],role:'admin'},{organization_id:orgs[0].id,user_id:users['lucas@aurora.example'],role:'requester'},{organization_id:orgs[0].id,user_id:users['rafa@compartilhado.example'],role:'agent'},{organization_id:orgs[1].id,user_id:users['bia@horizonte.example'],role:'admin'},{organization_id:orgs[1].id,user_id:users['rafa@compartilhado.example'],role:'requester'}];
const {error}=await admin.from('memberships').upsert(memberships);
if(error)throw error;
console.log('Demonstração local preparada. Contas:',accounts.map(([email])=>email).join(', '));
console.log('Senha: variável DEMO_PASSWORD ou padrão documentado no README.');
