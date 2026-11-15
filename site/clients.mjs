export const SITE_GROUPS={
 main:{project:'yanyurule',origin:'https://yanyurule.pages.dev',clients:['Surge','Mihomo']},
 a:{project:'yanyurule-data-a',origin:'https://yanyurule-data-a.pages.dev',clients:['Loon','QuantumultX','Shadowrocket']},
 b:{project:'yanyurule-data-b',origin:'https://yanyurule-data-b.pages.dev',clients:['Egern','SingBox','Surfboard']},
};
export const CLIENTS=Object.values(SITE_GROUPS).flatMap(g=>g.clients);
export function groupForClient(client){const entry=Object.entries(SITE_GROUPS).find(([,g])=>g.clients.includes(client));if(!entry)throw Error('Unknown client');return entry[0];}
export function clientBase(client,origin){const group=groupForClient(client);return group==='main'?origin:SITE_GROUPS[group].origin;}
// Standalone client scripts cannot import this table. Regression tests execute every
// declared bit against those scripts so this publication contract cannot drift.
const surgeBits={DOMAIN:1,'DOMAIN-SUFFIX':2,'DOMAIN-KEYWORD':4,'USER-AGENT':8,'URL-REGEX':16,'IP-CIDR':32,'IP-CIDR6':64,GEOIP:128,'IP-ASN':256,'DEST-PORT':512,PROTOCOL:1024,'PROCESS-NAME':2048,'IN-PORT':4096,'SRC-IP':8192,AND:32768,OR:65536,NOT:131072};
export const FILTER_TYPE_BITS=Object.freeze(Object.fromEntries(Object.entries({
 Surge:surgeBits,
 Loon:{DOMAIN:1,'DOMAIN-SUFFIX':2,'DOMAIN-KEYWORD':4,'USER-AGENT':8,'URL-REGEX':16,'IP-CIDR':32,'IP-CIDR6':64,GEOIP:128,'IP-ASN':256,'SRC-PORT':512,'DEST-PORT':1024,PROTOCOL:2048,AND:4096,OR:8192,NOT:16384,'PROCESS-NAME':32768},
 QuantumultX:{HOST:1,'HOST-SUFFIX':2,'HOST-WILDCARD':4,'HOST-KEYWORD':8,'USER-AGENT':16,'URL-REGEX':32,'IP-CIDR':64,'IP6-CIDR':128,GEOIP:256,'IP-ASN':512},
 Shadowrocket:{...surgeBits},
 Egern:{domain_set:1,domain_suffix_set:2,domain_keyword_set:4,domain_wildcard_set:8,ip_cidr_set:16,ip_cidr6_set:32,asn_set:64,url_regex_set:128,user_agent_set:256,dest_port_set:512,geoip_set:1024,protocol_set:2048,domain_regex_set:4096},
}).map(([client,bits])=>[client,Object.freeze(bits)])));
export function adaptCapability(client,capability){
 const cap=JSON.parse(JSON.stringify(capability));if(!cap.subscription_filter)return cap;
 const extensions={Surge:'sgmodule',Loon:'plugin',QuantumultX:'snippet',Shadowrocket:'sgmodule',Egern:'yaml'};
 if(!extensions[client]){delete cap.subscription_filter;return cap;}
 const filter=cap.subscription_filter,slug=client.toLowerCase(),supported=FILTER_TYPE_BITS[client];
 if(!filter.type_bits||typeof filter.type_bits!=='object'||Array.isArray(filter.type_bits)||!Object.keys(filter.type_bits).length)throw Error('Missing filter type bits for '+client);
 for(const [type,bit]of Object.entries(filter.type_bits)){
  if(!Object.hasOwn(supported,type)||supported[type]!==bit)throw Error('Unsupported filter type or bit for '+client+': '+type+'='+bit);
 }
 for(const output of filter.outputs||[]){
  for(const type of output.types||[])if(!Object.hasOwn(filter.type_bits,type))throw Error('Undeclared filter output type for '+client+': '+type);
 }
 filter.profile=client;
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
