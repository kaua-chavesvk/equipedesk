import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const excluded=new Set(['node_modules','.next','.git','.tools','test-results','playwright-report','artifacts']);
const findings=[];
const patterns=[/sb_secret_[A-Za-z0-9_-]{16,}/g, /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/g,
 /AKIA[A-Z0-9]{16}/g, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g];
function inspect(text,label){
 for(const pattern of patterns){pattern.lastIndex=0;if(pattern.test(text))findings.push({location:label,type:'secret_pattern'});}
 for(const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)??[]){
  try{if(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role==='service_role')findings.push({location:label,type:'privileged_jwt'});}catch{}
 }
}
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
 if(excluded.has(item.name)||item.isSymbolicLink())continue;
 const path=join(dir,item.name);
 if(item.isDirectory())walk(path);
 else if(/\.(?:[cm]?[jt]sx?|json|ya?ml|toml|md|sql|env|txt)$|^\.env/.test(item.name))inspect(readFileSync(path,'utf8'),relative(process.cwd(),path));
}}
walk(process.cwd());
let history='unavailable';
try{
 execFileSync('git',['rev-parse','--git-dir'],{stdio:['ignore','pipe','ignore']});
 inspect(execFileSync('git',['log','--all','-p','--no-ext-diff'],{encoding:'utf8',maxBuffer:128*1024*1024,stdio:['ignore','pipe','ignore']}),'git-history');
 history='scanned';
}catch{ /* Report unavailable history instead of claiming it was clean. */ }
console.log(JSON.stringify({currentFiles:'scanned',history,findings},null,2));
if(findings.length||process.argv.includes('--require-history')&&history!=='scanned')process.exitCode=1;
