import {SITE_GROUPS} from '../site/clients.mjs';
const base=new URL(process.env.YANYURULE_PUBLIC_BASE_URL||'https://rule.fakeyou.eu.org');
if(base.protocol!=='https:'||base.hostname!=='rule.fakeyou.eu.org'&&base.origin!==SITE_GROUPS.main.origin)throw Error('Unexpected public site URL');
const expected=process.env.SYNC_REQUEST_ID;
if(!/^[A-Za-z0-9_-]{1,100}$/.test(expected||''))throw Error('Missing sync request ID');
const until=Date.now()+20*60000;let success=false;
while(Date.now()<until){
 const results=await Promise.all(Object.entries(SITE_GROUPS).map(async([group,config])=>{
  try{const url=new URL('/status.json',group==='main'?base:config.origin);url.searchParams.set('verify',String(Date.now()));const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)return {group,ok:false,error:'HTTP '+r.status};const status=await r.json();return {group,ok:status.brand==='YanyuRule'&&(status.group||'main')===group&&status.request_id===expected&&status.scheduler_enabled&&config.clients.every(c=>status.counts?.[c]>0),published_request_id:status.request_id,last_success:status.last_success,counts:status.counts};}catch(error){return {group,ok:false,error:error.message};}
 }));
 if(results.every(r=>r.ok)){console.log(JSON.stringify({published:true,request_id:expected,groups:results}));success=true;break;}
 console.log(JSON.stringify({waiting:true,request_id:expected,groups:results}));
 await new Promise(r=>setTimeout(r,30000));
}
if(!success)throw Error('Requested synchronization did not reach all three static projects within 20 minutes. Each group keeps its last successful deployment.');
