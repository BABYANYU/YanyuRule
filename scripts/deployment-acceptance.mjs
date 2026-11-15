import {createHash} from 'node:crypto';
import {SITE_GROUPS} from '../site/clients.mjs';

export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const positive = value => Number.isSafeInteger(value) && value > 0;
const requireValue = (condition, message) => { if (!condition) throw Error(message); };

export function publicBaseURL(value) {
  requireValue(typeof value === 'string' && value.length > 0, 'Missing YANYURULE_PUBLIC_BASE_URL');
  let url;
  try { url = new URL(value); } catch { throw Error('Unexpected public site URL'); }
  const allowed = ['https://rule.fakeyou.eu.org', 'https://rule.yanyubaby.eu.org', SITE_GROUPS.main.origin];
  requireValue(allowed.includes(url.origin) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Unexpected public site URL');
  return url.origin;
}

export function timestamp(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value), 'Invalid UTC timestamp');
  const time = Date.parse(value);
  requireValue(Number.isFinite(time) && new Date(time).toISOString() === value.replace(/(?<=:\d\d)Z$/, '.000Z'), 'Invalid UTC timestamp');
  return time;
}

export function validateRequest(request, expected, now = Date.now()) {
  requireValue(/^[A-Za-z0-9_-]{1,100}$/.test(expected || ''), 'Missing or invalid sync request ID');
  requireValue(request?.id === expected, 'Local sync request ID mismatch');
  requireValue(timestamp(request.requested_at) <= now + 300000, 'Sync request timestamp is in the future');
  return request;
}

function localPath(value) {
  requireValue(typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\%?#\s\u0000-\u001f]/.test(value) && !value.split('/').some(part => part === '.' || part === '..'), 'Unsafe resource path');
  return value;
}

function resourcePath(value, origin) {
  requireValue(typeof value === 'string' && !/[\\%\s\u0000-\u001f]/.test(value), 'Unsafe resource URL');
  requireValue(value.startsWith('/') && !value.startsWith('//') || value.startsWith(origin + '/'), 'Untrusted resource origin');
  // Check the raw path before URL parsing can normalize traversal segments.
  const rawPath = value.startsWith(origin + '/') ? value.slice(origin.length) : value;
  localPath(rawPath);
  const url = new URL(value, origin);
  requireValue(url.origin === origin && !url.username && !url.password && !url.search && !url.hash, 'Untrusted resource origin');
  return url.pathname;
}

export async function boundedFetch(url, {fetchImpl = fetch, maxBytes = MAX_JSON_BYTES, signal} = {}) {
  const response = await fetchImpl(url, {redirect: 'error', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)});
  requireValue(!response.redirected && response.status === 200 && (!response.url || response.url === String(url)), 'Unexpected HTTP response or redirect');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body?.cancel();
    throw Error('Response exceeds size limit or has invalid length');
  }
  requireValue(response.body, 'Missing response body');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      requireValue(size <= maxBytes, 'Response exceeds size limit');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function verifyGroup({group, origin, request, fetchImpl = fetch, now = Date.now(), signal}) {
  const config = SITE_GROUPS[group];
  requireValue(config && (group === 'main' ? publicBaseURL(origin) === origin : origin === config.origin), 'Unexpected group origin');
  validateRequest(request, request?.id, now);
  const read = async (path, limit = MAX_JSON_BYTES) => {
    const url = new URL(localPath(path), origin);
    url.searchParams.set('verify', request.id + '-' + now);
    return boundedFetch(url, {fetchImpl, maxBytes: limit, signal});
  };
  const status = JSON.parse((await read('/status.json', 65536)).toString('utf8'));
  requireValue(status.brand === 'YanyuRule' && status.group === group && status.request_id === request.id, 'Status identity mismatch');
  requireValue(status.deployment === 'production' && status.scheduler_enabled === true, 'Deployment is not scheduled production');
  requireValue(positive(status.artifact_count) && config.clients.every(client => positive(status.counts?.[client])), 'Invalid artifact or client counts');
  const published = timestamp(status.last_success);
  requireValue(published >= timestamp(request.requested_at) && published <= now + 300000, 'Publication timestamp is outside the request window');
  requireValue(typeof status.content_sha256 === 'string' && SHA.test(status.content_sha256), 'Missing integrity SHA256');
  const integrityBytes = await read('/integrity.json');
  requireValue(hash(integrityBytes) === status.content_sha256, 'Integrity SHA256 mismatch');
  const integrity = JSON.parse(integrityBytes.toString('utf8'));
  requireValue(Array.isArray(integrity) && integrity.length > 0 && integrity.length <= 19998, 'Invalid integrity manifest');
  const entries = new Map();
  for (const entry of integrity) {
    requireValue(entry && typeof entry === 'object', 'Invalid integrity entry');
    localPath(entry.path);
    requireValue(!entries.has(entry.path) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && entry.bytes <= MAX_ARTIFACT_BYTES && typeof entry.sha256 === 'string' && SHA.test(entry.sha256), 'Invalid or duplicate integrity entry');
    entries.set(entry.path, entry);
  }
  const verifiedRead = async (path, limit = MAX_JSON_BYTES) => {
    const entry = entries.get(path);
    requireValue(entry && entry.bytes <= limit, 'Missing or oversized integrity entry');
    const bytes = await read(path, Math.min(limit, entry.bytes));
    requireValue(bytes.length === entry.bytes && hash(bytes) === entry.sha256, 'Resource integrity mismatch');
    return bytes;
  };
  const samples = [];
  for (const client of config.clients) {
    const indexPath = '/data/index/' + client + '.json';
    const index = JSON.parse((await verifiedRead(indexPath)).toString('utf8'));
    requireValue(Array.isArray(index.rules) && index.rules.length === status.counts[client], 'Index count mismatch');
    const rule = index.rules[0];
    requireValue(rule && typeof rule.id === 'string' && UUID.test(rule.id) && typeof rule.name === 'string' && rule.name.length > 0, 'Invalid sampled rule');
    const manifestPath = resourcePath(rule.manifest, origin);
    requireValue(manifestPath === '/data/rules/' + client + '/' + rule.id + '/manifest.json', 'Manifest path mismatch');
    const manifest = JSON.parse((await verifiedRead(manifestPath)).toString('utf8'));
    requireValue(manifest.client === client && manifest.rule === rule.name && Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, 'Manifest identity or artifacts mismatch');
    const artifact = manifest.artifacts[0];
    requireValue(artifact && /^[A-Za-z0-9_-]{1,80}$/.test(artifact.key) && /^[A-Za-z0-9]{1,8}$/.test(artifact.ext), 'Invalid sampled artifact');
    const artifactPath = resourcePath(artifact.url, origin);
    requireValue(artifactPath === '/rules/' + client + '/' + rule.id + '/' + artifact.key + '.' + artifact.ext, 'Artifact path mismatch');
    const bytes = await verifiedRead(artifactPath, MAX_ARTIFACT_BYTES);
    requireValue(bytes.length > 0 && (artifact.byte_size === undefined || artifact.byte_size === bytes.length), 'Artifact size mismatch');
    samples.push({client, index: indexPath, manifest: manifestPath, artifact: artifactPath, bytes: bytes.length, sha256: hash(bytes)});
  }
  return {group, ok: true, published_request_id: status.request_id, last_success: status.last_success, artifact_count: status.artifact_count, samples};
}
