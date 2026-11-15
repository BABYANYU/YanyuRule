/* YanyuRule local filtering for Loon, Quantumult X and Shadowrocket. */
(function(){
 'use strict';
 var profiles={
  Loon:{origin:'https://yanyurule-data-a.pages.dev',bits:{DOMAIN:1,'DOMAIN-SUFFIX':2,'DOMAIN-KEYWORD':4,'USER-AGENT':8,'URL-REGEX':16,'IP-CIDR':32,'IP-CIDR6':64,GEOIP:128,'IP-ASN':256,'SRC-PORT':512,'DEST-PORT':1024,PROTOCOL:2048,AND:4096,OR:8192,NOT:16384,'PROCESS-NAME':32768}},
  QuantumultX:{origin:'https://yanyurule-data-a.pages.dev',bits:{HOST:1,'HOST-SUFFIX':2,'HOST-WILDCARD':4,'HOST-KEYWORD':8,'USER-AGENT':16,'URL-REGEX':32,'IP-CIDR':64,'IP6-CIDR':128,GEOIP:256,'IP-ASN':512}},
  Shadowrocket:{origin:'https://yanyurule-data-a.pages.dev',bits:{DOMAIN:1,'DOMAIN-SUFFIX':2,'DOMAIN-KEYWORD':4,'USER-AGENT':8,'URL-REGEX':16,'IP-CIDR':32,'IP-CIDR6':64,GEOIP:128,'IP-ASN':256,'DEST-PORT':512,PROTOCOL:1024,'PROCESS-NAME':2048,'IN-PORT':4096,'SRC-IP':8192,AND:32768,OR:65536,NOT:131072}}
 };
 var ended=false;
 function done(status,body){if(ended)return;ended=true;var headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'};if(typeof $task!=='undefined')$done({status:'HTTP/1.1 '+status+(status===200?' OK':' Error'),headers:headers,body:body});else $done({response:{status:status,headers:headers,body:body}});}
 function glob(pattern,value){var p=0,v=0,star=-1,start=0;pattern=pattern.toLowerCase();value=value.toLowerCase();while(v<value.length){if(p<pattern.length&&(pattern[p]==='?'||pattern[p]===value[v])){p++;v++;}else if(pattern[p]==='*'){star=p++;start=v;}else if(star>=0){p=star+1;v=++start;}else return false;}while(pattern[p]==='*')p++;return p===pattern.length;}
 try{
  if($request.method&&$request.method!=='GET'){done(405,'# GET only\n');return;}
  var match=/^https:\/\/yanyu\.rule\/(Loon|QuantumultX|Shadowrocket)\/list\?([^#]*)$/.exec($request.url||'');if(!match)throw Error('Invalid request');
  var client=match[1],profile=profiles[client],params={};match[2].split('&').forEach(function(part){var pos=part.indexOf('=');if(pos<0)throw Error('Invalid parameter');var key=decodeURIComponent(part.slice(0,pos));if(!['s','c','o','n','x'].includes(key)||Object.prototype.hasOwnProperty.call(params,key))throw Error('Unexpected parameter');params[key]=decodeURIComponent(part.slice(pos+1).replace(/\+/g,' '));});
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[a-zA-Z0-9_-]{1,80}\.list$/i.test(params.s||'')||!/^\d{1,6}$/.test(params.c||''))throw Error('Invalid source or selection');
  var mask=Number(params.c),allowed=Object.keys(profile.bits).reduce(function(n,k){return n|profile.bits[k];},0),exclude=(params.x||'').trim();
  if(mask<1||(mask&allowed)!==mask||!['rule-set','domain-set'].includes(params.o)||client==='QuantumultX'&&params.o!=='rule-set')throw Error('Invalid output');
  if(exclude.length>256||/[\r\n\0]/.test(exclude))throw Error('Invalid exclusion');
  var source=profile.origin+'/rules/'+client+'/'+params.s;
  function received(error,response,body){try{
   if(error||!response||Number(response.status||response.statusCode)!==200)throw Error('Source download failed');
   if(typeof body!=='string'||body.length>1048576||unescape(encodeURIComponent(body)).length>1048576)throw Error('Source exceeds 1 MiB');
   if(/^\s*<(?:!doctype|html)/i.test(body))throw Error('Unexpected HTML');
   var lines=['# YanyuRule custom rule set','# Source: '+source];
   body.replace(/^\uFEFF/,'').split(/\r?\n/).forEach(function(raw){var line=raw.trim();if(!line||line[0]==='#'||line[0]===';')return;var comma=line.indexOf(',');if(comma<0)return;var type=line.slice(0,comma).toUpperCase();if(!(mask&profile.bits[type]))return;var value=line.slice(comma+1).split(',')[0].trim();if(exclude&&glob(exclude,value))return;if(params.n==='1'&&['IP-CIDR','IP-CIDR6','IP-ASN'].includes(type))line=line.replace(/,\s*no-resolve\s*$/i,'');if(params.o==='domain-set'){if(type==='DOMAIN')lines.push(value);else if(type==='DOMAIN-SUFFIX')lines.push('.'+value.replace(/^\./,''));}else lines.push(line);});
   if(lines.length===2)throw Error('No rules remain after filtering');done(200,lines.join('\n')+'\n');
  }catch(e){done(502,'# YanyuRule: '+e.message+'\n');}}
  if(typeof $task!=='undefined'&&$task.fetch)$task.fetch({url:source,method:'GET',headers:{'Accept-Encoding':'identity'}}).then(function(r){received(null,r,r.body);},function(e){received(e);});
  else $httpClient.get({url:source,timeout:25},received);
 }catch(e){done(400,'# YanyuRule: '+e.message+'\n');}
})();
