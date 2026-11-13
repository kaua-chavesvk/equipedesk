import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function GET(){
 const text=await readFile(join(process.cwd(),'THIRD_PARTY_NOTICES.md'),'utf8');
 return new Response(text,{headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}});
}
