/* YanyuRule Egern local filter: strict flat rule-set YAML, no backend fallback. */
const BITS={domain_set:1,domain_suffix_set:2,domain_keyword_set:4,domain_wildcard_set:8,ip_cidr_set:16,ip_cidr6_set:32,asn_set:64,url_regex_set:128,user_agent_set:256,dest_port_set:512,geoip_set:1024,protocol_set:2048};
function glob(pattern,value){let p=0,v=0,star=-1,start=0;pattern=pattern.toLowerCase();value=value.toLowerCase();while(v<value.length){if(p<pattern.length&&(pattern[p]==='?'||pattern[p]===value[v])){p++;v++;}else if(pattern[p]==='*'){star=p++;start=v;}else if(star>=0){p=star+1;v=++start;}else return false;}while(pattern[p]==='*')p++;return p===pattern.length;}
export function filterYaml(body,mask,skip=false,exclude=''){
 if(typeof body!=='string'||body.length>1048576||unescape(encodeURIComponent(body)).length>1048576)throw Error('Source exceeds 1 MiB');
 if(/^\s*<(?:!doctype|html)/i.test(body))throw Error('Unexpected HTML');
 const output=['# YanyuRule custom rule set'];let key=null,items=[],noResolve=null,total=0;
 const flush=()=>{if(key&&(mask&BITS[key])&&items.length){output.push(key+':',...items);total+=items.length;}items=[];};
 for(const raw of body.replace(/^\uFEFF/,'').split(/\r?\n/)){
  if(!raw.trim()||raw.trimStart().startsWith('#'))continue;
  if(/^no_resolve:\s*(?:true|false)\s*$/.test(raw)){noResolve=raw;continue;}
  const header=/^([a-z_0-9]+):\s*(?:\[\])?\s*$/.exec(raw);
  if(header){flush();key=header[1];if(!Object.hasOwn(BITS,key))throw Error('Unsupported YAML rule type');continue;}
  const item=/^\s+-\s+(.+?)\s*$/.exec(raw);if(!key||!item)throw Error('Unsupported YAML structure');
  let value=item[1];if(value.startsWith('"'))value=JSON.parse(value);else if(value.startsWith("'")){if(!value.endsWith("'"))throw Error('Invalid quoted value');value=value.slice(1,-1).replace(/''/g,"'");}
  if(exclude&&glob(exclude,String(value)))continue;items.push('  - '+item[1]);
 }
 flush();if(!total)throw Error('No rules remain after filtering');if(noResolve&&!skip)output.push(noResolve);return output.join('\n')+'\n';
}
export default async function(ctx){
 const reply=(status,body)=>ctx.respond({status,headers:{'Content-Type':'text/yaml; charset=utf-8','Cache-Control':'no-store'},body});
 let url,source,mask,exclude;
 try{url=new URL(ctx.request.url);if(url.origin!=='https://yanyu.rule'||url.pathname!=='/Egern/list'||ctx.request.method&&ctx.request.method!=='GET')throw Error('Invalid request');for(const key of url.searchParams.keys())if(!['s','c','o','n','x'].includes(key)||url.searchParams.getAll(key).length!==1)throw Error('Unexpected parameter');
  const name=url.searchParams.get('s')||'',selection=url.searchParams.get('c')||'';mask=Number(selection);exclude=(url.searchParams.get('x')||'').trim();
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[a-zA-Z0-9_-]{1,80}\.yaml$/i.test(name)||!/^\d{1,4}$/.test(selection)||mask<1||(mask&4095)!==mask||url.searchParams.get('o')!=='rule-set')throw Error('Invalid selection');
  if(exclude.length>256||/[\r\n\0]/.test(exclude))throw Error('Invalid exclusion');source='https://yanyurule-data-b.pages.dev/rules/Egern/'+name;
 }catch(e){return reply(400,'# YanyuRule: '+e.message+'\n');}
 try{const response=await ctx.http.get(source,{headers:{'Accept-Encoding':'identity'},timeout:25000});if(response.status!==200)throw Error('Source download failed');const length=Number(response.headers?.get?.('content-length'));if(length>1048576)throw Error('Source exceeds 1 MiB');return reply(200,filterYaml(await response.text(),mask,url.searchParams.get('n')==='1',exclude));}
 catch(e){return reply(502,'# YanyuRule: '+e.message+'\n');}
}
