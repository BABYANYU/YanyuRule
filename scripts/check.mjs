import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function json(p){return JSON.parse(await readFile(path.join(root,p),'utf8'));}
async function exists(p){if(typeof p!=='string'||!p.startsWith('/')||p.includes('..')||p.includes('\\'))throw Error('Invalid local path '+p);const s=await stat(path.join(root,p.slice(1)));if(!s.isFile())throw Error('Not a file '+p);}
async function main(){
 const status=await json('status.json'),integrity=await json('integrity.json');
 const counts={};let manifestCount=0,artifactRefs=0;const paths=new Set();let bytes=0,max=0;
 for(const item of integrity){if(paths.has(item.path))throw Error('Duplicate integrity path');paths.add(item.path);const b=await readFile(path.join(root,item.path.slice(1)));if(b.length!==item.bytes||sha(b)!==item.sha256)throw Error('Integrity mismatch '+item.path);if(b.length>25*1024*1024)throw Error('File exceeds Pages limit');bytes+=b.length;max=Math.max(max,b.length);}
 for(const client of ['Surge','Mihomo']){const index=await json('data/index/'+client+'.json');counts[client]=index.rules.length;const ids=new Set();for(const rule of index.rules){if(ids.has(rule.id))throw Error('Duplicate rule ID');ids.add(rule.id);await exists(rule.manifest);const m=await json(rule.manifest.slice(1));if(m.client!==client||m.rule!==rule.name)throw Error('Manifest identity mismatch');manifestCount++;for(const a of m.artifacts){await exists(a.url);artifactRefs++;if(a.byte_size!==undefined&&a.byte_size!==(await stat(path.join(root,a.url.slice(1)))).size)throw Error('Artifact size mismatch');}}}
 if(status.icon_count){const icons=await json('icons/catalog.json');if(icons.icons.length!==status.icon_count)throw Error('Icon count mismatch');for(const i of icons.icons)await exists(i.url);}
 if(JSON.stringify(counts)!==JSON.stringify(status.counts))throw Error('Counts differ');
 if(integrity.length+2>20000||status.file_count!==integrity.length+2)throw Error('Pages file limit/count mismatch');
 if(sha(JSON.stringify(integrity))!==status.content_sha256)throw Error('Integrity manifest differs from status');
 if(max!==status.max_file_bytes||bytes!==status.total_bytes)throw Error('Size totals differ');
 const html=await readFile(path.join(root,'index.html'),'utf8');if(!html.includes('YanyuRule')||html.includes('data.js'))throw Error('Stale frontend');
 console.log(JSON.stringify({ok:true,counts,manifests:manifestCount,artifact_references:artifactRefs,unique_artifacts:status.artifact_count,icons:status.icon_count,files:status.file_count,total_mib:Math.round(bytes/1048576*10)/10,max_file_mib:Math.round(max/1048576*100)/100}));
}
main().catch(e=>{console.error('CHECK_FAILED:',e.message);process.exitCode=1;});
