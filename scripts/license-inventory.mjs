import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const groups=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const packages=Object.values(groups).flat().map(item=>({name:item.name,versions:item.versions,license:item.license,homepage:item.homepage??'',paths:item.paths})).sort((a,b)=>a.name.localeCompare(b.name));
const inventory=[];let notices='# Third-party notices\n\nProduction dependency inventory. Preserve these notices with redistributed copies.\n';
for(const item of packages){
 const texts=[];
 for(const path of item.paths??[]){
  for(const file of readdirSync(path))if(/^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(file)){
   try{const text=readFileSync(join(path,file),'utf8');if(!texts.includes(text))texts.push(text);}catch{}
  }
 }
 const safe={name:item.name,versions:item.versions,license:item.license,homepage:item.homepage};inventory.push({...safe,noticeFilesFound:texts.length});
 notices+=`\n## ${item.name} (${item.versions.join(', ')})\n\nLicense: ${item.license}\n\n`+(texts.length?texts.map(t=>`\`\`\`text\n${t.trim()}\n\`\`\`\n`).join('\n'):'License file not found at package root; review metadata and distribution before release.\n');
}
writeFileSync('docs/licenses.json',JSON.stringify(inventory,null,2)+'\n');writeFileSync('THIRD_PARTY_NOTICES.md',notices);
console.log(`Inventário gerado: ${inventory.length} pacotes; ${inventory.filter(i=>!i.noticeFilesFound).length} sem aviso de licença na raiz.`);
