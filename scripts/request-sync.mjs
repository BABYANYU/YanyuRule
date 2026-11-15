import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {publicBaseURL, validateRequest} from './deployment-acceptance.mjs';
import {baseTestGate, runBaseTests} from './test-sync-base.mjs';

const exec = promisify(execFile);
// Never include git stderr: a remote URL or credential helper may contain secrets.
export async function gitCommand(args, cwd) {
  try {
    const {stdout} = await exec('git', args, {cwd, timeout: 60000, maxBuffer: 1024 * 1024, env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
    return stdout.trim();
  } catch {
    throw Error('Git ' + args[0] + ' failed');
  }
}

export async function requestSync({cwd = process.cwd(), id, maxAttempts = 3, git = gitCommand, runTests = runBaseTests, now = () => new Date()} = {}) {
  validateRequest({id, requested_at: now().toISOString()}, id);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw Error('Invalid retry limit');
  if (await git(['status', '--porcelain'], cwd)) throw Error('Sync request requires a clean checkout');
  const temporary = await mkdtemp(path.join(tmpdir(), 'yanyurule-request-'));
  const worktree = path.join(temporary, 'checkout');
  const testBase = baseTestGate(runTests);
  let added = false;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // FETCH_HEAD pins this exact fetch, independent of remote tracking ref configuration.
      await git(['fetch', '--no-tags', 'origin', 'refs/heads/main'], cwd);
      const base = await git(['rev-parse', 'FETCH_HEAD'], cwd);
      if (!added) {
        await git(['worktree', 'add', '--detach', worktree, base], cwd);
        added = true;
      } else {
        // Only the disposable worktree is reset; the caller's checkout stays intact.
        await git(['reset', '--hard', base], worktree);
      }
      await testBase(base, worktree);
      if (await git(['status', '--porcelain', '--untracked-files=no'], worktree)) throw Error('Latest-main tests modified tracked files');
      const request = {id, requested_at: now().toISOString()};
      validateRequest(request, id);
      const content = JSON.stringify(request) + '\n';
      await writeFile(path.join(worktree, '.sync-request.json'), content);
      await git(['add', '--', '.sync-request.json'], worktree);
      await git(['commit', '-m', 'chore: request verified daily rule synchronization'], worktree);
      const commit = await git(['rev-parse', 'HEAD'], worktree);
      let accepted = false;
      try {
        // Keep network operations in the checkout where pinned checkout configured authentication.
        await git(['push', 'origin', commit + ':refs/heads/main'], cwd);
        accepted = true;
      } catch {
        await git(['fetch', '--no-tags', 'origin', 'refs/heads/main'], cwd);
        const latest = await git(['rev-parse', 'FETCH_HEAD'], cwd);
        // A connection can fail after the server accepted the push.
        try {
          await git(['merge-base', '--is-ancestor', commit, latest], cwd);
          accepted = true;
        } catch {
          if (latest === base) throw Error('Sync request push failed without a competing main update');
          if (attempt === maxAttempts) throw Error('Sync request push exhausted retry limit');
        }
      }
      if (accepted) {
        // Keep exactly the accepted request timestamp for subsequent deployment acceptance.
        await writeFile(path.join(cwd, '.sync-request.json'), await readFile(path.join(worktree, '.sync-request.json')));
        return {request_id: id, requested_at: request.requested_at, commit, attempts: attempt};
      }
    }
    throw Error('Sync request push exhausted retry limit');
  } finally {
    if (added) await git(['worktree', 'remove', '--force', worktree], cwd);
    await rm(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    // Do not create a production request that cannot subsequently be verified.
    publicBaseURL(process.env.YANYURULE_PUBLIC_BASE_URL);
    console.log(JSON.stringify(await requestSync({id: process.env.SYNC_REQUEST_ID})));
  } catch (error) {
    console.error('SYNC_REQUEST_FAILED:', error.message);
    process.exitCode = 1;
  }
}
