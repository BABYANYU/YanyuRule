export const SITE_GROUPS={
 main:{project:'yanyurule',origin:'https://yanyurule.pages.dev',clients:['Surge','Mihomo']},
 a:{project:'yanyurule-data-a',origin:'https://yanyurule-data-a.pages.dev',clients:['Loon','QuantumultX','Shadowrocket']},
 b:{project:'yanyurule-data-b',origin:'https://yanyurule-data-b.pages.dev',clients:['Egern','SingBox','Surfboard']},
};
export const CLIENTS=Object.values(SITE_GROUPS).flatMap(g=>g.clients);
export function groupForClient(client){const entry=Object.entries(SITE_GROUPS).find(([,g])=>g.clients.includes(client));if(!entry)throw Error('Unknown client');return entry[0];}
export function clientBase(client,origin){const group=groupForClient(client);return group==='main'?origin:SITE_GROUPS[group].origin;}
export function adaptCapability(client,capability){
 const cap=JSON.parse(JSON.stringify(capability));if(!cap.subscription_filter)return cap;
 const extensions={Surge:'sgmodule',Loon:'plugin',QuantumultX:'snippet',Shadowrocket:'sgmodule',Egern:'yaml'};
 if(!extensions[client]){delete cap.subscription_filter;return cap;}
 const filter=cap.subscription_filter,slug=client.toLowerCase();filter.profile=client;
 filter.script_path=client==='Surge'?'/modules/surge-rule-filter.js':client==='Egern'?'/modules/egern-rule-filter.mjs':'/modules/client-rule-filter.js';
 filter.install_path='/modules/'+slug+'-rule-filter.'+extensions[client];filter.request_url='https://yanyu.rule/'+(client==='Surge'?'':client+'/')+'list';
 return cap;
}
export function moduleInstallURL(client,url){
 if(client==='Surge')return 'surge:///install-module?url='+encodeURIComponent(url);
 if(client==='Loon')return 'https://www.nsloon.com/openloon/import?plugin='+encodeURIComponent(url);
 if(client==='Shadowrocket')return 'shadowrocket://install?module='+encodeURIComponent(url);
 if(client==='Egern')return 'https://egernapp.com/modules/new?name=YanyuRule%20Rule%20Filter&url='+encodeURIComponent(url);
 if(client==='QuantumultX')return 'https://quantumult.app/x/open-app/add-resource?remote-resource='+encodeURIComponent(JSON.stringify({rewrite_remote:[url+', tag=YanyuRule Rule Filter']}));
 throw Error('Client has no filter module');
}
export function clientResource(value,client,origin){
 const base=clientBase(client,origin),url=new URL(value,base),own=new URL(origin).origin;
 if(url.username||url.password||url.protocol!=='https:'&&url.origin!==own)throw Error('Invalid resource URL');
 if(url.origin!==new URL(base).origin)throw Error('Untrusted resource origin');
 if(!url.pathname.startsWith('/rules/'+client+'/')&&!url.pathname.startsWith('/data/rules/'+client+'/'))throw Error('Invalid client resource path');
 if(url.pathname.includes('\\')||url.pathname.split('/').some(v=>{try{return decodeURIComponent(v)==='..';}catch{return true;}}))throw Error('Invalid resource path');
 return url.href;
}
