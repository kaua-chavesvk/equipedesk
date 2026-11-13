import { spawnSync } from 'node:child_process';
if(process.env.CONFIRM_LOCAL_RESET!=='yes')throw Error('Defina CONFIRM_LOCAL_RESET=yes para restaurar somente o banco Supabase local.');
const result=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['exec','supabase','db','reset','--local'],{stdio:'inherit',shell:false});
if(result.status!==0)process.exit(result.status??1);
await import('./seed.mjs');
