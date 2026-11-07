import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
test('static data groups build separately with CORS and preserve previous group after failure',async()=>{
 const parent=path.join(root,'.test-work');await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'groups-'));
 try{await mkdir(path.join(dir,'site'));await writeFile(path.join(dir,'site/index.html'),'YanyuRule fixture');await writeFile(path.join(dir,'site/404.html'),'Not found');const args=['--import',pathToFileURL(path.join(root,'tests/mock-network.mjs')).href,path.join(root,'scripts/sync.mjs')];
  const env={...process.env,NODE_ENV:'test',YANYURULE_GROUP:'main',YANYURULE_TEST_ROOT:dir};await exec(process.execPath,args,{env:{...env,YANYURULE_GROUP:'a'}});await exec(process.execPath,args,{env:{...env,YANYURULE_GROUP:'b'}});
  const before=await readFile(path.join(dir,'dist-a/status.json'),'utf8');assert.deepEqual(Object.keys(JSON.parse(before).counts),['Loon','QuantumultX','Shadowrocket']);assert.ok((await readFile(path.join(dir,'dist-b/_headers'),'utf8')).includes('Access-Control-Allow-Origin: *'));
  await assert.rejects(exec(process.execPath,args,{env:{...env,YANYURULE_GROUP:'b',YANYURULE_MOCK_UPDATED:'1',YANYURULE_MOCK_FAIL:'1'}}),e=>/SHA256_MISMATCH/.test(e.stderr));assert.equal(await readFile(path.join(dir,'dist-a/status.json'),'utf8'),before);await assert.rejects(stat(path.join(dir,'dist')),e=>e.code==='ENOENT');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('successful snapshot commits atomically; failed successor leaves it intact',async()=>{
 const parent=path.join(root,'.test-work');await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'sync-'));
 try{
  await mkdir(path.join(dir,'site'));await writeFile(path.join(dir,'site/index.html'),'YanyuRule fixture');
  const args=['--import',pathToFileURL(path.join(root,'tests/mock-network.mjs')).href,path.join(root,'scripts/sync.mjs'),'--no-icons'];
  const env={...process.env,NODE_ENV:'test',YANYURULE_GROUP:'main',YANYURULE_TEST_ROOT:dir};
  const first=await exec(process.execPath,args,{env:{...env,YANYURULE_MOCK_STALE:'1'}});assert.match(first.stdout,/"file_count"/);assert.match(first.stdout,/Retry 1\/3 with fresh upstream cache: SHA256_MISMATCH/);
  const publicPath=path.join(dir,'dist/rules/Surge/11111111-1111-4111-8111-111111111111/rules.list');
  assert.equal(await readFile(publicPath,'utf8'),'DOMAIN,example.test\n');
  const oldIndex=JSON.parse(await readFile(path.join(dir,'dist/data/index/Surge.json'),'utf8'));
  const transitioned=await exec(process.execPath,args,{env:{...env,YANYURULE_MOCK_UPDATED:'1',YANYURULE_MOCK_TRANSITION:'1'}});assert.match(transitioned.stdout,/retrying the complete snapshot with fresh metadata/);
  const newIndex=JSON.parse(await readFile(path.join(dir,'dist/data/index/Surge.json'),'utf8'));
  assert.equal(oldIndex.rules[0].manifest,newIndex.rules[0].manifest,'manifest URL stays stable across upstream hash changes');
  const before=await readFile(path.join(dir,'dist/status.json'),'utf8'),artifact=await readFile(publicPath,'utf8');assert.equal(artifact,'DOMAIN,new.example.test\n');
  await assert.rejects(exec(process.execPath,args,{env:{...env,YANYURULE_MOCK_UPDATED:'1',YANYURULE_MOCK_FAIL:'1'}}),e=>/SHA256_MISMATCH/.test(e.stderr));
  assert.equal(await readFile(path.join(dir,'dist/status.json'),'utf8'),before);
  assert.equal(await readFile(publicPath,'utf8'),artifact);
  await assert.rejects(exec(process.execPath,[...args,'--production'],{env:{...env,YANYURULE_BASELINE_URL:'https://yanyurule.pages.dev/status.json',YANYURULE_INITIAL_BUILD:'0'}}),e=>/Cannot verify last published baseline/.test(e.stderr));
  assert.equal(await readFile(path.join(dir,'dist/status.json'),'utf8'),before,'unavailable production baseline cannot replace the live snapshot');
  await assert.rejects(stat(path.join(dir,'.sync.lock')),e=>e.code==='ENOENT');
 }finally{await rm(dir,{recursive:true,force:true});}
});
