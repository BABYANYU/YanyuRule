import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runBaseTests, baseTestGate} from '../scripts/test-sync-base.mjs';

async function fixture(t) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'yanyurule-base-test-'));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  await mkdir(path.join(cwd, 'tests'));
  await writeFile(path.join(cwd, 'tests/example.test.mjs'), "import test from 'node:test'; test('ok', () => {});\n");
  return cwd;
}

test('base test runner uses explicit discovered files, latest worktree, and execution bounds', async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, 'tests/not-a-test.mjs'), 'ignore');
  let calls = 0;
  await runBaseTests(cwd, {execute: async (command, args, options) => {
    calls++; assert.equal(command, process.execPath);
    assert.deepEqual(args, ['--test', 'tests/example.test.mjs']);
    assert.equal(options.cwd, cwd); assert.equal(options.timeout, 120000);
    assert.equal(options.maxBuffer, 4 * 1024 * 1024); assert.equal(options.killSignal, 'SIGKILL');
  }});
  assert.equal(calls, 1);
  await assert.rejects(runBaseTests(cwd, {execute: async () => { throw Error('private output'); }}), error => error.message.includes('Latest-main tests failed') && !error.message.includes('private output'));
});

test('base test gate caches passed hashes but retries failed hashes', async () => {
  const calls = []; let fail = true;
  const gate = baseTestGate(async cwd => { calls.push(cwd); if (cwd === 'bad' && fail) throw Error('failed'); });
  await gate('one', 'first'); await gate('one', 'duplicate'); await gate('two', 'second');
  await assert.rejects(gate('three', 'bad')); fail = false;
  await gate('three', 'repaired'); await gate('three', 'duplicate');
  assert.deepEqual(calls, ['first', 'second', 'bad', 'repaired']);
});

test('real base test execution fails closed on timeout', async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, 'tests/example.test.mjs'), "import test from 'node:test'; test('slow', async () => { await new Promise(resolve => setTimeout(resolve, 500)); });\n");
  await assert.rejects(runBaseTests(cwd, {timeout: 10}), /Latest-main tests failed/);
});
