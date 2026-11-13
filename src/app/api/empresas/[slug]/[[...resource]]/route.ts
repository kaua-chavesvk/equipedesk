import { securityEvent } from '@/lib/security';
import { invalidateTickets } from '@/lib/ticket-cache';
import { observeApi } from '@/lib/http/observe-api';
import { readJson } from '@/lib/http/read-json';
import { queryTickets, ticketCounts, ticketById, queueInput } from '@/lib/ticket-queries';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/supabase/database.types';
import { demoEnabled,demoStore,getWorkspace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { failure,HttpError,ticketInput,transitionInput } from '@/lib/http/api';
export const dynamic='force-dynamic';
type Context={params:Promise<{slug:string;resource?:string[]}>};
async function handle(request:Request,context:Context){try{
 const {slug,resource=[]}=await context.params;const [section,id,sub]=resource;const workspace=await getWorkspace(slug);const method=request.method;const url=new URL(request.url);const payload=method==='GET'||method==='DELETE'?{}:await readJson(request);
 if(method==='GET'){
 if(section==='painel')return NextResponse.json(await ticketCounts(workspace));
 if(section==='membros'){if(workspace.organization.role!=='admin')throw new HttpError(403,'Apenas administradores podem gerenciar a equipe.');return NextResponse.json({data:workspace.members});}
 if(section==='chamados'){
 if(id){const ticket=await ticketById(workspace,id);if(!ticket)throw new HttpError(404,'Chamado não encontrado.');if(demoEnabled()){const data=await demoStore();return NextResponse.json({ticket,comments:data.comments[id]??[],events:data.events[id]??[]});}const db=await supabaseServer();const [{data:comments,error:commentError},{data:events,error:eventError}]=await Promise.all([db.from('comments').select('*').eq('ticket_id',id).eq('organization_id',workspace.organization.id).order('created_at'),db.from('ticket_events').select('*').eq('ticket_id',id).eq('organization_id',workspace.organization.id).order('created_at')]);if(commentError||eventError)throw commentError??eventError;return NextResponse.json({ticket,comments:comments??[],events:events??[]});}
 return NextResponse.json(await queryTickets(workspace,queueInput.parse({pageSize:10,...Object.fromEntries(url.searchParams)})));}
 throw new HttpError(404,'Recurso não encontrado.');}
 let action:string;let validated:Record<string,unknown>;
 if(section==='chamados'&&!id&&method==='POST'){action='create_ticket';validated=ticketInput.parse(payload);}
 else if(section==='chamados'&&id&&sub==='comentarios'&&method==='POST'){action='comment';validated={id,...z.object({body:z.string().trim().min(1).max(5000)}).strict().parse(payload)};}
 else if(section==='chamados'&&id&&sub==='transicoes'&&method==='POST'){action='transition';validated={id,...transitionInput.parse(payload)};}
 else if(section==='membros'&&id&&method==='PATCH'){action='update_member';validated={id,...z.object({role:z.enum(['admin','agent','requester'])}).strict().parse(payload)};}
 else if(section==='membros'&&id&&method==='DELETE'){action='remove_member';validated={id};}
 else if(section==='convites'&&!id&&method==='POST'){action='invite';validated=z.object({email:z.email().transform(s=>s.toLowerCase()),role:z.enum(['admin','agent','requester'])}).strict().parse(payload);}
 else if(section==='convites'&&id&&method==='DELETE'){action='revoke_invite';validated={id};}
 else throw new HttpError(404,'Recurso não encontrado.');
 if(!demoEnabled()){const db=await supabaseServer();const {data,error}=await db.rpc('desk_command',{p_slug:slug,p_action:action,p_payload:validated as Json});if(error)throw new Error(error.message);
   if(process.env.TICKET_CACHE_ENABLED === 'true' && ['create_ticket','transition'].includes(action)) {
     try { invalidateTickets(workspace.organization.id); }
     catch { securityEvent('ticket_cache_invalidation_failed', 500, request.headers.get('x-request-id') ?? undefined); }
   }
   return NextResponse.json(data,{status:['create_ticket','comment','invite'].includes(action)?201:200});}
 const store=await demoStore();const org=workspace.organization;const actor=workspace.user;let result:unknown;
 if(['invite','update_member','remove_member','revoke_invite'].includes(action)&&org.role!=='admin')throw new HttpError(403,'Apenas administradores podem gerenciar a equipe.');
 if(action==='create_ticket'){const ticket={...ticketInput.parse(validated),id:randomUUID(),organization_id:org.id,requester_id:actor.id,assignee_id:null,status:'open' as const,version:1,created_at:new Date().toISOString(),requester_name:actor.name};store.tickets.unshift(ticket);store.events[ticket.id]=[{id:randomUUID(),kind:'created',actor_id:actor.id,created_at:ticket.created_at,payload:{}}];result=ticket;}
 else if(action==='comment'||action==='transition'){const ticket=workspace.tickets.find(t=>t.id===id);if(!ticket)throw new HttpError(404,'Chamado não encontrado.');if(action==='comment'){const comment={id:randomUUID(),body:String(validated.body),author_id:actor.id,author_name:actor.name,created_at:new Date().toISOString()};(store.comments[ticket.id]??=[]).push(comment);result=comment;}else{if(ticket.version!==validated.version)throw new HttpError(409,'O chamado foi atualizado. Recarregue e tente novamente.');const transition=String(validated.action);if(transition!=='reopen'&&org.role==='requester')throw new HttpError(403,'Apenas atendentes podem realizar esta ação.');if(transition==='assign'&&(ticket.status!=='open'||ticket.assignee_id))throw new HttpError(409,'Este chamado já foi assumido.');if(transition==='resolve'&&ticket.status!=='in_progress')throw new HttpError(409,'Assuma o chamado antes de resolver.');if(transition==='reopen'&&(ticket.status!=='resolved'||!String(validated.reason??'').trim()))throw new HttpError(422,'Informe o motivo para reabrir um chamado resolvido.');ticket.status=transition==='assign'?'in_progress':transition==='resolve'?'resolved':'open';ticket.assignee_id=transition==='assign'?actor.id:transition==='reopen'?null:ticket.assignee_id;ticket.assignee_name=transition==='assign'?actor.name:undefined;ticket.version++;(store.events[ticket.id]??=[]).push({id:randomUUID(),kind:transition,actor_id:actor.id,created_at:new Date().toISOString(),payload:{reason:validated.reason??null}});result=ticket;}}
 else if(action==='update_member'||action==='remove_member'){const member=store.members.find(m=>m.user_id===id&&m.organization_id===org.id);if(!member)throw new HttpError(404,'Membro não encontrado.');if(member.role==='admin'&&store.members.filter(m=>m.organization_id===org.id&&m.role==='admin').length===1)throw new HttpError(409,'Não é possível remover ou rebaixar o último administrador.');if(action==='remove_member')store.members=store.members.filter(m=>m!==member);else member.role=validated.role as typeof member.role;result={id};}
 else if(action==='invite'){throw new HttpError(422,'Conecte o Supabase para emitir convites com aceite seguro.');}else result={id};
 return NextResponse.json(result,{status:['create_ticket','comment'].includes(action)?201:200});
 }catch(error){return failure(error);}}
export const GET = observeApi('/api/empresas/[slug]/[[...resource]]', handle);
export { GET as POST, GET as PATCH, GET as DELETE };
