import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readdir} from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(execFile);

export async function runBaseTests(cwd, {execute = exec, timeout = 120000} = {}) {
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120000) throw Error('Invalid base test timeout');
  const files = (await readdir(path.join(cwd, 'tests'), {withFileTypes: true}))
    .filter(entry => entry.isFile() && /^[A-Za-z0-9_.-]+\.test\.mjs$/.test(entry.name))
    .map(entry => 'tests/' + entry.name).sort();
  if (!files.length || files.length > 200) throw Error('Missing or excessive latest-main tests');
  // A nested node:test child must not inherit the parent's internal runner context.
  const env = {...process.env, NODE_ENV: 'test', GIT_TERMINAL_PROMPT: '0'};
  delete env.NODE_TEST_CONTEXT;
  try {
    await execute(process.execPath, ['--test', ...files], {
      cwd, timeout, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024, env,
    });
  } catch {
    // Do not forward arbitrary test stdout/stderr or environment values to workflow logs.
    throw Error('Latest-main tests failed, timed out, or exceeded the output limit');
  }
  return {tests: files.length};
}

export function baseTestGate(runTests = runBaseTests) {
  const passed = new Set();
  return async (base, cwd) => {
    if (passed.has(base)) return;
    await runTests(cwd);
    passed.add(base);
  };
}
