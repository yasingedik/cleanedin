import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  checkPlan,
  main,
  parseArgs,
  runPlan,
  snapshot
} from './ai-harness.mjs';

test('invalid flags fail rather than silently selecting less validation', () => {
  for (const args of [
    [],
    ['check', '--ful'],
    ['check', '--docs', '--full'],
    ['doctor', '--full']
  ]) {
    assert.throws(() => parseArgs(args));
  }
  assert.equal(parseArgs(['check']).profile, 'quick');
  assert.equal(parseArgs(['check', '--full']).profile, 'full');
  assert.throws(() => checkPlan('full', undefined));
});

test('full validation includes all suites and builds before installed extension tests', () => {
  const names = checkPlan('full', '/npm.cjs').map((step) => step.name);
  for (const name of [
    'test:harness',
    'lint',
    'typecheck',
    'test',
    'test:fixtures',
    'test:security',
    'build',
    'audit',
    'test:e2e'
  ]) {
    assert.ok(names.includes(name), `missing ${name}`);
  }
  assert.ok(names.indexOf('build') < names.indexOf('test:e2e'));
  assert.ok(
    !checkPlan('quick', '/npm.cjs').some((step) => step.name === 'test:e2e')
  );
  assert.ok(
    !checkPlan('docs', '/npm.cjs').some((step) => step.name === 'test')
  );
});

test('a real child failure stops later commands and persists honest evidence', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'cleanedin-harness-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const steps = [
    {
      name: 'pass',
      command: process.execPath,
      args: ['-e', 'process.exit(0)'],
      display: 'pass'
    },
    {
      name: 'fail',
      command: process.execPath,
      args: ['-e', 'process.exit(7)'],
      display: 'fail'
    },
    {
      name: 'must-not-run',
      command: process.execPath,
      args: ['-e', 'require("fs").writeFileSync("unexpected", "bad")'],
      display: 'must-not-run'
    }
  ];
  const saved = [];
  const report = { profile: 'test', status: 'running' };
  assert.equal(
    runPlan(steps, {
      cwd,
      report,
      save: (value) => saved.push(structuredClone(value))
    }),
    false
  );
  assert.deepEqual(
    report.checks.map((check) => check.status),
    ['passed', 'failed', 'skipped']
  );
  assert.equal(report.checks[1].exitCode, 7);
  assert.throws(() => readFileSync(join(cwd, 'unexpected')));
  assert.equal(saved[0].checks[0].status, 'pending');
  assert.ok(saved.some((value) => value.checks[1].status === 'running'));
});

test('missing executables and terminated children cannot pass', () => {
  for (const result of [
    { status: null, error: { code: 'ENOENT' } },
    { status: null, signal: 'SIGTERM' }
  ]) {
    const report = { profile: 'test' };
    assert.equal(
      runPlan(
        [{ name: 'check', command: 'missing', args: [], display: 'check' }],
        {
          cwd: tmpdir(),
          report,
          save: () => {},
          execute: () => result
        }
      ),
      false
    );
    assert.equal(report.checks[0].status, 'failed');
    assert.equal(report.checks[0].exitCode, null);
  }
});

test('fingerprints detect content edits even when dirty status is unchanged and exclude ignored reports', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'cleanedin-harness-git-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init');
  writeFileSync(join(cwd, '.gitignore'), 'report.json\n');
  writeFileSync(join(cwd, 'source.txt'), 'baseline');
  git('add', '.');
  git(
    '-c',
    'user.name=Harness Test',
    '-c',
    'user.email=harness@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'test baseline'
  );
  const baseline = snapshot(cwd);
  assert.equal(baseline.dirty, false);
  writeFileSync(join(cwd, 'report.json'), 'ignored');
  assert.deepEqual(snapshot(cwd), baseline);
  writeFileSync(join(cwd, 'source.txt'), 'first edit');
  const first = snapshot(cwd);
  writeFileSync(join(cwd, 'source.txt'), 'second edit');
  const second = snapshot(cwd);
  assert.equal(first.dirty, second.dirty);
  assert.notEqual(first.worktreeSha256, second.worktreeSha256);
  writeFileSync(join(cwd, 'new.txt'), 'untracked');
  assert.notEqual(snapshot(cwd).worktreeSha256, second.worktreeSha256);
  rmSync(join(cwd, 'source.txt'));
  assert.doesNotThrow(() => snapshot(cwd));
});

test('reports replace stale success, persist failures, and reject source edits during a run', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'cleanedin-harness-report-'));
  const previousNpm = process.env.npm_execpath;
  t.after(() => {
    if (previousNpm === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previousNpm;
    rmSync(cwd, { recursive: true, force: true });
  });
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init');
  writeFileSync(join(cwd, '.gitignore'), '.ai/\n');
  writeFileSync(join(cwd, 'source.txt'), 'baseline\n');
  git('add', '.');
  git(
    '-c',
    'user.name=Harness Test',
    '-c',
    'user.email=harness@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'test baseline'
  );
  mkdirSync(join(cwd, '.ai'));
  const fakeNpm = join(cwd, '.ai', 'npm.cjs');
  writeFileSync(
    fakeNpm,
    `
    const fs = require('node:fs');
    const report = JSON.parse(fs.readFileSync('.ai/reports/docs.json'));
    if (report.status !== 'running') process.exit(99);
    if (process.argv[2] === '--version') console.log('test-npm');
    if (process.argv[3] === 'test:harness') {
      const mode = fs.readFileSync('.ai/mode', 'utf8');
      if (mode === 'fail') process.exit(7);
      if (mode === 'mutate') fs.writeFileSync('source.txt', 'changed during checks\\n');
    }
  `
  );
  process.env.npm_execpath = fakeNpm;
  const report = () =>
    JSON.parse(readFileSync(join(cwd, '.ai', 'reports', 'docs.json'), 'utf8'));
  writeFileSync(join(cwd, '.ai', 'mode'), 'pass');
  assert.equal(await main(['check', '--docs'], cwd), 0);
  assert.equal(report().status, 'passed');
  writeFileSync(join(cwd, '.ai', 'mode'), 'fail');
  assert.equal(await main(['check', '--docs'], cwd), 1);
  assert.equal(report().status, 'failed');
  assert.deepEqual(
    report().checks.map((check) => check.status),
    ['passed', 'failed', 'skipped']
  );
  writeFileSync(join(cwd, '.ai', 'mode'), 'mutate');
  assert.equal(await main(['check', '--docs'], cwd), 1);
  assert.equal(report().sourceChanged, true);
  assert.equal(report().status, 'failed');
  delete process.env.npm_execpath;
  assert.equal(await main(['check', '--docs'], cwd), 1);
  assert.equal(report().status, 'failed');
  assert.equal(report().checks.length, 0);
});
