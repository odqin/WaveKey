// scripts/sync-version.mjs
// Reads the version from the pushed git tag (e.g. "v0.1.4" -> "0.1.4")
// and writes it into package.json, src-tauri/tauri.conf.json, and
// src-tauri/Cargo.toml so you never have to hand-edit version numbers
// before a release again. The git tag is the single source of truth.

import { readFileSync, writeFileSync } from 'fs';

const rawTag = process.env.GITHUB_REF_NAME; // e.g. "v0.1.4"
if (!rawTag) {
  console.error('GITHUB_REF_NAME not set — this script must run in CI on a tag push.');
  process.exit(1);
}

const version = rawTag.replace(/^v/, ''); // "0.1.4"
console.log(`Syncing project version to: ${version}`);

// package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// src-tauri/tauri.conf.json
const tauriConfPath = 'src-tauri/tauri.conf.json';
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

// src-tauri/Cargo.toml — simple regex replace since it's TOML, not JSON
const cargoTomlPath = 'src-tauri/Cargo.toml';
let cargoToml = readFileSync(cargoTomlPath, 'utf-8');
cargoToml = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);
writeFileSync(cargoTomlPath, cargoToml);

console.log('Version sync complete.');
