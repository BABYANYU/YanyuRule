import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url))),port=18761;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.list':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.yaml':'text/plain; charset=utf-8','.sgmodule':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.mrs':'application/octet-stream'};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(s=>s.startsWith('.'))){res.writeHead(400).end('Invalid path');return;}
  const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const s=await stat(f);if(!s.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
  res.end(req.method==='HEAD'?undefined:await readFile(f));
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500).end('File unavailable');}
}).listen(port,'127.0.0.1',()=>console.log('YanyuRule: http://127.0.0.1:'+port));
