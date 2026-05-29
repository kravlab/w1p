#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PACKAGE_PATHS = {
  root: 'package.json',
  pwa: 'apps/pwa/package.json',
  extension: 'apps/extension/package.json',
  shared: 'packages/shared/package.json'
};
const AUTO_RELEASE_TYPES = ['none', 'patch', 'minor', 'major'];
const USAGE =
  'Usage: pnpm release -- [--dry-run] <root|pwa|extension|shared|all>... [auto|patch|minor|major|x.y.z]';

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

function isReleaseType(value) {
  return (
    value === 'auto' ||
    value === 'major' ||
    value === 'minor' ||
    value === 'patch' ||
    /^\d+\.\d+\.\d+$/.test(value)
  );
}

/**
 * Auto releases classify commits by conventional-commit semantics and assign
 * them to package targets from changed paths. Shared changes intentionally flow
 * into both apps because they consume the shared workspace package.
 */
function getAutoReleaseTypes() {
  const range = getLatestReleaseTag();
  const result = spawnSync('git', ['log', '--format=%H', range ? `${range}..HEAD` : 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const releaseTypes = new Map(Object.keys(PACKAGE_PATHS).map((target) => [target, 'none']));

  for (const hash of result.stdout.split('\n').filter(Boolean)) {
    const { subject, body } = getCommitMessage(hash);
    const commitReleaseType = getCommitReleaseType(subject, body);
    if (commitReleaseType === 'none') {
      continue;
    }

    bumpTargetReleaseType(releaseTypes, 'root', commitReleaseType);

    const affectedTargets = getAffectedPackageTargets(getCommitChangedFiles(hash));
    for (const target of affectedTargets) {
      bumpTargetReleaseType(releaseTypes, target, commitReleaseType);
    }

    if (!affectedTargets.size) {
      console.warn(`Auto release commit ${hash.slice(0, 7)} affects root only: ${subject}`);
    }
  }

  return releaseTypes;
}

function getCommitMessage(hash) {
  const result = spawnSync('git', ['show', '-s', '--format=%s%x1f%b', hash], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const [subject, body = ''] = result.stdout.split('\x1f');
  return { subject: subject.trim(), body };
}

function getCommitChangedFiles(hash) {
  const result = spawnSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', hash], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.split('\n').filter(Boolean);
}

function getLatestReleaseTag() {
  const result = spawnSync('git', ['describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    return '';
  }

  return result.stdout.trim();
}

function getCommitReleaseType(subject, body) {
  const headerMatch = /^(\w+)(?:\([^)]*\))?(!)?:/.exec(subject);
  if (!headerMatch) {
    return 'none';
  }

  if (headerMatch[2] || /\bBREAKING CHANGE:/.test(body)) {
    return 'major';
  }

  if (headerMatch[1] === 'feat') {
    return 'minor';
  }

  if (headerMatch[1] === 'fix' || headerMatch[1] === 'perf') {
    return 'patch';
  }

  return 'none';
}

function getAffectedPackageTargets(files) {
  const targets = new Set();

  for (const file of files) {
    if (file.startsWith('apps/pwa/')) {
      targets.add('pwa');
    } else if (file.startsWith('apps/extension/')) {
      targets.add('extension');
    } else if (file.startsWith('packages/shared/')) {
      targets.add('shared');
      targets.add('pwa');
      targets.add('extension');
    }
  }

  return targets;
}

function bumpTargetReleaseType(releaseTypes, target, nextReleaseType) {
  if (
    AUTO_RELEASE_TYPES.indexOf(nextReleaseType) >
    AUTO_RELEASE_TYPES.indexOf(releaseTypes.get(target) ?? 'none')
  ) {
    releaseTypes.set(target, nextReleaseType);
  }
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
const maybeReleaseType = args.at(-1);
const releaseType = maybeReleaseType && isReleaseType(maybeReleaseType) ? maybeReleaseType : 'auto';
// When the final argument is not a release type, keep every argument as a target
// and let git-cliff infer the version with the default `auto` release type.
let requestedTargets =
  releaseType === 'auto' && maybeReleaseType !== 'auto' ? args : args.slice(0, -1);

function resolveReleaseTargets(targets) {
  if (targets.includes('all')) {
    return Object.keys(PACKAGE_PATHS);
  }

  const resolvedTargets = new Set(targets);
  resolvedTargets.add('root');

  return Object.keys(PACKAGE_PATHS).filter((packageName) => resolvedTargets.has(packageName));
}

const bumpedVersions = new Map();
const autoReleaseTypes = releaseType === 'auto' ? getAutoReleaseTypes() : new Map();

if (!requestedTargets.length && releaseType === 'auto') {
  requestedTargets = Object.keys(PACKAGE_PATHS).filter(
    (packageName) => (autoReleaseTypes.get(packageName) ?? 'none') !== 'none'
  );
}

if (!requestedTargets.length) {
  throw new Error(USAGE);
}

for (const target of requestedTargets) {
  if (target !== 'all' && !(target in PACKAGE_PATHS)) {
    throw new Error(`Unknown target: ${target}`);
  }
}

const releaseTargets = resolveReleaseTargets(requestedTargets);

for (const packageName of releaseTargets) {
  const resolvedReleaseType =
    releaseType === 'auto' ? (autoReleaseTypes.get(packageName) ?? 'none') : releaseType;

  if (resolvedReleaseType === 'none') {
    continue;
  }

  const packageJson = readJson(PACKAGE_PATHS[packageName]);
  const nextVersion = bumpVersion(packageJson.version, resolvedReleaseType);
  setPackageVersion(PACKAGE_PATHS[packageName], nextVersion, { dryRun });
  bumpedVersions.set(packageName, nextVersion);
}

if (!dryRun) {
  if (bumpedVersions.has('root')) {
    run('pnpm', ['changelog']);
    console.log(`Changelog generated for root version ${bumpedVersions.get('root')}`);
  } else {
    console.log('Changelog skipped because auto release found no root version bump');
  }
}

console.log(
  `${dryRun ? 'Dry run: version would be bumped' : 'Version bumped'} for ${requestedTargets.join(', ')}: ${Object.keys(
    PACKAGE_PATHS
  )
    .filter((packageName) => bumpedVersions.has(packageName))
    .map((packageName) => `${packageName}=${bumpedVersions.get(packageName)}`)
    .join(', ')}`
);
