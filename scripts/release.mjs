import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npm run release -- <version|patch|minor|major|pre*>');
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npmCommand, ['version', ...args]);

const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

if (typeof version !== 'string' || version.length === 0) {
  console.error('Could not read version from package.json after npm version.');
  process.exit(1);
}

const tag = `v${version}`;

run('git', ['push', 'origin', 'HEAD']);
run('git', ['push', 'origin', tag]);

console.log(`Release complete: pushed HEAD and ${tag}`);
