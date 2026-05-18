#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PACKAGE_PATHS = {
  root: 'package.json',
  pwa: 'apps/pwa/package.json',
  extension: 'apps/extension/package.json',
  shared: 'packages/shared/package.json'
};
const USAGE =
  'Usage: pnpm release -- [--dry-run] <root|pwa|extension|shared|all>... <patch|minor|major|x.y.z>';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  return match.slice(1).map(Number);
}

function bumpVersion(version, releaseType) {
  const [major, minor, patch] = parseVersion(version);

  if (releaseType === 'major') {
    return `${major + 1}.0.0`;
  }

  if (releaseType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  if (releaseType === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  if (/^\d+\.\d+\.\d+$/.test(releaseType)) {
    return releaseType;
  }

  throw new Error(USAGE);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function setPackageVersion(path, nextVersion, { dryRun }) {
  const packageJson = readJson(path);
  packageJson.version = nextVersion;
  if (!dryRun) {
    writeJson(path, packageJson);
  }
}

// pnpm can forward the separator itself to Node scripts, so ignore standalone
// `--` before validating release targets.
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const dryRun = forwardedArgs.includes('--dry-run');
const args = forwardedArgs.filter((arg) => arg !== '--dry-run');
const releaseType = args.at(-1);
const requestedTargets = args.slice(0, -1);

if (!requestedTargets.length || !releaseType) {
  throw new Error(USAGE);
}

for (const target of requestedTargets) {
  if (target !== 'all' && !(target in PACKAGE_PATHS)) {
    throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Non-root package releases always move the monorepo root version because the
 * root version drives changelog generation. Multiple targets intentionally share
 * the same computed root version so `pwa shared patch` increments root once.
 */
function resolveReleaseTargets(targets) {
  if (targets.includes('all')) {
    return Object.keys(PACKAGE_PATHS);
  }

  const resolvedTargets = new Set(targets);
  if ([...resolvedTargets].some((target) => target !== 'root')) {
    resolvedTargets.add('root');
  }

  return Object.keys(PACKAGE_PATHS).filter((packageName) => resolvedTargets.has(packageName));
}

const bumpedVersions = new Map();
const rootPackage = readJson(PACKAGE_PATHS.root);
const rootNextVersion = bumpVersion(rootPackage.version, releaseType);
const releaseTargets = resolveReleaseTargets(requestedTargets);

for (const packageName of releaseTargets) {
  setPackageVersion(PACKAGE_PATHS[packageName], rootNextVersion, { dryRun });
  bumpedVersions.set(packageName, rootNextVersion);
}

if (!dryRun) {
  run('pnpm', ['changelog']);
  console.log(`Changelog generated for root version ${rootNextVersion}`);
}

console.log(
  `${dryRun ? 'Dry run: version would be bumped' : 'Version bumped'} for ${requestedTargets.join(', ')}: ${Object.keys(
    PACKAGE_PATHS
  )
    .filter((packageName) => bumpedVersions.has(packageName))
    .map((packageName) => `${packageName}=${bumpedVersions.get(packageName)}`)
    .join(', ')}`
);
