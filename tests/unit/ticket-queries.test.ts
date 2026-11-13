import { beforeEach, expect, it, vi } from 'vitest';
import type { Workspace } from '../../src/lib/data';
const mocks=vi.hoisted(()=>({from:vi.fn(),demo:vi.fn(()=>false)}));
vi.mock('../../src/lib/data',()=>({demoEnabled:mocks.demo}));
vi.mock('../../src/lib/supabase/server',()=>({supabaseServer:async()=>({from:mocks.from})}));
import { queryTickets, queueInput, ticketById, ticketCounts } from '../../src/lib/ticket-queries';
const workspace={organization:{id:'aurora'},tickets:[]} as unknown as Workspace;
let calls:Record<string,unknown[][]>;
beforeEach(()=>{
 calls={};mocks.demo.mockReturnValue(false);
 mocks.from.mockImplementation(()=>{
  const query:Record<string,unknown>={};
  for(const method of ['select','eq','or','order','range','maybeSingle'])query[method]=(...args:unknown[])=>{(calls[method]??=[]).push(args);return query;};
  query.then=(resolve:(result:unknown)=>unknown)=>Promise.resolve({data:[],count:1205,error:null}).then(resolve);
  return query;
 });
});
it('consulta apenas a faixa da página e usa a contagem exata do banco',async()=>{
 const result=await queryTickets(workspace,queueInput.parse({page:3,pageSize:10,status:'open',priority:'high',q:'VPN'}));
 expect(result.total).toBe(1205);expect(calls.range).toEqual([[20,29]]);
 expect(calls.eq).toEqual([['organization_id','aurora'],['status','open'],['priority','high']]);
 expect(calls.select).toEqual([['*',{count:'exact'}]]);
 expect(calls.order).toEqual([['created_at',{ascending:false}],['id',{ascending:false}]]);
});
it('mantém pontuação e curingas da busca como texto literal',async()=>{
 const q='a%,_(b)"\\';await queryTickets(workspace,queueInput.parse({q}));
 const pattern=JSON.stringify(`%${q.replace(/[\\%_]/g,'\\$&')}%`);
 expect(calls.or).toEqual([[`title.ilike.${pattern},description.ilike.${pattern}`]]);
});
it('busca o detalhe diretamente por empresa e ID sem depender da lista',async()=>{
 const id='00000000-0000-4000-8000-000000000001';await ticketById(workspace,id);
 expect(calls.eq).toEqual([['organization_id','aurora'],['id',id]]);expect(calls.range).toBeUndefined();
});
it('conta estados sem transferir linhas de chamados',async()=>{
 const counts=await ticketCounts(workspace);expect(counts.total).toBe(3615);
 expect(calls.select).toEqual(Array(3).fill(['id',{count:'exact',head:true}]));
});
it.each([{status:'invalid'},{page:0},{pageSize:51},{q:'a'.repeat(201)}])('recusa filtros inválidos',input=>{
 expect(queueInput.safeParse(input).success).toBe(false);
});
