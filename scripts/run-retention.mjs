import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure URL e chave administrativa somente no ambiente desta rotina.');
if(process.env.CONFIRM_RETENTION_PURGE!=='yes')throw new Error('A rotina elimina dados vencidos. Revise as retenções legais e defina CONFIRM_RETENTION_PURGE=yes para executar.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await db.rpc('run_privacy_retention',{p_limit:100});
if(error)throw new Error('Descarte não executado. Verifique migrações e credenciais administrativas.');
console.log(JSON.stringify({retention:data}));
