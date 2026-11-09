import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {SITE_GROUPS,CLIENTS,clientResource,adaptCapability,moduleInstallURL} from '../site/clients.mjs';
import {customSubscription} from '../site/core.mjs';
import egern,{filterYaml} from '../site/modules/egern-rule-filter.mjs';
const id='11111111-1111-4111-8111-111111111111',own='https://rule.fakeyou.eu.org';
const script=await readFile(new URL('../site/modules/client-rule-filter.js',import.meta.url),'utf8');
test('eight clients have fixed owners and resources cannot escape their group or client',()=>{
 assert.equal(CLIENTS.length,8);assert.deepEqual(SITE_GROUPS.main.clients,['Surge','Mihomo']);
 assert.equal(clientResource('/rules/Loon/'+id+'/rules.list','Loon',own),'https://yanyurule-data-a.pages.dev/rules/Loon/'+id+'/rules.list');
 for(const value of ['https://evil.test/rules/Loon/'+id+'/rules.list',own+'/rules/Loon/'+id+'/rules.list','/rules/Shadowrocket/'+id+'/rules.list','/icons/x.png'])assert.throws(()=>clientResource(value,'Loon',own));
});
test('client-specific filter links preserve source IDs and install handlers',()=>{
 const source={key:'rules',ext:'yaml',byte_size:100,url:'/rules/Egern/'+id+'/rules.yaml'};
 const capability=adaptCapability('Egern',{subscription_filter:{type_bits:{domain_set:1,ip_cidr_set:16},outputs:[{id:'rule-set',match:'fallback',types:['domain_set','ip_cidr_set'],sources:[{role:'full',when:'all-selected',action:'direct'},{role:'full',when:'any-selected',action:'filter'}]}]}});
 const link=customSubscription({capability,artifacts:[source],selected:['domain_set'],available:['domain_set','ip_cidr_set'],origin:own,exclude:'*.invalid'});
 assert.equal(new URL(link.url).pathname,'/Egern/list');assert.equal(new URL(link.url).searchParams.get('s'),id+'/rules.yaml');
 for(const c of ['Loon','QuantumultX','Shadowrocket','Egern'])assert.ok(moduleInstallURL(c,own+'/modules/filter').includes(encodeURIComponent(own+'/modules/filter')));
});
async function run(client,params,body,{status=200,error=false}={}){let output,calls=0;const sandbox={$request:{url:'https://yanyu.rule/'+client+'/list?'+new URLSearchParams({s:id+'/rules.list',c:'3',o:'rule-set',...params}),method:'GET'},$done:r=>{assert.equal(output,undefined);output=r;}};
 if(client==='QuantumultX')sandbox.$task={fetch:async()=>{calls++;if(error)throw Error('offline');return {statusCode:status,body};}};
 else sandbox.$httpClient={get:(options,cb)=>{calls++;assert.ok(options.url.startsWith(SITE_GROUPS.a.origin+'/rules/'+client+'/'));cb(error?Error('offline'):null,{status},body);}};
 vm.runInNewContext(script,sandbox,{timeout:2000});await new Promise(r=>setImmediate(r));return {response:output.response||output,calls};}
test('Loon and Shadowrocket filter types and convert domain output',async()=>{for(const c of ['Loon','Shadowrocket']){const {response}=await run(c,{o:'domain-set',x:'drop.*'},'DOMAIN,keep.test\nDOMAIN-SUFFIX,suffix.test\nDOMAIN,drop.test\nIP-CIDR,1.0.0.0/8\n');assert.equal(response.status,200);assert.match(response.body,/\nkeep.test\n.suffix.test\n/);assert.ok(!response.body.includes('drop.test'));}});
test('Quantumult X uses task response format and preserves policy field',async()=>{const {response}=await run('QuantumultX',{},'HOST,a.test,MyPolicy\nIP-CIDR,1.0.0.0/8,MyPolicy\n');assert.equal(response.status,'HTTP/1.1 200 OK');assert.match(response.body,/HOST,a.test,MyPolicy/);assert.ok(!response.body.includes('IP-CIDR'));});
test('client filters reject traversal, invalid masks and failed sources without fake success',async()=>{assert.equal((await run('Loon',{s:'../x.list'},'')).calls,0);assert.equal((await run('Shadowrocket',{c:'0'},'')).response.status,400);assert.equal((await run('Loon',{},'<html>failure</html>')).response.status,502);assert.equal((await run('Loon',{},'DOMAIN,a.test',{status:404})).response.status,502);});
test('Egern flat YAML filter preserves quoting and no_resolve semantics',()=>{const body='# source\ndomain_set:\n  - example.test\n  - "drop.test"\nip_cidr_set:\n  - 1.0.0.0/8\nno_resolve: true\n';assert.match(filterYaml(body,1,false,'drop.*'),/domain_set:\n  - example.test\nno_resolve: true/);assert.ok(!filterYaml(body,16,true).includes('no_resolve'));assert.throws(()=>filterYaml(body,1,false,'*'),/No rules/);assert.throws(()=>filterYaml('rules:\n - invalid',1),/Unsupported/);});
test('Egern runtime only fetches pinned data and returns failures as errors',async()=>{let calls=0;const ctx={request:{url:'https://yanyu.rule/Egern/list?'+new URLSearchParams({s:id+'/rules.yaml',c:'1',o:'rule-set'}),method:'GET'},http:{get:async url=>{calls++;assert.ok(url.startsWith(SITE_GROUPS.b.origin));return {status:200,text:async()=> 'domain_set:\n  - example.test\n'};}},respond:r=>r};assert.equal((await egern(ctx)).status,200);ctx.request.url+='&s=../invalid';assert.equal((await egern(ctx)).status,400);assert.equal(calls,1);});
