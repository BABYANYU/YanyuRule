import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SITE_GROUPS} from '../site/clients.mjs';
import {publicBaseURL, timestamp, validateRequest, boundedFetch, verifyGroup} from '../scripts/deployment-acceptance.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const request = {id: 'daily-offline-1', requested_at: '2026-01-02T03:04:05.000Z'};
const now = Date.parse('2026-01-02T03:05:00.000Z');
const id = '11111111-1111-4111-8111-111111111111';
function fixture(group = 'main') {
  const config = SITE_GROUPS[group], origin = group === 'main' ? 'https://rule.fakeyou.eu.org' : config.origin;
  const files = new Map(), calls = [];
  const put = (path, value) => files.set(path, Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)));
  for (const client of config.clients) {
    const manifest = '/data/rules/' + client + '/' + id + '/manifest.json';
    const artifact = '/rules/' + client + '/' + id + '/rules.list';
    put('/data/index/' + client + '.json', {rules: [{id, name: 'Example', manifest}]});
    put(manifest, {client, rule: 'Example', artifacts: [{key: 'rules', ext: 'list', url: artifact, byte_size: 20}]});
    put(artifact, 'DOMAIN,example.test\n');
  }
  const status = {brand: 'YanyuRule', group, request_id: request.id, deployment: 'production', scheduler_enabled: true, artifact_count: config.clients.length, counts: Object.fromEntries(config.clients.map(c => [c, 1])), last_success: '2026-01-02T03:04:30.000Z'};
  const seal = () => {
    const integrity = [...files].filter(([p]) => !['/status.json', '/integrity.json'].includes(p)).map(([path, bytes]) => ({path, bytes: bytes.length, sha256: hash(bytes)}));
    put('/integrity.json', integrity);
    status.content_sha256 = hash(files.get('/integrity.json'));
    put('/status.json', status);
  };
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, origin);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    calls.push(url.pathname);
    const bytes = files.get(url.pathname);
    return new Response(bytes, {status: bytes ? 200 : 404});
  };
  seal();
  return {group, origin, request, now, files, put, status, seal, calls, fetchImpl};
}

test('public base URL is explicit and limited to the two custom domains and main Pages', () => {
  for (const origin of ['https://rule.fakeyou.eu.org', 'https://rule.yanyubaby.eu.org', SITE_GROUPS.main.origin]) assert.equal(publicBaseURL(origin), origin);
  assert.throws(() => publicBaseURL('invalid-private-config'), error => error.message === 'Unexpected public site URL' && !('input' in error));
  for (const value of [undefined, '', 'http://rule.fakeyou.eu.org', 'https://rule.fakeyou.eu.org.evil.test', 'https://rule.fakeyou.eu.org:8443', 'https://user:pass@rule.fakeyou.eu.org', 'https://rule.fakeyou.eu.org/other', 'https://rule.fakeyou.eu.org/?x=1', SITE_GROUPS.a.origin]) assert.throws(() => publicBaseURL(value));
});

test('timestamps reject invalid calendar dates, ambiguous formats, and wrong local request', () => {
  assert.equal(timestamp('2026-01-02T03:04:05Z'), timestamp(request.requested_at));
  for (const value of ['2026-02-30T00:00:00.000Z', '2026-01-01', '2026-01-01T00:00:00+00:00', '2026-01-01T24:00:00.000Z', null]) assert.throws(() => timestamp(value));
  assert.throws(() => validateRequest(request, 'another', now), /ID mismatch/);
  assert.throws(() => validateRequest({...request, requested_at: '2099-01-01T00:00:00.000Z'}, request.id, now), /future/);
});

for (const group of Object.keys(SITE_GROUPS)) test('offline acceptance follows and hashes every sampled chain in group ' + group, async () => {
  const f = fixture(group), result = await verifyGroup(f);
  assert.equal(result.ok, true);
  assert.equal(result.samples.length, SITE_GROUPS[group].clients.length);
  assert.equal(f.calls.length, 2 + result.samples.length * 3);
  for (const sample of result.samples) assert.equal(sample.sha256, hash(f.files.get(sample.artifact)));
});

test('status must identify fresh scheduled production with positive integer counts', async () => {
  for (const change of [{deployment: 'local'}, {scheduler_enabled: 'true'}, {scheduler_enabled: false}, {artifact_count: 0}, {artifact_count: '1'}, {artifact_count: 1.1}, {request_id: 'previous'}, {group: undefined}, {counts: {Surge: '1', Mihomo: 1}}, {last_success: '2026-01-02T03:04:04.999Z'}, {last_success: '2099-01-01T00:00:00.000Z'}, {last_success: 'not-a-date'}]) {
    const f = fixture(); Object.assign(f.status, change); f.seal();
    await assert.rejects(verifyGroup(f));
    assert.equal(f.calls.length, 1);
  }
});

test('tampering is rejected at integrity, index, manifest, and artifact layers', async () => {
  for (const target of ['/integrity.json', '/data/index/Surge.json', '/data/rules/Surge/' + id + '/manifest.json', '/rules/Surge/' + id + '/rules.list']) {
    const f = fixture(); f.files.set(target, Buffer.from('tampered'));
    await assert.rejects(verifyGroup(f), /SHA256 mismatch|integrity mismatch|size limit/);
  }
});

test('integrity must have unique paths and entries for every sampled resource', async () => {
  for (const mutate of [items => items.slice(1), items => [...items, items[0]], items => items.map((e, i) => i ? e : {...e, bytes: -1})]) {
    const f = fixture();
    f.put('/integrity.json', mutate(JSON.parse(f.files.get('/integrity.json'))));
    f.status.content_sha256 = hash(f.files.get('/integrity.json')); f.put('/status.json', f.status);
    await assert.rejects(verifyGroup(f), /integrity entry/);
  }
});

test('even self-consistent metadata cannot point samples outside the expected local paths', async () => {
  for (const manifest of ['https://evil.test/a', SITE_GROUPS.a.origin + '/data/a', '//evil.test/a', '/data/../outside', '/data/%2e%2e/outside', '/data/rules/Surge/' + id + '/manifest.json?x=1']) {
    const f = fixture(); f.put('/data/index/Surge.json', {rules: [{id, name: 'Example', manifest}]}); f.seal();
    await assert.rejects(verifyGroup(f)); assert.equal(f.calls.length, 3);
  }
  for (const patch of [{client: 'Mihomo'}, {rule: 'Other'}, {artifacts: []}, {artifacts: [{key: 'rules', ext: 'list', url: 'https://evil.test/payload'}]}]) {
    const f = fixture(), path = '/data/rules/Surge/' + id + '/manifest.json';
    f.put(path, {...JSON.parse(f.files.get(path)), ...patch}); f.seal(); await assert.rejects(verifyGroup(f));
  }
  const f = fixture(); f.status.counts.Surge = 2; f.seal(); await assert.rejects(verifyGroup(f), /Index count/);
});

test('bounded streaming rejects declared or actual oversized bodies and redirects', async () => {
  const url = new URL('https://rule.fakeyou.eu.org/status.json');
  for (const response of [new Response('x', {status: 302, headers: {location: 'https://evil.test'}}), new Response('x', {headers: {'content-length': '100'}}), new Response('x', {headers: {'content-length': 'nonsense'}}), new Response('123456789', {headers: {'content-length': '1'}})]) {
    await assert.rejects(boundedFetch(url, {maxBytes: 5, fetchImpl: async () => response}), /redirect|size limit|invalid length/);
  }
  let cancelled = false;
  const body = new ReadableStream({pull(controller) { controller.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; }});
  await assert.rejects(boundedFetch(url, {maxBytes: 5, fetchImpl: async () => new Response(body)}), /size limit/);
  assert.equal(cancelled, true);
  const response = new Response('x'); Object.defineProperty(response, 'url', {value: 'https://evil.test/status.json'});
  await assert.rejects(boundedFetch(url, {fetchImpl: async () => response}), /redirect/);
});

test('both production CLIs fail immediately with a missing public URL', async () => {
  for (const script of ['wait-for-deployment', 'request-sync']) {
    await assert.rejects(promisify(execFile)(process.execPath, ['scripts/' + script + '.mjs'], {cwd: new URL('../', import.meta.url), env: {...process.env, YANYURULE_PUBLIC_BASE_URL: '', SYNC_REQUEST_ID: request.id}}), error => /Missing YANYURULE_PUBLIC_BASE_URL/.test(error.stderr));
  }
});

test('an untrusted group origin is rejected before contacting the network', async () => {
  const f = fixture('a'); f.origin = 'https://rule.fakeyou.eu.org';
  await assert.rejects(verifyGroup(f), /group origin/); assert.equal(f.calls.length, 0);
});
