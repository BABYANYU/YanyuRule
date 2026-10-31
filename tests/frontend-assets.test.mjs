import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {versionFrontend} from '../scripts/frontend-assets.mjs';
const parent=fileURLToPath(new URL('../.test-work/',import.meta.url));
test('content-versioned assets change only when bytes change and preserve root module imports',async()=>{
 await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'frontend-'));
 try{
  const html='<link href="/style.css?v=old"><script type="module" src="/app.js?v=old"></script>';
  const app="import '/core.mjs';\nconsole.log('one');";
  await writeFile(path.join(dir,'index.html'),html);await writeFile(path.join(dir,'app.js'),app);await writeFile(path.join(dir,'style.css'),'body{color:black}');
  const first=await versionFrontend(dir);assert.match(first['app.js'],/^\/assets\/app\.[a-f0-9]{16}\.js$/);
  assert.equal(await readFile(path.join(dir,first['app.js'].slice(1)),'utf8'),app);
  assert.ok((await readFile(path.join(dir,'index.html'),'utf8')).includes(first['style.css']));
  await writeFile(path.join(dir,'index.html'),html);const identical=await versionFrontend(dir);assert.deepEqual(identical,first);
  await writeFile(path.join(dir,'index.html'),html);await writeFile(path.join(dir,'app.js'),"import '/core.mjs';\nconsole.log('two');");const second=await versionFrontend(dir);
  assert.notEqual(second['app.js'],first['app.js']);assert.equal(second['style.css'],first['style.css']);
 }finally{assert.ok(dir.startsWith(path.resolve(parent)+path.sep));await rm(dir,{recursive:true,force:true});}
});
test('pages without frontend references stay unchanged and missing referenced assets fail',async()=>{
 await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'frontend-'));
 try{await writeFile(path.join(dir,'index.html'),'YanyuRule fixture');assert.deepEqual(await versionFrontend(dir),{});await writeFile(path.join(dir,'index.html'),'<script src="/app.js"></script>');await assert.rejects(()=>versionFrontend(dir),/ENOENT/);}
 finally{assert.ok(dir.startsWith(path.resolve(parent)+path.sep));await rm(dir,{recursive:true,force:true});}
});
