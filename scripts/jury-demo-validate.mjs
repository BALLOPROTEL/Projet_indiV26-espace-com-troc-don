#!/usr/bin/env node
// Offline manifest check ONLY. No API, Docker, account provisioning, data reset or upload.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(repo, 'demo', 'jury');

export function inspectPlan(plan, { assets = false, directory: root = directory } = {}) {
  const errors = [], warnings = [];
  if (!plan || plan.version !== 1 || !Array.isArray(plan.listings)) {
    return { errors: ['Version 1 and listings array required'], warnings, images: 0 };
  }
  const actors = plan.actors || {};
  if (!actors.memberOwner || !actors.memberRequester || actors.memberOwner === actors.memberRequester) {
    (assets ? errors : warnings).push('Two distinct provisioned USER accounts required');
  }
  if (!actors.moderator || !actors.admin) errors.push('Moderator and admin required');
  const keys = new Set(), paths = new Set();
  for (const item of plan.listings) {
    if (typeof item.key !== 'string' || !/^[a-z0-9-]+$/.test(item.key) || keys.has(item.key)) {
      errors.push('Duplicate/invalid listing key');
    }
    keys.add(item.key);
    if (!['memberOwner','memberRequester'].includes(item.owner)) errors.push('Invalid listing owner: ' + item.key);
    if (typeof item.title !== 'string' || item.title.length < 8) errors.push('Invalid title: ' + item.key);
    if (!['DONATION','TRADE'].includes(item.operationType)) errors.push('Invalid operation: ' + item.key);
    if (!Array.isArray(item.tradeWishes)) errors.push('Missing wish list: ' + item.key);
    else if (item.operationType === 'TRADE') {
      const wishes = item.tradeWishes.map(v => String(v).trim().toLocaleLowerCase('fr'));
      if (wishes.length < 5 || new Set(wishes).size !== wishes.length) {
        errors.push('TRADE requires five distinct wishes: ' + item.key);
      }
    } else if (item.tradeWishes.length) errors.push('DONATION cannot have wishes: ' + item.key);
    if (!Array.isArray(item.images) || item.images.length < 5 || item.images.length > 8) {
      errors.push('Five to eight images required: ' + item.key);
      continue;
    }
    for (const photo of item.images) {
      const name = photo?.file;
      if (typeof name !== 'string' || !/^assets\/[a-z0-9-]+\/[0-9]{2}\.(jpg|png|webp)$/.test(name) || paths.has(name)) {
        errors.push('Invalid/duplicate image path: ' + String(name));
        continue;
      }
      paths.add(name);
      if (assets) {
        const absolute = resolve(root, name);
        if (!absolute.startsWith(resolve(root) + sep) || !existsSync(absolute)) errors.push('Missing asset: ' + name);
        if (!photo.creditId || photo.creditId === 'PENDING') errors.push('Unverified image rights: ' + name);
      } else if (photo.creditId === 'PENDING') warnings.push('Unverified rights: ' + name);
    }
  }
  if (plan.listings.filter(x => x.operationType === 'DONATION').length < 2 ||
      plan.listings.filter(x => x.operationType === 'TRADE').length < 2) errors.push('Two DON and two TRADE listings required');
  for (const key of ['don-reject','don-accept','trade-complete']) {
    if (!plan.journeys?.some(j => j.key === key && keys.has(j.target) && (!j.offered || keys.has(j.offered)))) {
      errors.push('Missing or invalid journey: ' + key);
    }
  }
  return { errors, warnings, images: paths.size };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.slice(2);
  if (mode.length !== 1 || !['--metadata','--assets'].includes(mode[0])) {
    console.error('Usage: node scripts/jury-demo-validate.mjs --metadata|--assets');
    process.exitCode = 2;
  } else {
    const result = inspectPlan(JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')), { assets: mode[0] === '--assets' });
    console.log('Jury ' + mode[0] + ': ' + (result.errors.length ? 'FAIL' : 'PASS STRUCTURE ONLY') +
      '; planned photos=' + result.images + '; warnings=' + result.warnings.length);
    for (const error of result.errors) console.error('ERROR: ' + error);
    if (result.warnings.length) console.log('NOT JURY-READY: missing member identity and/or media provenance');
    if (result.errors.length) process.exitCode = 1;
  }
}
