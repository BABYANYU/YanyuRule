import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {artifactVerification,validArtifactExpectation,sha256} from '../scripts/integrity.mjs';
import {verifiedDownload} from '../scripts/verified-download.mjs';
import {retrySnapshot} from '../scripts/retry-snapshot.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),exec=promisify(execFile),sleep=async()=>{};
const good=Buffer.from('DOMAIN,example.test\n'),expected={mode:'exact',bytes_sha256:sha256(good)};

test('missing/malformed hashes fail closed, exact and semantic upstream formats remain valid',async()=>{
 const invalid=[null,{}, {mode:'exact'}, {...expected,bytes_sha256:''},{...expected,bytes_sha256:'x'.repeat(64)}, {...expected,bytes_sha256:1},{...expected,mode:'unknown'}, {...expected,mode:'standard_header_normalized'}, {...expected,mode:'standard_header_normalized',semantic_sha256:sha256(good),normalized_header_lines:-1}];
 for(const value of invalid){assert.equal(validArtifactExpectation(value),false);assert.equal(artifactVerification(good,value),null);let calls=0;await assert.rejects(verifiedDownload('https://example.test/rules',{expected:value,sleep,fetchImpl:async()=>{calls++;return new Response(good);}}),/INVALID_ARTIFACT_HASH/);assert.equal(calls,0);}
 assert.equal(artifactVerification(good,{...expected,semantic_sha256:null,normalized_header_lines:0,shared:true}),'bytes');
 const upstream={mode:'standard_header_normalized',bytes_sha256:sha256('# UPDATED: old\n'+good),semantic_sha256:sha256(good),normalized_header_lines:1};
 assert.equal(artifactVerification(Buffer.from('# UPDATED: new\n'+good),upstream),'semantic');
 const metadata=await verifiedDownload('https://example.test/index.json',{allowUnverified:true,sleep,fetchImpl:async()=>Response.json({rules:[]})});assert.equal(metadata.verification,'local-only');
});

test('only versioned 404/410 trigger one complete snapshot retry',async()=>{
 for(const status of [404,410]){
  let builds=0,calls=0;
  const result=await retrySnapshot(async()=>{builds++;return verifiedDownload('https://example.test/old_manifest',{expected,versioned:true,sleep,fetchImpl:async()=>{calls++;return builds===1?new Response('gone',{status}):new Response(good);}});},{sleep,log:()=>{}});
  assert.equal(builds,2);assert.equal(calls,5);assert.deepEqual(result.bytes,good);
  builds=0;await assert.rejects(retrySnapshot(async()=>{builds++;return verifiedDownload('https://example.test/old_manifest',{expected,versioned:true,sleep,fetchImpl:async()=>new Response('gone',{status})});},{sleep,log:()=>{}}),e=>e.code==='UPSTREAM_SNAPSHOT_EXPIRED');assert.equal(builds,2);
 }
 for(const [status,versioned] of [[404,false],[410,false],[403,true],[500,true]]){
  let builds=0;await assert.rejects(retrySnapshot(async()=>{builds++;return verifiedDownload('https://example.test/index',{expected,versioned,sleep,fetchImpl:async()=>new Response('bad',{status})});},{sleep,log:()=>{}}),new RegExp('HTTP '+status));assert.equal(builds,1);
 }
});

async function fixture(fn){
 const dir=await mkdtemp('/tmp/yanyurule-safety-');
 try{
  await mkdir(path.join(dir,'site'));await writeFile(path.join(dir,'site/404.html'),'Not found');
  await mkdir(path.join(dir,'scripts'));for(const file of ['check.mjs','integrity.mjs'])await cp(path.join(root,'scripts',file),path.join(dir,'scripts',file));
  for(const file of ['clients.mjs','rule-icons.mjs'])await cp(path.join(root,'site',file),path.join(dir,'site',file));
  await cp(path.join(root,'site/brand-icons'),path.join(dir,'site/brand-icons'),{recursive:true});
  const env={...process.env,NODE_ENV:'test',YANYURULE_GROUP:'a',YANYURULE_TEST_ROOT:dir};delete env.YANYURULE_BASELINE_URL;delete env.YANYURULE_INITIAL_BUILD;
  const hook=path.join(dir,'hook.mjs');await writeFile(hook,`import ${JSON.stringify(pathToFileURL(path.join(root,'tests/mock-network.mjs')).href)};
const fetchOriginal=globalThis.fetch;const snapshots=new Set();
globalThis.fetch=async input=>{
 const u=new URL(input),mode=process.env.SAFETY_CASE;
 if(u.pathname.startsWith('/data/index/'))snapshots.add(u.searchParams.get('_yanyurule_snapshot'));
 const gone=mode?.startsWith('gone-');
 if(gone&&snapshots.size===1&&(mode==='gone-manifest'?u.pathname.endsWith('/manifest.json'):u.pathname.startsWith('/data/_shared/artifacts/')))return new Response('gone',{status:mode==='gone-manifest'?404:410});
 const r=await fetchOriginal(input);
 if(u.pathname.endsWith('/manifest.json')){const m=await r.json();if(mode==='empty')m.artifacts=[];if(mode==='no-hash')for(const a of m.artifacts)delete a.dedupe;return Response.json(m);}
 return r;
};`);
  const run=(extra={},args=[])=>exec(process.execPath,['--import',hook,path.join(root,'scripts/sync.mjs'),...args],{env:{...env,...extra}});
  const check=()=>exec(process.execPath,[path.join(dir,'scripts/check.mjs')],{env});
  await fn({dir,run,check});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('bad rule metadata preserves existing publication and valid rules pass check',async()=>fixture(async({dir,run,check})=>{
 await run();await check();const before=await readFile(path.join(dir,'dist-a/status.json'),'utf8');
 for(const [mode,error] of [['empty',/Empty rule artifacts/],['no-hash',/INVALID_ARTIFACT_HASH/]]){
  await assert.rejects(run({SAFETY_CASE:mode}),e=>error.test(e.stderr));assert.equal(await readFile(path.join(dir,'dist-a/status.json'),'utf8'),before);
 }
}));

test('check rejects empty/missing-hash/corrupt artifacts even with regenerated local integrity',async()=>fixture(async({dir,run,check})=>{
 const dist=path.join(dir,'dist-a'),manifest='/data/rules/Loon/11111111-1111-4111-8111-111111111111/manifest.json';
 for(const [mode,error] of [['empty',/Empty rule artifacts/],['no-hash',/INVALID_ARTIFACT_HASH/],['corrupt',/SHA256_MISMATCH/]]){
  await run();const m=JSON.parse(await readFile(dist+manifest));
  if(mode==='empty')m.artifacts=[];
  if(mode==='no-hash')delete m.artifacts[0].dedupe;
  if(mode==='corrupt')await writeFile(dist+m.artifacts[0].url,'DOMAIN,changed.test\n');
  await writeFile(dist+manifest,JSON.stringify(m));
  const integrity=JSON.parse(await readFile(dist+'/integrity.json'));
  for(const item of integrity){const b=await readFile(dist+item.path);item.bytes=b.length;item.sha256=sha256(b);}
  await writeFile(dist+'/integrity.json',JSON.stringify(integrity));
  await assert.rejects(check(),e=>error.test(e.stderr));
 }
}));

test('production baseline is mandatory except explicit initialization',async()=>fixture(async({dir,run})=>{
 await assert.rejects(run({YANYURULE_INITIAL_BUILD:'0'},['--production']),e=>/Missing production baseline URL/.test(e.stderr));
 await assert.rejects(stat(path.join(dir,'dist-a')),e=>e.code==='ENOENT');
 await run({YANYURULE_INITIAL_BUILD:'1'},['--production']);
 await assert.rejects(run({YANYURULE_INITIAL_BUILD:'0',YANYURULE_BASELINE_URL:'https://yanyurule-data-a.pages.dev/status.json'},['--production']),e=>/Cannot verify last published baseline/.test(e.stderr));
}));

test('versioned manifest 404 and artifact 410 recover through fresh metadata',async()=>{
 for(const mode of ['gone-manifest','gone-artifact'])await fixture(async({run,check})=>{const result=await run({SAFETY_CASE:mode});assert.match(result.stdout,/retrying the complete snapshot/);await check();});
});

test('auxiliary I/O failure after commit warns, keeps success and preserves valid publication',async()=>fixture(async({dir,run,check})=>{
 await run();const before=await readFile(path.join(dir,'dist-a/status.json'),'utf8');
 for(const file of ['sync-report-a.json','.cache/last-success-a.json']){await rm(path.join(dir,file));await mkdir(path.join(dir,file));}
 const result=await run({YANYURULE_MOCK_UPDATED:'1'});assert.match(result.stderr,/SYNC_WARNING: published snapshot retained/);assert.doesNotMatch(result.stderr,/SYNC_FAILED/);
 assert.equal(await readFile(path.join(dir,'dist-a.previous/status.json'),'utf8'),before);
 assert.equal(await readFile(path.join(dir,'dist-a/rules/Loon/11111111-1111-4111-8111-111111111111/rules.list'),'utf8'),'DOMAIN,new.example.test\n');
 await check();await assert.rejects(stat(path.join(dir,'.sync-a.lock')),e=>e.code==='ENOENT');
}));
