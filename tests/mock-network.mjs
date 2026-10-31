// Deterministic in-process transport used only by the isolated child-process tests.
import {createHash} from 'node:crypto';
const bytes=Buffer.from('DOMAIN,example.test\n');
globalThis.fetch=async input=>{
 const pathname=new URL(input).pathname;let value;
 if(pathname==='/data/meta/capabilities.json')value={capabilities:{Surge:{},Mihomo:{}}};
 else if(pathname.startsWith('/data/index/')){const client=pathname.includes('Surge')?'Surge':'Mihomo';value={rules:[{id:'test-'+client,name:'Test',types:['DOMAIN'],manifest:'https://magicrule.pages.dev/data/rules/'+client+'/'+'a'.repeat(24)+'/manifest.json'}]};}
 else if(pathname.endsWith('/manifest.json')){const client=pathname.includes('Surge')?'Surge':'Mihomo';value={client,rule:'Test',artifacts:[{key:'rules',role:'full',url:'https://magicrule.pages.dev/data/_shared/artifacts/Test_rules_123456789abcdef0.list',dedupe:{mode:'exact',bytes_sha256:process.env.YANYURULE_MOCK_FAIL==='1'?'0'.repeat(64):createHash('sha256').update(bytes).digest('hex')}}]};}
 else if(pathname.startsWith('/data/_shared/artifacts/'))return new Response(bytes,{status:200});
 else throw Error('Unexpected mock path '+pathname);
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
};
