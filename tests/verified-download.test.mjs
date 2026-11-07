import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedDownload} from '../scripts/verified-download.mjs';
import {sha256} from '../scripts/integrity.mjs';
const url='https://magicrule.pages.dev/data/_shared/artifacts/ChinaIPs_ipcidr_123456789abcdef0.yaml';
const good=Buffer.from("payload:\n- '1.0.1.0/24'\n"),stale=Buffer.from("payload:\n- '1.0.2.0/24'\n");
const expected={mode:'exact',bytes_sha256:sha256(good)},sleep=async()=>{};

test('hash mismatch retries a fresh URL without conditional headers and only returns verified bytes',async()=>{
 const calls=[];
 const result=await verifiedDownload(url,{expected,sleep,headers:{'If-None-Match':'old','If-Modified-Since':'yesterday'},fetchImpl:async(u,options)=>{
  calls.push({url:new URL(u),options});return new Response(calls.length===1?stale:good);
 }});
 assert.deepEqual(result.bytes,good);assert.equal(result.verification,'bytes');assert.equal(calls.length,2);
 assert.equal(calls[0].url.search,'');assert.ok(calls[1].url.searchParams.has('_yanyurule_retry'));
 assert.equal(calls[1].url.origin,new URL(url).origin);assert.equal(calls[1].url.pathname,new URL(url).pathname);
 assert.equal(calls[1].options.headers['If-None-Match'],undefined);assert.equal(calls[1].options.headers['If-Modified-Since'],undefined);
 assert.equal(calls[1].options.headers['Cache-Control'],'no-cache');assert.equal(calls[1].options.redirect,'error');
});

test('a stale 304 is re-fetched rather than accepting invalid local cache',async()=>{
 let calls=0;const result=await verifiedDownload(url,{expected,cached:stale,sleep,fetchImpl:async()=>++calls===1?new Response(null,{status:304}):new Response(good)});
 assert.equal(calls,2);assert.deepEqual(result.bytes,good);assert.equal(result.notModified,false);
});

test('persistent corruption is rejected after four attempts, even with an old cached copy',async()=>{
 const urls=[];await assert.rejects(verifiedDownload(url,{expected,cached:good,sleep,fetchImpl:async u=>{urls.push(String(u));return new Response(stale);}}),/SHA256_MISMATCH/);
 assert.equal(urls.length,4);assert.equal(new Set(urls).size,4);
});

test('size limit remains fatal without retry, including streamed bodies',async()=>{
 let calls=0;await assert.rejects(verifiedDownload(url,{maxBytes:2,sleep,fetchImpl:async()=>{calls++;return new Response(good);}}),/PAGES_SIZE_LIMIT/);assert.equal(calls,1);
});

test('valid 304 and header-normalized content keep the existing verification rules',async()=>{
 const result=await verifiedDownload(url,{expected,cached:good,sleep,fetchImpl:async()=>new Response(null,{status:304})});assert.equal(result.notModified,true);
 const text='# UPDATED: old\nIP-CIDR,1.0.1.0/24\n';
 const semantic={mode:'standard_header_normalized',bytes_sha256:sha256(text),semantic_sha256:sha256('IP-CIDR,1.0.1.0/24\n'),normalized_header_lines:1};
 const check=await verifiedDownload(url,{expected:semantic,sleep,fetchImpl:async()=>new Response(text.replace('old','new'))});assert.equal(check.verification,'semantic');
 await assert.rejects(verifiedDownload(url,{expected:semantic,sleep,fetchImpl:async()=>new Response(text.replace('1.0.1.0','1.0.2.0'))}),/SHA256_MISMATCH/);
});
