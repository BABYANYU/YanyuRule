import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {FILTER_TYPE_BITS,adaptCapability,clientBase} from '../site/clients.mjs';
import {customSubscription} from '../site/core.mjs';
import egern from '../site/modules/egern-rule-filter.mjs';

const own='https://rule.fakeyou.eu.org',id='11111111-1111-4111-8111-111111111111';
const scripts={
 Surge:await readFile(new URL('../site/modules/surge-rule-filter.js',import.meta.url),'utf8'),
 common:await readFile(new URL('../site/modules/client-rule-filter.js',import.meta.url),'utf8'),
};
function capability(client,bits=FILTER_TYPE_BITS[client]){
 return {subscription_filter:{type_bits:{...bits},outputs:[{id:'rule-set',label:'RULE-SET',match:'fallback',types:Object.keys(bits),sources:[{role:'full',when:'all-selected',action:'direct'},{role:'full',when:'any-selected',action:'filter'}]}]}};
}
function subscription(client,selected,{available=Object.keys(FILTER_TYPE_BITS[client]),exclude=''}={}){
 const ext=client==='Egern'?'yaml':'list';
 const result=customSubscription({capability:adaptCapability(client,capability(client)),artifacts:[{key:'rules',role:'full',url:'/rules/'+client+'/'+id+'/rules.'+ext,byte_size:1000}],selected,available,exclude,origin:own});
 assert.equal(result.error,undefined);assert.equal(result.action,'filter');return result.url;
}
async function execute(client,url,body){
 let calls=0,result;
 const expected=clientBase(client,own)+'/rules/'+client+'/'+id+'/rules.'+(client==='Egern'?'yaml':'list');
 const fetchSource=source=>{calls++;assert.equal(source,expected);};
 if(client==='Egern')result=await egern({request:{url,method:'GET'},http:{get:async source=>{fetchSource(source);return {status:200,text:async()=>body};}},respond:r=>r});
 else{
  const sandbox={$request:{url,method:'GET'},$done:r=>{assert.equal(result,undefined,'respond only once');result=r.response||r;}};
  if(client==='QuantumultX')sandbox.$task={fetch:async options=>{fetchSource(options.url);return {statusCode:200,body};}};
  else sandbox.$httpClient={get:(options,cb)=>{fetchSource(options.url);cb(null,{status:200},body);}};
  vm.runInNewContext(scripts[client]||scripts.common,sandbox,{timeout:2000});
  await new Promise(resolve=>setImmediate(resolve));
 }
 return {result,calls};
}
function rules(body){return body.split('\n').filter(line=>line&&!line.startsWith('#'));}

test('capability adaptation rejects unknown or changed bits before publication',()=>{
 for(const client of Object.keys(FILTER_TYPE_BITS)){
  const input=capability(client),before=structuredClone(input),adapted=adaptCapability(client,input);
  assert.deepEqual(input,before,'adaptation must not mutate upstream data');
  assert.deepEqual(adapted.subscription_filter.type_bits,FILTER_TYPE_BITS[client]);
  assert.throws(()=>adaptCapability(client,capability(client,{NEW_TYPE:262144})),/Unsupported filter type or bit/);
  const type=Object.keys(FILTER_TYPE_BITS[client])[0];
  for(const bit of [2,0,-1,'1'])assert.throws(()=>adaptCapability(client,capability(client,{[type]:bit})),/Unsupported filter type or bit/);
  const missing=capability(client);delete missing.subscription_filter.type_bits;
  assert.throws(()=>adaptCapability(client,missing),/Missing filter type bits/);
  const output=capability(client);output.subscription_filter.outputs[0].types.push('NEW_TYPE');
  assert.throws(()=>adaptCapability(client,output),/Undeclared filter output type/);
 }
 for(const client of ['Mihomo','SingBox','Surfboard'])assert.equal(adaptCapability(client,capability('Surge')).subscription_filter,undefined);
 assert.deepEqual(adaptCapability('Loon',{}),{});
});

test('every advertised type bit selects exactly that type in the standalone runtime',async()=>{
 for(const [client,bits]of Object.entries(FILTER_TYPE_BITS)){
  const types=Object.keys(bits);
  const lines=Object.fromEntries(types.map(type=>[type,client==='Egern'?[type+':','  - "'+type+'.test"']:[type+','+type+'.test']]));
  const body=Object.values(lines).flat().join('\n')+'\n';
  for(const type of types){
   const {result,calls}=await execute(client,subscription(client,[type]),body);
   assert.equal(calls,1,client+' '+type);
   assert.equal(result.status,client==='QuantumultX'?'HTTP/1.1 200 OK':200,client+' '+type);
   assert.deepEqual(rules(result.body),lines[type],client+' '+type);
  }
 }
});

test('Loon process-only, mixed and all-selected exclusion subscriptions retain process rules',async()=>{
 const available=['DOMAIN','IP-CIDR','PROCESS-NAME'];
 const body='DOMAIN,keep.test\nDOMAIN,drop.test\nIP-CIDR,10.0.0.0/8,no-resolve\nPROCESS-NAME,keep-process\nPROCESS-NAME,drop-process\n';
 for(const selected of [['PROCESS-NAME'],['DOMAIN','PROCESS-NAME'],available]){
  const exclude=selected===available?'drop*':'';
  const url=subscription('Loon',selected,{available,exclude});
  assert.ok(Number(new URL(url).searchParams.get('c'))&32768);
  const {result}=await execute('Loon',url,body);assert.equal(result.status,200);
  const expected=body.trim().split('\n').filter(line=>selected.includes(line.split(',')[0])&&(!exclude||!line.split(',')[1].startsWith('drop')));
  assert.deepEqual(rules(result.body),expected);
 }
});

test('Egern mixed China-style YAML supports masks 1, 4096 and 4097 through generated links',async()=>{
 const regex='".+\\\\.awsdns-cn-[0-9][0-9]\\\\.(biz|com|net|top)$"';
 const body='no_resolve: true\ndomain_set:\n  - example.test\ndomain_regex_set:\n  - '+regex+'\n  - "^drop.*$"\nip_cidr_set:\n  - 10.0.0.0/8\n';
 for(const [mask,selected]of [[1,['domain_set']],[4096,['domain_regex_set']],[4097,['domain_set','domain_regex_set']]]){
  const url=subscription('Egern',selected);
  assert.equal(new URL(url).searchParams.get('c'),String(mask));
  const {result,calls}=await execute('Egern',url,body);assert.equal(calls,1);assert.equal(result.status,200);
  const expected=[];
  if(mask&1)expected.push('domain_set:','  - example.test');
  if(mask&4096)expected.push('domain_regex_set:','  - '+regex,'  - "^drop.*$"');
  expected.push('no_resolve: true');assert.deepEqual(rules(result.body),expected);
 }
 const url=subscription('Egern',['domain_regex_set'],{exclude:'^drop*'});
 const {result}=await execute('Egern',url,body);assert.equal(result.status,200);
 assert.deepEqual(rules(result.body),['domain_regex_set:','  - '+regex,'no_resolve: true']);
});

test('Egern accepts the complete declared mask but still rejects undeclared bits before fetching',async()=>{
 const types=Object.keys(FILTER_TYPE_BITS.Egern),body=types.map(type=>type+':\n  - "example.test"').join('\n')+'\n';
 const url=subscription('Egern',types,{exclude:'absent*'});
 assert.equal(new URL(url).searchParams.get('c'),'8191');
 const {result,calls}=await execute('Egern',url,body);assert.equal(result.status,200);assert.equal(calls,1);assert.deepEqual(rules(result.body),rules(body));
 for(const [client,unknown]of [['Egern',8192],['Loon',65536]]){
  const selected=[Object.keys(FILTER_TYPE_BITS[client])[0]],valid=subscription(client,selected);
  for(const mask of [0,unknown,unknown|1]){
   const invalid=new URL(valid);invalid.searchParams.set('c',String(mask));
   const {result,calls}=await execute(client,invalid.href,body);
   assert.equal(result.status,400);assert.equal(calls,0);
  }
 }
});
