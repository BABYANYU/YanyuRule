import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,stat,rm,rename,cp,open,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {artifactVerification} from './integrity.mjs';
import {verifiedDownload} from './verified-download.mjs';
import {versionFrontend} from './frontend-assets.mjs';
import {SITE_GROUPS,adaptCapability} from '../site/clients.mjs';
const ROOT=process.env.NODE_ENV==='test'&&process.env.YANYURULE_TEST_ROOT?path.resolve(process.env.YANYURULE_TEST_ROOT):fileURLToPath(new URL('../',import.meta.url));
const SOURCE='https://magicrule.pages.dev';
const ALLOWED_ORIGINS=new Set([SOURCE,'https://rule-26r.pages.dev']);
const GROUP=process.env.YANYURULE_GROUP||'main';
if(!SITE_GROUPS[GROUP])throw Error('Unknown deployment group');
const CLIENTS=SITE_GROUPS[GROUP].clients;
const MAX=25*1024*1024;
const args=new Set(process.argv.slice(2));
const withIcons=GROUP==='main'&&!args.has('--no-icons');
const OUT=path.join(ROOT,GROUP==='main'?'.staging':'.staging-'+GROUP),DIST=path.join(ROOT,GROUP==='main'?'dist':'dist-'+GROUP),CACHE=path.join(ROOT,'.cache');
const hash=x=>createHash('sha256').update(x).digest('hex');
const usedCache=new Set();
const log=x=>console.log(new Date().toISOString(),x);
let completed=0,downloaded=0,cacheHits=0,networkBytes=0;
let normalizedHeaders=0;
function verified(bytes,expected){
 const mode=artifactVerification(bytes,expected);if(mode==='semantic')normalizedHeaders++;return Boolean(mode);
}
function sourceURL(value){const u=new URL(value,SOURCE);if(!ALLOWED_ORIGINS.has(u.origin)||u.username||u.password||u.search||u.hash)throw Error('Unexpected upstream URL: '+value);return u;}
function localPath(value){const u=sourceURL(value);const p=decodeURIComponent(u.pathname);if(p.includes('\\')||p.includes('\0')||p.split('/').some(x=>x==='..'||x==='.')||!p.startsWith('/'))throw Error('Unsafe file path');return p;}
async function put(p,bytes){const f=path.join(OUT,p.replace(/^\//,''));await mkdir(path.dirname(f),{recursive:true});await writeFile(f,bytes);}
async function request(value,{immutable=false,expected=null}={}){
 const u=sourceURL(value),key=hash(u.href),bodyFile=path.join(CACHE,key+'.bin'),metaFile=path.join(CACHE,key+'.json');
 usedCache.add(key);
 let meta=null,cached=null;
 try{meta=JSON.parse(await readFile(metaFile,'utf8'));cached=await readFile(bodyFile);if(hash(cached)!==meta.sha256)throw Error('Cache integrity');}catch{meta=null;cached=null;}
 if(immutable&&cached&&verified(cached,expected)){cacheHits++;return cached;}
 const headers={'User-Agent':'YanyuRule-Sync/1.0 (daily static mirror)'};
 if(meta?.etag&&cached)headers['If-None-Match']=meta.etag;
 else if(meta?.lastModified&&cached)headers['If-Modified-Since']=meta.lastModified;
 const result=await verifiedDownload(u,{headers,expected,cached,maxBytes:MAX,onRetry:({attempt,error})=>log(`Retry ${attempt}/3 with fresh upstream cache: ${error}`)});
 if(result.verification==='semantic')normalizedHeaders++;
 if(result.notModified){cacheHits++;return result.bytes;}
 const {bytes,etag,lastModified}=result;
 await writeFile(bodyFile,bytes);await writeFile(metaFile,JSON.stringify({sha256:hash(bytes),etag,lastModified}));
 downloaded++;networkBytes+=bytes.length;return bytes;
}
async function json(value){const bytes=await request(value);try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error('Invalid JSON '+value);}}
async function parallel(items,fn,label){let pos=0,done=0;let failed=null;const start=Date.now();await Promise.all(Array.from({length:4},async()=>{while(pos<items.length&&!failed){const item=items[pos++];try{await fn(item);done++;completed++;if(done%100===0||done===items.length)log(`${label}: ${done}/${items.length}, ${Math.round((Date.now()-start)/1000)}s`);}catch(e){failed=e;}}}));if(failed)throw failed;}
async function files(root){const out=[];for(const ent of await readdir(root,{withFileTypes:true})){const full=path.join(root,ent.name);if(ent.isDirectory())out.push(...await files(full));else out.push(full);}return out;}
async function saveJSON(p,value){await put(p,JSON.stringify(value));}
async function main(){
 const lockPath=path.join(ROOT,GROUP==='main'?'.sync.lock':'.sync-'+GROUP+'.lock');const lock=await open(lockPath,'wx');
 try{
  await mkdir(CACHE,{recursive:true});await rm(OUT,{recursive:true,force:true});await mkdir(OUT,{recursive:true});
  const capabilities=await json('/data/meta/capabilities.json');
  const indexes={};const jobs=[];
  let previous=null;try{previous=JSON.parse(await readFile(path.join(DIST,'status.json'),'utf8'));}catch{try{previous=JSON.parse(await readFile(path.join(CACHE,'last-success-'+GROUP+'.json'),'utf8'));}catch{}}
  if(args.has('--production')&&process.env.YANYURULE_BASELINE_URL){
   const baseline=new URL(process.env.YANYURULE_BASELINE_URL);
   if(baseline.protocol!=='https:'||baseline.pathname!=='/status.json'||!(baseline.origin===SITE_GROUPS[GROUP].origin||GROUP==='main'&&baseline.hostname==='rule.yanyubaby.eu.org'))throw Error('Invalid production baseline URL');
   try{
    const r=await fetch(baseline,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);
    const value=await r.json();if(value.brand!=='YanyuRule'||(value.group||'main')!==GROUP||!CLIENTS.every(c=>Number.isSafeInteger(value.counts?.[c])&&value.counts[c]>0))throw Error('Invalid published baseline');
    previous=value;
   }catch(e){if(process.env.YANYURULE_INITIAL_BUILD!=='1')throw Error('Cannot verify last published baseline: '+e.message);}
  }
  for(const client of CLIENTS){
   const index=await json('/data/index/'+client+'.json');
   if(!Array.isArray(index.rules)||index.rules.length<1)throw Error('Empty rule index '+client);
   if(previous?.counts?.[client]&&index.rules.length<previous.counts[client]*.8&&!args.has('--allow-large-removal'))throw Error('Rule count fell over 20%; manual review needed '+client);
   const seen=new Set();for(const r of index.rules){if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(r.id)||!r.name||!r.manifest||seen.has(r.id))throw Error('Invalid/duplicate rule in '+client);seen.add(r.id);const p=localPath(r.manifest);if(!new RegExp('^/data/rules/'+client+'/[a-f0-9]{24}/manifest\\.json$').test(p))throw Error('Unexpected manifest path');const outputPath='/data/rules/'+client+'/'+r.id+'/manifest.json';jobs.push({client,rule:r,manifest:r.manifest,path:p,outputPath});r.manifest=outputPath;delete r.icon_url;}
   indexes[client]=index;
  }
  log('Index entries: '+jobs.length);
  const artifacts=new Map();
  await parallel(jobs,async j=>{
   const m=await json(j.manifest);
   if(m.client!==j.client||m.rule!==j.rule.name||!Array.isArray(m.artifacts))throw Error('Manifest identity mismatch '+j.path);
   const keys=new Set();
   for(const a of m.artifacts){const upstream=a.url;const p=localPath(upstream);if(!p.startsWith('/data/_shared/artifacts/')&&!p.startsWith('/data/rules/'))throw Error('Unexpected artifact path '+p);if(!/^[A-Za-z0-9_-]{1,80}$/.test(a.key)||!(/^[A-Za-z0-9]{1,8}$/).test(a.ext)||keys.has(a.key+'.'+a.ext))throw Error('Invalid or duplicate artifact key');keys.add(a.key+'.'+a.ext);const expected=a.dedupe||null;const existing=artifacts.get(p);if(existing?.expected&&expected&&(existing.expected.semantic_sha256||existing.expected.bytes_sha256)!==(expected.semantic_sha256||expected.bytes_sha256))throw Error('Conflicting artifact hash '+p);const destinations=existing?.destinations||new Set();const stable='/rules/'+j.client+'/'+j.rule.id+'/'+a.key+'.'+a.ext;destinations.add(stable);artifacts.set(p,{upstream,path:p,destinations,expected:expected||existing?.expected});a.url=stable;}
   j.outputManifest=m;
   await saveJSON(j.outputPath,m);
  },'Manifests');
  log('Unique artifacts: '+artifacts.size);
  await parallel([...artifacts.values()],async a=>{const bytes=await request(a.upstream,{immutable:/_[a-f0-9]{16,}\./i.test(a.path),expected:a.expected});for(const destination of a.destinations)await put(destination,bytes);},'Artifacts');
  for(const j of jobs){for(const a of j.outputManifest.artifacts)a.byte_size=(await stat(path.join(OUT,a.url.slice(1)))).size;await saveJSON(j.outputPath,j.outputManifest);}
  let iconCount=0;
  if(withIcons){
   const config=await json('/data/meta/config.json');const catalog=await json(config.icon_catalog_url);
   if(!Array.isArray(catalog.icons)||catalog.icons.length===0)throw Error('Empty icon catalog');
   const iconJobs=new Map();for(const icon of catalog.icons){const u=sourceURL(icon.url);const name=path.posix.basename(u.pathname);if(!/^[a-zA-Z0-9._-]+$/.test(name))throw Error('Invalid icon name');const p='/icons/assets/'+name;iconJobs.set(p,{upstream:u.href,path:p});icon.url=p;}
   await parallel([...iconJobs.values()],async a=>{await put(a.path,await request(a.upstream,{immutable:true}));},'Icons');
   await saveJSON('/icons/catalog.json',catalog);await saveJSON('/icons/sources.json',await json(config.icon_sources_url));iconCount=catalog.icons.length;
  }
  const caps={};for(const client of CLIENTS){if(!capabilities.capabilities[client])throw Error('Missing capabilities '+client);caps[client]=adaptCapability(client,capabilities.capabilities[client]);}
  await saveJSON('/data/meta/capabilities.json',{generated_at:capabilities.generated_at,capabilities:caps});
  for(const client of CLIENTS)await saveJSON('/data/index/'+client+'.json',indexes[client]);
  if(GROUP==='main'){await cp(path.join(ROOT,'site'),OUT,{recursive:true});await versionFrontend(OUT);}
  else{await put('/index.html','<!doctype html><meta charset="utf-8"><title>YanyuRule data</title><a href="https://rule.yanyubaby.eu.org/">YanyuRule 规则库</a>');await cp(path.join(ROOT,'site/404.html'),path.join(OUT,'404.html'));await put('/_headers','/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=300, must-revalidate\n\n/status.json\n  Cache-Control: no-cache\n');}
  const publicFiles=await files(OUT);if(publicFiles.length>20000)throw Error('PAGES_FILE_LIMIT '+publicFiles.length);
  let totalBytes=0,maxFileBytes=0;const integrity=[];
  for(const f of publicFiles){const bytes=await readFile(f);if(bytes.length>MAX)throw Error('PAGES_SIZE_LIMIT '+path.relative(OUT,f));totalBytes+=bytes.length;maxFileBytes=Math.max(maxFileBytes,bytes.length);integrity.push({path:'/'+path.relative(OUT,f).split(path.sep).join('/'),bytes:bytes.length,sha256:hash(bytes)});}
  const production=args.has('--production');
  let requestId=null;try{requestId=JSON.parse(await readFile(path.join(ROOT,'.sync-request.json'),'utf8')).id||null;}catch{}
  const now=new Date().toISOString();const status={version:1,brand:'YanyuRule',group:GROUP,source:SOURCE,last_success:now,interval_hours:24,scheduler_enabled:production&&process.env.YANYURULE_SCHEDULER_ENABLED==='true',request_id:requestId,counts:Object.fromEntries(CLIENTS.map(c=>[c,indexes[c].rules.length])),upstream_generated_at:Object.fromEntries(CLIENTS.map(c=>[c,indexes[c].generated_at])),artifact_count:artifacts.size,icon_count:iconCount,file_count:publicFiles.length+2,total_bytes:totalBytes,max_file_bytes:maxFileBytes,content_sha256:hash(JSON.stringify(integrity)),deployment:production?'production':'local'};
  if(status.file_count>20000)throw Error('PAGES_FILE_LIMIT '+status.file_count);
  await saveJSON('/integrity.json',integrity);await saveJSON('/status.json',status);
  const previousDir=DIST+'.previous';await rm(previousDir,{recursive:true,force:true});
  let hadPrevious=false;try{await stat(DIST);await rename(DIST,previousDir);hadPrevious=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(OUT,DIST);}catch(e){if(hadPrevious)await rename(previousDir,DIST);throw e;}
  await writeFile(path.join(CACHE,'last-success-'+GROUP+'.json'),JSON.stringify(status));
  // Cache is shared by independently built groups; never prune another group's cache.
  const report={...status,downloaded,cache_hits:cacheHits,network_bytes:networkBytes,normalized_headers:normalizedHeaders};await writeFile(path.join(ROOT,GROUP==='main'?'sync-report.json':'sync-report-'+GROUP+'.json'),JSON.stringify(report,null,2));log(JSON.stringify(report));
 }finally{await lock.close();await rm(lockPath,{force:true});}
}
main().catch(e=>{console.error('SYNC_FAILED:',e.message);process.exitCode=1;});
