import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
test('successful snapshot commits atomically; failed successor leaves it intact',async()=>{
 const parent=path.join(root,'.test-work');await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'sync-'));
 try{
  await mkdir(path.join(dir,'site'));await writeFile(path.join(dir,'site/index.html'),'YanyuRule fixture');
  const args=['--import',pathToFileURL(path.join(root,'tests/mock-network.mjs')).href,path.join(root,'scripts/sync.mjs'),'--no-icons'];
  const env={...process.env,NODE_ENV:'test',YANYURULE_TEST_ROOT:dir};
  const first=await exec(process.execPath,args,{env});assert.match(first.stdout,/"file_count"/);
  const before=await readFile(path.join(dir,'dist/status.json'),'utf8');const artifact=await readFile(path.join(dir,'dist/data/_shared/artifacts/Test_rules_123456789abcdef0.list'),'utf8');assert.equal(artifact,'DOMAIN,example.test\n');
  await assert.rejects(exec(process.execPath,args,{env:{...env,YANYURULE_MOCK_FAIL:'1'}}),e=>/SHA256_MISMATCH/.test(e.stderr));
  assert.equal(await readFile(path.join(dir,'dist/status.json'),'utf8'),before);
  assert.equal(await readFile(path.join(dir,'dist/data/_shared/artifacts/Test_rules_123456789abcdef0.list'),'utf8'),artifact);
  await assert.rejects(stat(path.join(dir,'.sync.lock')),e=>e.code==='ENOENT');
 }finally{await rm(dir,{recursive:true,force:true});}
});
