/* YanyuRule client-side rule filter. No remote script evaluation or arbitrary source URLs. */
(function () {
 'use strict';
 var ORIGIN='https://rule.yanyubaby.eu.org';
 var BITS={'DOMAIN':1,'DOMAIN-SUFFIX':2,'DOMAIN-KEYWORD':4,'USER-AGENT':8,'URL-REGEX':16,'IP-CIDR':32,'IP-CIDR6':64,'GEOIP':128,'IP-ASN':256,'DEST-PORT':512,'PROTOCOL':1024,'PROCESS-NAME':2048,'IN-PORT':4096,'SRC-IP':8192,'AND':32768,'OR':65536,'NOT':131072};
 var ended=false;
 function finish(status,body){if(ended)return;ended=true;$done({response:{status:status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},body:body}});}
 function glob(pattern,value){var p=0,v=0,star=-1,match=0;pattern=pattern.toLowerCase();value=value.toLowerCase();while(v<value.length){if(p<pattern.length&&(pattern[p]==='?'||pattern[p]===value[v])){p++;v++;}else if(pattern[p]==='*'){star=p++;match=v;}else if(star!==-1){p=star+1;v=++match;}else{return false;}}while(pattern[p]==='*')p++;return p===pattern.length;}
 try{
  if($request.method&&$request.method!=='GET'){finish(405,'# YanyuRule: GET only\n');return;}
  var match=/^https:\/\/yanyu\.rule\/list\?([^#]*)$/.exec($request.url||'');
  if(!match){finish(400,'# YanyuRule: invalid request\n');return;}
  var params={};match[1].split('&').forEach(function(p){var i=p.indexOf('=');if(i>=0){var k=decodeURIComponent(p.slice(0,i)),v=decodeURIComponent(p.slice(i+1).replace(/\+/g,' '));if(Object.prototype.hasOwnProperty.call(params,k))throw Error('Duplicate parameter');params[k]=v;}});
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[a-zA-Z0-9_-]{1,80}\.list$/i.test(params.s||'')||!/^[0-9]{1,6}$/.test(params.c||''))throw Error('Invalid source or type selection');
  var mask=Number(params.c),allowed=Object.keys(BITS).reduce(function(n,k){return n|BITS[k];},0);
  if(mask<1||(mask&allowed)!==mask||!['rule-set','domain-set'].includes(params.o))throw Error('Invalid output');
  var exclude=(params.x||'').trim();if(exclude.length>256||/[\r\n\0]/.test(exclude))throw Error('Invalid exclusion');
  $httpClient.get({url:ORIGIN+'/rules/Surge/'+params.s,timeout:25},function(error,response,body){
   try{
    if(error||!response||Number(response.status||response.statusCode)!==200)throw Error('Source download failed');
    if(typeof body!=='string'||body.length>1048576||unescape(encodeURIComponent(body)).length>1048576)throw Error('Source exceeds 1 MiB');
    if(/^\s*<(?:!doctype|html)/i.test(body))throw Error('Unexpected HTML');
    var lines=['# YanyuRule custom rule set','# Source: '+ORIGIN+'/rules/Surge/'+params.s];
    body.replace(/^\uFEFF/,'').split(/\r?\n/).forEach(function(raw){var line=raw.trim();if(!line||line[0]==='#'||line[0]===';')return;var comma=line.indexOf(',');if(comma<0)return;var type=line.slice(0,comma).toUpperCase();if(!BITS[type]||!(mask&BITS[type]))return;var rest=line.slice(comma+1),value=rest.split(',')[0].trim();if(exclude&&glob(exclude,value))return;if(params.n==='1'&&['IP-CIDR','IP-CIDR6','IP-ASN'].includes(type))line=line.replace(/,\s*no-resolve\s*$/i,'');if(params.o==='domain-set'){if(type==='DOMAIN')lines.push(value);else if(type==='DOMAIN-SUFFIX')lines.push('.'+value.replace(/^\./,''));}else lines.push(line);});
    if(lines.length===2)throw Error('No rules remain after filtering');
    finish(200,lines.join('\n')+'\n');
   }catch(e){finish(502,'# YanyuRule: '+e.message+'\n');}
  });
 }catch(e){finish(400,'# YanyuRule: '+e.message+'\n');}
})();
