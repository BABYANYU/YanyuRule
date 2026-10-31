import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export async function versionFrontend(root){
 const index=path.join(root,'index.html');let html=await readFile(index,'utf8');const assets={};
 for(const name of ['app.js','style.css']){
  const pattern=new RegExp('/'+name.replace('.','\\.')+'(?:\\?[^"\u0027\\s<>]*)?','g');
  if(!pattern.test(html))continue;pattern.lastIndex=0;
  const bytes=await readFile(path.join(root,name)),digest=createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const ext=path.extname(name),destination='/assets/'+path.basename(name,ext)+'.'+digest+ext;
  await mkdir(path.join(root,'assets'),{recursive:true});await writeFile(path.join(root,destination.slice(1)),bytes);
  html=html.replace(pattern,destination);assets[name]=destination;
 }
 if(Object.keys(assets).length)await writeFile(index,html);
 return assets;
}
