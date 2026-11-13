import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='docs/legal/2026-11-12';
const manifest=JSON.parse(readFileSync(`${root}/manifest.json`,'utf8'));
const definitions=readFileSync('src/lib/legal.ts','utf8');
for(const [kind,path] of [['terms','src/app/termos/page.tsx'],['privacy','src/app/privacidade/page.tsx']]){
 const hash=createHash('sha256').update(readFileSync(path,'utf8')+'\n'+definitions).digest('hex');
 if(hash!==manifest.hashes[kind])throw new Error('Documento legal mudou sem atualizar versão, snapshot e migração de aceite.');
}
for(const name of ['confirmation','recovery','invite','magic_link','email_change','reauthentication']){
 const html=readFileSync(`supabase/templates/${name}.html`,'utf8');
 if(!html.includes('/descadastro')||!html.includes('mailto:mikaelson.desk@gmail.com'))throw new Error(`Rodapé de privacidade ausente no template ${name}.`);
 if(/<script|<img|<iframe/i.test(html))throw new Error(`Recurso de rastreamento ou script inesperado no template ${name}.`);
}
console.log('Documentos versionados e rodapés dos seis templates conferidos.');
