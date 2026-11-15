import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {requestSync, gitCommand} from '../scripts/request-sync.mjs';
import {runBaseTests} from '../scripts/test-sync-base.mjs';

async function repository(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'yanyurule-git-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const remote = path.join(root, 'remote.git'), worker = path.join(root, 'worker'), other = path.join(root, 'other');
  await gitCommand(['init', '--bare', '--initial-branch=main', remote], root);
  await mkdir(worker);
  await gitCommand(['init', '--initial-branch=main'], worker);
  for (const [name, value] of [['user.name', 'Offline test'], ['user.email', 'offline@example.test']]) await gitCommand(['config', name, value], worker);
  await writeFile(path.join(worker, '.sync-request.json'), JSON.stringify({id: 'old', requested_at: '2020-01-01T00:00:00.000Z'}) + '\n');
  await mkdir(path.join(worker, 'tests'));
  await writeFile(path.join(worker, 'tests/base.test.mjs'), "import test from 'node:test'; test('base', () => {});\n");
  await gitCommand(['add', '.sync-request.json', 'tests'], worker);
  await gitCommand(['commit', '-m', 'initial'], worker);
  await gitCommand(['remote', 'add', 'origin', remote], worker);
  await gitCommand(['push', 'origin', 'HEAD:main'], worker);
  await gitCommand(['clone', remote, other], root);
  for (const [name, value] of [['user.name', 'Competitor'], ['user.email', 'offline@example.test']]) await gitCommand(['config', name, value], other);
  const advance = async count => {
    await gitCommand(['pull', '--ff-only', 'origin', 'main'], other);
    await writeFile(path.join(other, 'concurrent-' + count + '.txt'), 'preserve me\n');
    await writeFile(path.join(other, '.sync-request.json'), JSON.stringify({id: 'competitor-' + count, requested_at: new Date().toISOString()}) + '\n');
    await gitCommand(['add', '.'], other);
    await gitCommand(['commit', '-m', 'concurrent ' + count], other);
    await gitCommand(['push', 'origin', 'HEAD:main'], other);
  };
  return {root, remote, worker, other, advance};
}

test('request commit is regenerated on latest main after an actual non-fast-forward race', async t => {
  const repo = await repository(t), commands = [], submitted = [];
  const initial = await gitCommand(['rev-parse', 'HEAD'], repo.worker);
  let pushes = 0, clock = Date.now() - 1000;
  const git = async (args, cwd) => {
    commands.push(args);
    if (args[0] === 'fetch' || args[0] === 'push') assert.equal(cwd, repo.worker, 'network uses original checkout authentication');
    if (args[0] === 'push') {
      submitted.push(JSON.parse(await gitCommand(['show', args[2].split(':')[0] + ':.sync-request.json'], cwd)));
      if (++pushes === 1) await repo.advance(1);
    }
    return gitCommand(args, cwd);
  };
  const tested = [];
  const runTests = async cwd => {
    assert.notEqual(cwd, repo.worker);
    tested.push(await gitCommand(['rev-parse', 'HEAD'], cwd));
    assert.notEqual(JSON.parse(await readFile(path.join(cwd, '.sync-request.json'), 'utf8')).id, 'daily-race-1', 'tests precede request generation');
    await runBaseTests(cwd);
  };
  const result = await requestSync({cwd: repo.worker, id: 'daily-race-1', git, runTests, now: () => new Date(clock += 100)});
  assert.equal(tested.length, 2); assert.equal(new Set(tested).size, 2);
  assert.equal(result.attempts, 2); assert.equal(pushes, 2);
  assert.ok(Date.parse(submitted[1].requested_at) > Date.parse(submitted[0].requested_at));
  assert.equal(result.requested_at, submitted[1].requested_at);
  assert.equal(await gitCommand(['rev-parse', 'HEAD'], repo.worker), initial, 'caller branch is not reset');
  const local = JSON.parse(await readFile(path.join(repo.worker, '.sync-request.json'), 'utf8'));
  const published = JSON.parse(await gitCommand(['--git-dir=' + repo.remote, 'show', 'main:.sync-request.json'], repo.root));
  assert.deepEqual(local, published); assert.equal(local.id, 'daily-race-1'); assert.equal(local.requested_at, result.requested_at);
  assert.equal(await gitCommand(['--git-dir=' + repo.remote, 'show', 'main:concurrent-1.txt'], repo.root), 'preserve me');
  assert.equal(await gitCommand(['--git-dir=' + repo.remote, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'main'], repo.root), '.sync-request.json');
  assert.equal(commands.filter(args => args[0] === 'push').some(args => args.some(arg => arg.startsWith('-') || arg.startsWith('+'))), false, 'never force pushes');
  assert.equal((await gitCommand(['worktree', 'list', '--porcelain'], repo.worker)).split('worktree ').length - 1, 1);
});

test('continually competing commits exhaust the finite retry limit and preserve remote changes', async t => {
  const repo = await repository(t); let pushes = 0;
  const before = await readFile(path.join(repo.worker, '.sync-request.json'), 'utf8');
  const git = async (args, cwd) => {
    if (args[0] === 'push') await repo.advance(++pushes);
    return gitCommand(args, cwd);
  };
  await assert.rejects(requestSync({cwd: repo.worker, id: 'daily-exhaust', maxAttempts: 2, git}), /exhausted retry limit/);
  assert.equal(pushes, 2);
  assert.equal(await readFile(path.join(repo.worker, '.sync-request.json'), 'utf8'), before);
  assert.equal(JSON.parse(await gitCommand(['--git-dir=' + repo.remote, 'show', 'main:.sync-request.json'], repo.root)).id, 'competitor-2');
  assert.equal((await gitCommand(['worktree', 'list', '--porcelain'], repo.worker)).split('worktree ').length - 1, 1);
});

test('an accepted push with a lost response is recognized without a duplicate commit', async t => {
  const repo = await repository(t); let pushes = 0;
  const git = async (args, cwd) => {
    const result = await gitCommand(args, cwd);
    if (args[0] === 'push') { pushes++; throw Error('simulated connection loss'); }
    return result;
  };
  const result = await requestSync({cwd: repo.worker, id: 'daily-ack-lost', git});
  assert.equal(result.attempts, 1); assert.equal(pushes, 1);
  assert.equal(await gitCommand(['--git-dir=' + repo.remote, 'rev-list', '--count', 'main'], repo.root), '2');
});

test('push rejection without a concurrent main update fails without repeated submissions', async t => {
  const repo = await repository(t); let pushes = 0;
  const git = async (args, cwd) => {
    if (args[0] === 'push') { pushes++; throw Error('rejected'); }
    return gitCommand(args, cwd);
  };
  await assert.rejects(requestSync({cwd: repo.worker, id: 'daily-reject', git}), /without a competing main update/);
  assert.equal(pushes, 1);
});

test('a failing test introduced by latest main prevents request commit and push', async t => {
  const repo = await repository(t);
  await writeFile(path.join(repo.other, 'tests/base.test.mjs'), "import test from 'node:test'; test('broken latest', () => { throw Error('failure'); });\n");
  await gitCommand(['add', 'tests/base.test.mjs'], repo.other);
  await gitCommand(['commit', '-m', 'latest test failure'], repo.other);
  await gitCommand(['push', 'origin', 'HEAD:main'], repo.other);
  const latest = await gitCommand(['rev-parse', 'HEAD'], repo.other), commands = [];
  const git = async (args, cwd) => { commands.push(args[0]); return gitCommand(args, cwd); };
  await assert.rejects(requestSync({cwd: repo.worker, id: 'daily-test-failure', git}), /Latest-main tests failed/);
  assert.equal(commands.includes('commit'), false); assert.equal(commands.includes('push'), false);
  assert.equal(await gitCommand(['--git-dir=' + repo.remote, 'rev-parse', 'main'], repo.root), latest);
  assert.equal(JSON.parse(await readFile(path.join(repo.worker, '.sync-request.json'), 'utf8')).id, 'old');
});

test('dirty worktree and invalid request configuration are rejected before fetching', async t => {
  const repo = await repository(t);
  await writeFile(path.join(repo.worker, 'unsaved.txt'), 'keep me');
  const commands = [], git = async (args, cwd) => { commands.push(args[0]); return gitCommand(args, cwd); };
  await assert.rejects(requestSync({cwd: repo.worker, id: 'daily-clean', git}), /clean checkout/);
  assert.deepEqual(commands, ['status']);
  await assert.rejects(requestSync({cwd: repo.worker, id: '../bad', git}));
  await assert.rejects(requestSync({cwd: repo.worker, id: 'daily-clean', maxAttempts: 0, git}), /retry limit/);
});
