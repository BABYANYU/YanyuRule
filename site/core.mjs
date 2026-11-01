export {iconForRule,catalogIconMap,fallbackRuleIcon,needsDarkInk} from './rule-icons.mjs';
import {clientBase,clientResource} from './clients.mjs';
export {CLIENTS,SITE_GROUPS,groupForClient,clientBase,clientResource,moduleInstallURL} from './clients.mjs';
export const PAGE_SIZE=8;
export function category(type){if(/DOMAIN|HOST/i.test(type))return 'domain';if(/IP|CIDR|ASN|GEOIP/i.test(type))return 'ip';return 'other';}
export function selectRules(rules,{query='',filter='all',sort='name'}={}){
 const q=query.trim().toLocaleLowerCase();
 return rules.filter(r=>(!q||[r.name,r.chinese_name,r.description].filter(Boolean).some(v=>String(v).toLocaleLowerCase().includes(q)))&&(filter==='all'||(r.types||[]).some(t=>category(t)===filter))).sort((a,b)=>{
  const tie=()=>a.name.localeCompare(b.name,'en',{numeric:true});
  if(sort==='updated')return (Date.parse(b.rule_updated_at)||0)-(Date.parse(a.rule_updated_at)||0)||tie();
  if(sort==='size')return (b.total_line_count||0)-(a.total_line_count||0)||tie();return tie();
 });
}
export function safeURL(value,origin){try{const u=new URL(value,origin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function customSubscription({capability,artifacts,selected,available,skipNoResolve=false,exclude='',origin}){
 const config=capability?.subscription_filter;
 if(!config)return {error:'当前客户端提供现成规则格式，无需安装过滤脚本。'};
 const types=[...new Set(selected)].filter(t=>available.includes(t)&&Number.isInteger(config.type_bits[t]));
 if(!types.length)return {error:'请至少选择一种规则类型。'};
 const pattern=exclude.trim();
 if(pattern.length>256||/[\r\n\0]/.test(pattern))return {error:'排除模式最多 256 个字符，仅支持一条模式。'};
 const supported=available.filter(t=>Number.isInteger(config.type_bits[t]));
 const exact=config.outputs.find(o=>o.match==='exact'&&o.types.length===types.length&&o.types.every(t=>types.includes(t)));
 const output=exact||config.outputs.find(o=>o.match==='fallback');
 if(!output)return {error:'当前选择没有可用的输出格式。'};
 const applicable=skipNoResolve&&types.some(t=>['IP-CIDR','IP-CIDR6','IP-ASN','ip_cidr_set','ip_cidr6_set','asn_set','geoip_set'].includes(t));
 const allSelected=supported.every(t=>types.includes(t));
 for(const declaration of output.sources){
  if(declaration.when==='all-selected'&&!exact&&!allSelected)continue;
  if((pattern||applicable)&&declaration.action!=='filter')continue;
  const source=artifacts.find(a=>(a.role===declaration.role||a.key===declaration.role||(declaration.role==='full'&&!a.role&&a.key==='rules'))&&!a.binary&&!a.empty&&a.url);
  if(!source)continue;
  const client=config.profile||'Surge';let resource;try{resource=clientResource(source.url,client,origin);}catch{return {error:'规则文件来源无效。'};}
  if(declaration.action==='direct')return {url:resource,label:source.label||output.label,action:'direct',source,output:output.id,types};
  if(source.byte_size>1048576)return {error:'完整源文件超过 1 MiB，无法使用客户端自定义过滤。请使用现成规则文件。'};
  const pathname=new URL(resource).pathname,prefix='/rules/'+client+'/';
  const name=pathname.startsWith(prefix)?pathname.slice(prefix.length):'';
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[a-zA-Z0-9_-]{1,80}\.(?:list|yaml)$/i.test(name))return {error:'不支持此源文件路径。'};
  const u=new URL(config.request_url||'https://yanyu.rule/list');
  u.searchParams.set('s',name);u.searchParams.set('c',String(types.reduce((n,t)=>n|config.type_bits[t],0)));u.searchParams.set('o',output.id);
  if(applicable)u.searchParams.set('n','1');if(pattern)u.searchParams.set('x',pattern);
  return {url:u.href,label:output.label,action:'filter',source,output:output.id,types};
 }
 return {error:'当前选择没有对应的源文件。'};
}
export function syncHealth(status,now=Date.now()){
 const age=(now-Date.parse(status?.last_success))/3600000;
 if(!Number.isFinite(age)||age<-.1)return {stale:true,text:'同步时间无效'};
 if(age>26)return {stale:true,text:'数据超过 26 小时未成功同步'};
 return {stale:false,text:status.scheduler_enabled?'每日同步':status.deployment==='production'?'网站已部署 · 自动同步未启用':'本地功能验证 · 自动同步未启用'};
}
