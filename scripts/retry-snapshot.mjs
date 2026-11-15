// A new upstream release can replace manifests during a long download. Re-read
// the complete metadata snapshot once instead of mixing unverified old files in.
export async function retrySnapshot(build,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 try{return await build();}
 catch(error){
  if(error.code!=='UPSTREAM_SNAPSHOT_EXPIRED'&&!/SHA256_MISMATCH/.test(error.message))throw error;
  log('Upstream snapshot changed or failed integrity; retrying the complete snapshot with fresh metadata. Previous publication remains intact.');
  await sleep(10000);
  return build();
 }
}
