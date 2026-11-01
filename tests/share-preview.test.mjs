import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../site/', import.meta.url);
test('canonical root URL has Telegram/Open Graph preview metadata and a valid image', async () => {
  const html=await readFile(new URL('index.html',root),'utf8');
  const image=await readFile(new URL('share-preview.png',root));
  for(const [property,value] of [
    ['og:title','YanyuRule · 规则库'],['og:url','https://rule.yanyubaby.eu.org/'],
    ['og:image','https://rule.yanyubaby.eu.org/share-preview.png']
  ]) assert.ok(html.includes(`<meta property="${property}" content="${value}">`));
  assert.match(html,/<meta property="og:description" content="[^"\s][^"]+">/);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(image.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
  assert.equal(image.readUInt32BE(16),1200);
  assert.equal(image.readUInt32BE(20),630);
});
