import {randomUUID} from 'node:crypto';
import {artifactVerification} from './integrity.mjs';

// A CDN can briefly serve an older object while its new manifest is already live.
// Retry from the origin with a new cache key; every response must still verify.
export async function verifiedDownload(url,{
 headers={},expected=null,cached=null,maxBytes=25*1024*1024,
 fetchImpl=globalThis.fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 onRetry=()=>{},
}={}){
 for(let attempt=0;attempt<4;attempt++){
  try{
   const target=new URL(url),requestHeaders={...headers};
   if(attempt){
    target.searchParams.set('_yanyurule_retry',randomUUID());
    delete requestHeaders['If-None-Match'];delete requestHeaders['If-Modified-Since'];
    requestHeaders['Cache-Control']='no-cache';
   }
   const response=await fetchImpl(target,{headers:requestHeaders,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
   if(response.status===304&&cached){
    const verification=artifactVerification(cached,expected);
    if(!verification)throw Error('SHA256_MISMATCH '+target.pathname);
    return {bytes:cached,verification,notModified:true};
   }
   if(!response.ok)throw Error('HTTP '+response.status+' '+target.pathname);
   if(Number(response.headers.get('content-length'))>maxBytes)throw Error('PAGES_SIZE_LIMIT '+target.pathname);
   const chunks=[];let size=0;
   for await(const chunk of response.body){size+=chunk.byteLength;if(size>maxBytes)throw Error('PAGES_SIZE_LIMIT '+target.pathname);chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);
   const verification=artifactVerification(bytes,expected);
   if(!verification)throw Error('SHA256_MISMATCH '+target.pathname);
   if(/<!doctype html|<html[\s>]/i.test(bytes.subarray(0,200).toString()))throw Error('Unexpected HTML '+target.pathname);
   return {bytes,verification,notModified:false,etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
  }catch(error){
   if(attempt===3||/PAGES_SIZE_LIMIT/.test(error.message))throw error;
   onRetry({attempt:attempt+1,error:error.message});
   await sleep(1000*2**attempt);
  }
 }
}
