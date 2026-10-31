import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../site/modules/surge-rule-filter.js',import.meta.url),'utf8');
function run(params,body,{status=200,error=null}={}){let result,calls=0,url;const request='https://yanyu.rule/list?'+new URLSearchParams(params);const sandbox={$request:{url:request,method:'GET'},$httpClient:{get:(options,cb)=>{calls++;url=options.url;cb(error,{status},body);}},$done:r=>{assert.equal(result,undefined,'done called once');result=r;}};vm.runInNewContext(source,sandbox,{timeout:2000});return {response:result.response,calls,url};}
const params={s:'Test_rules_1234.list',c:'3',o:'domain-set'};
const body='# NAME: Test\nDOMAIN,exact.example\nDOMAIN-SUFFIX,suffix.example\nIP-CIDR,10.0.0.0/8,no-resolve\n';
test('Surge module converts exact and suffix domains',()=>{const r=run(params,body);assert.equal(r.response.status,200);assert.match(r.response.body,/\nexact\.example\n\.suffix\.example\n/);assert.equal(r.url,'https://rule.yanyubaby.eu.org/data/_shared/artifacts/Test_rules_1234.list');});
test('wildcards exclude only matching values',()=>{const r=run({...params,x:'*suffix.?xample'},body);assert.equal(r.response.status,200);assert.ok(!r.response.body.includes('.suffix.example'));assert.ok(r.response.body.includes('exact.example'));});
test('remove no-resolve only when requested',()=>{const r=run({...params,c:'32',o:'rule-set',n:'1'},body);assert.equal(r.response.status,200);assert.match(r.response.body,/IP-CIDR,10\.0\.0\.0\/8\n/);assert.ok(!r.response.body.includes('no-resolve'));});
test('reject traversal and arbitrary upstream injection before HTTP',()=>{for(const s of ['../secret.list','https://evil.test/x.list','a.list?key=value']){const r=run({...params,s},body);assert.equal(r.response.status,400);assert.equal(r.calls,0);}});
test('source errors do not masquerade as valid empty rules',()=>{assert.equal(run(params,body,{status:404}).response.status,502);assert.equal(run(params,'<html>failure</html>').response.status,502);assert.equal(run(params,'# comments only').response.status,502);assert.equal(run(params,'x'.repeat(1048577)).response.status,502);});
test('empty selections and unsafe output types are rejected',()=>{assert.equal(run({...params,c:'0'},body).response.status,400);assert.equal(run({...params,o:'html'},body).response.status,400);});
