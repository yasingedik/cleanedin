import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  writeFileSync
} from 'node:fs';
import { arch, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guides = [
  'AGENTS.md',
  'docs/architecture.md',
  'docs/modular-release.md',
  'docs/ai/README.md'
];

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.status !== 0)
    throw new Error(`Git failed: ${args.join(' ')}`);
  return result.stdout;
}

export function snapshot(cwd) {
  const hash = createHash('sha256');
  const paths = [
    ...new Set(
      git(cwd, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
        .split('\0')
        .filter(Boolean)
    )
  ].sort();
  for (const path of paths) {
    const absolute = join(cwd, path);
    hash.update(`${path}\0`);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('deleted\0');
      continue;
    }
    hash.update(`${stat.mode}\0`);
    const content = stat.isSymbolicLink()
      ? Buffer.from(readlinkSync(absolute))
      : readFileSync(absolute);
    hash.update(`${content.length}\0`);
    hash.update(content);
  }
  return {
    head: git(cwd, ['rev-parse', 'HEAD']).trim(),
    branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    dirty:
      git(cwd, ['status', '--porcelain', '--untracked-files=all']).length > 0,
    worktreeSha256: hash.digest('hex')
  };
}

export function parseArgs(args) {
  const [command, ...flags] = args;
  if (!['context', 'doctor', 'check'].includes(command))
    throw new Error('Use context, doctor, or check [--docs|--full].');
  if (command !== 'check' && flags.length)
    throw new Error(`${command} accepts no flags.`);
  if (
    flags.length > 1 ||
    (flags.length === 1 && !['--docs', '--full'].includes(flags[0]))
  ) {
    throw new Error(
      'check accepts either --docs or --full, or no flags for quick checks.'
    );
  }
  return { command, profile: flags[0]?.slice(2) ?? 'quick' };
}

export function checkPlan(profile, npmPath) {
  if (!['docs', 'quick', 'full'].includes(profile))
    throw new Error('Unknown validation profile.');
  if (!npmPath)
    throw new Error(
      'Run the harness through npm run ai:check so the active npm CLI is used.'
    );
  const npm = (name) => ({
    name,
    command: process.execPath,
    args: [npmPath, 'run', name],
    display: `npm run ${name}`
  });
  const steps = [
    npm('ai:doctor'),
    npm('test:harness'),
    {
      name: 'whitespace',
      command: 'git',
      args: ['diff', '--check', 'HEAD'],
      display: 'git diff --check HEAD'
    }
  ];
  if (profile !== 'docs')
    steps.push(
      ...[
        'lint',
        'typecheck',
        'test',
        'test:fixtures',
        'test:security',
        'build'
      ].map(npm)
    );
  if (profile === 'full')
    steps.push(
      npm('test:baseline'),
      {
        name: 'audit',
        command: process.execPath,
        args: [npmPath, 'audit', '--omit=dev', '--audit-level=moderate'],
        display: 'npm audit --omit=dev --audit-level=moderate'
      },
      npm('test:e2e')
    );
  return steps;
}

export function runPlan(steps, { cwd, report, save, execute = spawnSync }) {
  report.checks = steps.map((step) => ({
    name: step.name,
    command: step.display,
    status: 'pending'
  }));
  save(report);
  let failed = false;
  for (const [index, step] of steps.entries()) {
    const check = report.checks[index];
    if (failed) {
      check.status = 'skipped';
      save(report);
      continue;
    }
    check.status = 'running';
    check.startedAt = new Date().toISOString();
    save(report);
    console.log(`\n[ai:${report.profile}] ${step.display}`);
    const started = performance.now();
    let result;
    try {
      result = execute(step.command, step.args, {
        cwd,
        stdio: 'inherit',
        shell: false
      });
    } catch (error) {
      result = { status: null, error };
    }
    check.durationMs = Math.round(performance.now() - started);
    check.exitCode = result.status ?? null;
    check.signal = result.signal ?? null;
    check.errorCode =
      result.error?.code ?? (result.error ? 'EXECUTION_ERROR' : null);
    failed =
      result.status !== 0 || Boolean(result.error) || Boolean(result.signal);
    check.status = failed ? 'failed' : 'passed';
    save(report);
  }
  return !failed;
}

async function doctor(cwd) {
  const problems = [];
  const expectedNode = readFileSync(join(cwd, '.nvmrc'), 'utf8').trim();
  if (process.versions.node.split('.')[0] !== expectedNode)
    problems.push(`Use Node ${expectedNode} from .nvmrc.`);
  try {
    git(cwd, ['rev-parse', '--show-toplevel']);
  } catch {
    problems.push('A Git checkout with Git installed is required.');
  }
  for (const path of guides)
    if (!existsSync(join(cwd, path))) problems.push(`Missing ${path}.`);
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const require = createRequire(join(cwd, 'package.json'));
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    if (!existsSync(join(cwd, 'node_modules', name)))
      problems.push(`Missing ${name}; run npm ci.`);
  }
  console.log(`Node ${process.versions.node}; ${platform()} ${arch()}`);
  try {
    const { chromium } = require('@playwright/test');
    console.log(
      `Chromium executable: ${existsSync(chromium.executablePath()) ? 'available' : 'missing; run npm run test:e2e:install'}`
    );
  } catch {
    console.log('Chromium executable: unavailable until npm ci succeeds.');
  }
  if (platform() === 'linux' && !process.env.DISPLAY)
    console.log(
      'Full E2E needs a display; use xvfb-run --auto-servernum on Linux.'
    );
  for (const problem of problems) console.error(problem);
  if (problems.length) return 1;
  console.log(
    'Doctor passed. Browser execution and dependency compatibility are checked by the validation profiles.'
  );
  return 0;
}

export async function main(args, cwd = root) {
  const { command, profile } = parseArgs(args);
  if (command === 'doctor') return doctor(cwd);
  if (command === 'context') {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    console.log(
      JSON.stringify(
        {
          repository: pkg.repository?.url,
          ...snapshot(cwd),
          node: process.versions.node,
          readFirst: guides,
          scripts: pkg.scripts
        },
        null,
        2
      )
    );
    console.log(
      'For modular work: verify current GitHub issue dependencies; branch from and target develop/modular-extension.'
    );
    return 0;
  }

  const directory = join(cwd, '.ai', 'reports');
  mkdirSync(directory, { recursive: true });
  const reportPath = join(directory, `${profile}.json`);
  const save = (value) => {
    const temporary = `${reportPath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporary, reportPath);
  };
  const report = {
    schemaVersion: 1,
    profile,
    status: 'running',
    startedAt: new Date().toISOString(),
    environment: {
      node: process.versions.node,
      npm: null,
      os: platform(),
      osRelease: release(),
      arch: arch()
    },
    checks: []
  };
  save(report);
  try {
    report.sourceBefore = snapshot(cwd);
    const npmPath = process.env.npm_execpath;
    const steps = checkPlan(profile, npmPath);
    const npmVersion = spawnSync(process.execPath, [npmPath, '--version'], {
      cwd,
      encoding: 'utf8'
    });
    if (npmVersion.error || npmVersion.status !== 0)
      throw new Error('Cannot determine active npm version.');
    report.environment.npm = npmVersion.stdout.trim();
    const passed = runPlan(steps, { cwd, report, save });
    report.sourceAfter = snapshot(cwd);
    report.sourceChanged =
      JSON.stringify(report.sourceBefore) !==
      JSON.stringify(report.sourceAfter);
    report.status = passed && !report.sourceChanged ? 'passed' : 'failed';
    if (report.sourceChanged)
      report.error =
        'Source changed during validation; rerun on the final worktree.';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
  }
  report.finishedAt = new Date().toISOString();
  save(report);
  console.log(
    `\n${profile}: ${report.status}. Report: .ai/reports/${profile}.json`
  );
  if (report.error) console.error(report.error);
  return report.status === 'passed' ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
