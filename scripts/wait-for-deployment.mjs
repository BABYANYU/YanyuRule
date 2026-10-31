const base=new URL(process.env.YANYURULE_PUBLIC_BASE_URL||'https://rule.yanyubaby.eu.org');
if(base.protocol!=='https:'||!(base.hostname==='rule.yanyubaby.eu.org'||base.hostname.endsWith('.pages.dev')))throw Error('Unexpected public site URL');
const expected=process.env.SYNC_REQUEST_ID;
if(!/^[A-Za-z0-9_-]{1,100}$/.test(expected||''))throw Error('Missing sync request ID');
const until=Date.now()+20*60000;
let success=false;
while(Date.now()<until){
 try{
  const url=new URL('/status.json',base);url.searchParams.set('verify',String(Date.now()));
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(r.ok){const status=await r.json();if(status.brand==='YanyuRule'&&status.request_id===expected&&status.scheduler_enabled&&status.counts?.Surge>0&&status.counts?.Mihomo>0){console.log(JSON.stringify({published:true,request_id:expected,last_success:status.last_success,counts:status.counts}));success=true;break;}}
 }catch{/* A failed request cannot count as a successful deployment. */}
 console.log('Waiting for verified Cloudflare deployment: '+expected);
 await new Promise(r=>setTimeout(r,30000));
}
if(!success)throw Error('Requested synchronization did not reach the public site within 20 minutes. The last successful site remains available.');
