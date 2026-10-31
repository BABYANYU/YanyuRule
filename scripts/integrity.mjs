import {createHash} from 'node:crypto';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function artifactVerification(bytes,expected){
 if(!expected?.bytes_sha256)return 'local-only';
 if(sha256(bytes)===expected.bytes_sha256)return 'bytes';
 if(expected.mode!=='standard_header_normalized'||!expected.semantic_sha256)return null;
 let removed=0,header=true;
 const normalized=bytes.toString('utf8').split('\n').filter(line=>{
  if(header&&line&&!line.startsWith('#'))header=false;
  if(header&&/^# (NAME|AUTHOR|REPO|UPDATED|DESC):/.test(line)){removed++;return false;}
  return true;
 }).join('\n');
 return removed===expected.normalized_header_lines&&sha256(normalized)===expected.semantic_sha256?'semantic':null;
}
