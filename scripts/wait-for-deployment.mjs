import {readFile} from 'node:fs/promises';
import {SITE_GROUPS} from '../site/clients.mjs';
import {publicBaseURL, validateRequest, verifyGroup} from './deployment-acceptance.mjs';

// Fail before any network request when production configuration is missing.
const base = publicBaseURL(process.env.YANYURULE_PUBLIC_BASE_URL);
const expected = process.env.SYNC_REQUEST_ID;
const request = validateRequest(JSON.parse(await readFile(new URL('../.sync-request.json', import.meta.url), 'utf8')), expected);
const until = Date.now() + 20 * 60000;
let success = false;
while (Date.now() < until) {
  const signal = AbortSignal.timeout(Math.max(1, until - Date.now()));
  const results = await Promise.all(Object.entries(SITE_GROUPS).map(async ([group, config]) => {
    try {
      return await verifyGroup({group, origin: group === 'main' ? base : config.origin, request, signal});
    } catch (error) {
      return {group, ok: false, error: error instanceof SyntaxError ? 'Invalid deployment JSON' : error instanceof TypeError ? 'Deployment network or schema error' : error.message};
    }
  }));
  if (results.every(result => result.ok)) {
    console.log(JSON.stringify({published: true, request_id: expected, groups: results}));
    success = true;
    break;
  }
  console.log(JSON.stringify({waiting: true, request_id: expected, groups: results}));
  const remaining = until - Date.now();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(30000, remaining)));
}
if (!success) throw Error('Requested synchronization did not pass acceptance on all three static projects within 20 minutes. Each group keeps its last successful deployment.');
