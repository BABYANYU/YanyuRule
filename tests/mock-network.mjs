// Deterministic in-process transport used only by the isolated child-process tests.
import {createHash} from 'node:crypto';
import {CLIENTS} from '../site/clients.mjs';
const updated=process.env.YANYURULE_MOCK_UPDATED==='1';
const bytes=Buffer.from(updated?'DOMAIN,new.example.test\n':'DOMAIN,example.test\n');
const artifactRequests=new Set();
globalThis.fetch=async input=>{
 const pathname=new URL(input).pathname;let value;
 if(pathname==='/data/meta/capabilities.json')value={capabilities:Object.fromEntries(CLIENTS.map(c=>[c,{}]))};
 else if(pathname.startsWith('/data/index/')){const client=pathname.split('/').at(-1).replace('.json','');value={rules:[{id:'11111111-1111-4111-8111-111111111111',name:'Test',types:['DOMAIN'],manifest:'https://magicrule.pages.dev/data/rules/'+client+'/'+(updated?'b':'a').repeat(24)+'/manifest.json'}]};}
 else if(pathname.endsWith('/manifest.json')){const client=pathname.split('/')[3];value={client,rule:'Test',artifacts:[{key:'rules',ext:'list',role:'full',url:'https://magicrule.pages.dev/data/_shared/artifacts/Test_rules_'+(updated?'abcdef0123456789':'123456789abcdef0')+'.list',dedupe:{mode:'exact',bytes_sha256:process.env.YANYURULE_MOCK_FAIL==='1'?'0'.repeat(64):createHash('sha256').update(bytes).digest('hex')}}]};}
 else if(pathname.startsWith('/data/_shared/artifacts/')){
  if(process.env.YANYURULE_MOCK_STALE==='1'){
   if(!artifactRequests.has(pathname)){artifactRequests.add(pathname);return new Response('DOMAIN,stale.example.test\n');}
   if(!new URL(input).searchParams.has('_yanyurule_retry'))throw Error('Retry did not bypass upstream cache');
  }
  return new Response(bytes,{status:200});
 }
 else throw Error('Unexpected mock path '+pathname);
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
};
