import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { configured,supabaseServer } from './supabase/server';
export type Role='admin'|'agent'|'requester';
export type Organization={id:string;name:string;slug:string;role:Role;platform_admin?:boolean};
export type Ticket={id:string;organization_id:string;requester_id:string;assignee_id:string|null;title:string;description:string;priority:'low'|'medium'|'high'|'urgent';status:'open'|'in_progress'|'resolved';version:number;created_at:string;requester_name?:string;assignee_name?:string;category?:string};
export type Member={user_id:string;id:string;name:string;email:string;role:Role;organization_id:string};
export type Comment={id:string;body:string;author_id:string;created_at:string;author_name?:string};
export type TicketEvent={id:string;kind:string;actor_id:string;created_at:string;payload:Record<string,unknown>};
export type Workspace={organizations:Organization[];organization:Organization;user:{id:string;email:string;name:string};tickets:Ticket[];members:Member[];demo:boolean};
type Demo={tickets:Ticket[];comments:Record<string,Comment[]>;events:Record<string,TicketEvent[]>;members:Member[];organizations:Organization[]};
const user={id:'11111111-1111-4111-8111-111111111111',email:'marina@aurora.demo',name:'Marina Costa'};
const organizations:Organization[]=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Aurora Studio',slug:'aurora',role:'admin'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Órbita Tecnologia',slug:'orbita',role:'requester'}];
const titles=['Acesso ao Figma para o time de design','Notebook com lentidão ao iniciar','Solicitação de licença Adobe Creative Cloud','Configuração de e-mail no celular','Acesso à pasta compartilhada do financeiro','Atualização de dados cadastrais','Monitor externo sem conexão','Solicitação de novo equipamento','VPN não conecta na rede de casa','Instalação do pacote Office','Dúvida sobre reembolso de viagem','Acesso ao sistema de ponto'];
function seed():Demo{return {organizations:structuredClone(organizations),members:[{id:user.id,user_id:user.id,name:user.name,email:user.email,role:'admin',organization_id:organizations[0].id},{id:'22222222-2222-4222-8222-222222222222',user_id:'22222222-2222-4222-8222-222222222222',name:'Rafael Mendes',email:'rafael@aurora.demo',role:'agent',organization_id:organizations[0].id},{id:'33333333-3333-4333-8333-333333333333',user_id:'33333333-3333-4333-8333-333333333333',name:'Beatriz Lima',email:'beatriz@aurora.demo',role:'requester',organization_id:organizations[0].id}],comments:{},events:{},tickets:titles.map((title,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,organization_id:i===11?organizations[1].id:organizations[0].id,requester_id:i%3===0?user.id:'33333333-3333-4333-8333-333333333333',assignee_id:i%3===1?'22222222-2222-4222-8222-222222222222':null,title,description:'Olá, equipe! Preciso de ajuda com esta solicitação para continuar minhas atividades. Podem verificar, por favor? Obrigada.',priority:(['medium','high','low','urgent'] as const)[i%4],status:(['open','in_progress','resolved'] as const)[i%3],version:1,created_at:new Date(Date.now()-i*3600000*5).toISOString(),requester_name:i%3===0?'Marina Costa':'Beatriz Lima',assignee_name:i%3===1?'Rafael Mendes':undefined,category:['Acessos','Equipamentos','Software'][i%3]}))};}
const globalDemo=globalThis as typeof globalThis & {deskDemo?:Map<string,Demo>};
const stores=globalDemo.deskDemo??=new Map();
export function demoEnabled(){return !configured() && (process.env.NODE_ENV!=='production'||process.env.DEMO_MODE==='true');}
export async function demoStore():Promise<Demo>{if(!demoEnabled())throw new Error('Configure o Supabase para continuar.');const jar=await cookies();const key=jar.get('desk_demo')?.value ?? 'preview';if(!stores.has(key))stores.set(key,seed());return stores.get(key)!;}
export async function initializeDemo(){const jar=await cookies();jar.set('desk_demo',randomUUID(),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});}
export async function listOrganizations():Promise<Organization[]>{
 if(demoEnabled())return (await demoStore()).organizations;
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)return [];
 const [{data:links,error},{data:orgs,error:orgError},{data:admins,error:adminError}]=await Promise.all([db.from('memberships').select('organization_id,role').eq('user_id',user.id),db.from('organizations').select('id,name,slug'),db.from('platform_admins').select('user_id').eq('user_id',user.id)]);if(error||orgError||adminError)throw error??orgError??adminError;
 const globalAdmin=(admins??[]).some(a=>a.user_id===user.id);
 return (orgs??[]).flatMap(org=>{if(globalAdmin)return [{...org,role:'admin' as const,platform_admin:true}];const link=links?.find(m=>m.organization_id===org.id);return link?[{...org,role:link.role}]:[];});
}
export async function getWorkspace(slug='aurora'):Promise<Workspace>{
 if(demoEnabled()){const data=await demoStore();const organization=data.organizations.find(o=>o.slug===slug);if(!organization)throw new Error('Empresa não encontrada.');return {organizations:data.organizations,organization,user,tickets:data.tickets.filter(t=>t.organization_id===organization.id&&(organization.role!=='requester'||t.requester_id===user.id)),members:data.members.filter(m=>m.organization_id===organization.id),demo:true};}
 const db=await supabaseServer();const {data:{user:auth}}=await db.auth.getUser();if(!auth)throw new Error('Sessão ausente.');
 const orgs=await listOrganizations();const organization=orgs.find(o=>o.slug===slug);if(!organization)throw new Error('Empresa não encontrada.');
 const {data:members,error:memberError}=await db.from('memberships').select('*').eq('organization_id',organization.id);if(memberError)throw memberError;
 return {organizations:orgs,organization,user:{id:auth.id,email:auth.email??'',name:auth.user_metadata.name??auth.email?.split('@')[0]??'Você'},tickets:[],members:(members??[]).map(m=>({...m,id:m.user_id,name:m.user_id===auth.id?'Você':'Membro da equipe',email:''})),demo:false};
}

