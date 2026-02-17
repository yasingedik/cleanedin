import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packagePath = resolve('package.json');
const manifestPath = resolve('manifest.json');

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf8'));

const version = packageJson.version;

if (typeof version !== 'string' || version.trim().length === 0) {
  throw new Error('package.json version is missing or invalid.');
}

if (manifestJson.version !== version) {
  manifestJson.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`);
  console.log(`Synced manifest.json version to ${version}`);
} else {
  console.log(`manifest.json already matches package.json version ${version}`);
}
