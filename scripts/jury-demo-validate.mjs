#!/usr/bin/env node
// OFFLINE only: never calls APIs, accesses Docker or changes user data.
// --metadata verifies the planned structure; --assets must fail until the actual
// second member, complete and attributable photos, and explicit readiness exist.
import { readFileSync, lstatSync, realpathSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(repo, 'demo', 'jury');
const meaningful = value => typeof value === 'string' && value.trim().length > 0;
const actor = value => meaningful(value) ? value.trim() : '';
const label = (value, min, max) =>
  meaningful(value) && value.trim().length >= min && value.trim().length <= max;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function strictCalendarDate(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day &&
    date.getTime() <= Date.now();
}

function checkPhotoFile(file, expectedExt) {
  const size = statSync(file).size;
  if (size < 64 || size > MAX_IMAGE_BYTES) return false;
  const bytes = readFileSync(file);
  if (expectedExt === 'png') {
    return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.subarray(12, 16).toString('ascii') === 'IHDR';
  }
  if (expectedExt === 'jpg' || expectedExt === 'jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (expectedExt === 'webp') {
    return bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16));
  }
  return false;
}

function loadRegistry(root, errors) {
  const path = join(root, 'assets', 'provenance.json');
  try {
    const registry = JSON.parse(readFileSync(path, 'utf8'));
    if (registry?.version !== 1 || !Array.isArray(registry.credits)) {
      errors.push('Invalid provenance register structure');
      return new Map();
    }
    const credits = new Map();
    for (const record of registry.credits) {
      const id = record?.id;
      if (!meaningful(id) || credits.has(id)) {
        errors.push('Invalid/duplicate provenance credit ID: ' + String(id));
      } else credits.set(id, record);
    }
    return credits;
  } catch {
    errors.push('Missing or unreadable provenance register: ' + path);
    return new Map();
  }
}

export function inspectPlan(plan, { assets = false, directory: root = directory } = {}) {
  const errors = [], warnings = [];
  if (!plan || plan.version !== 1 || !Array.isArray(plan.listings)) {
    return { errors: ['Version 1 and listings array required'], warnings, images: 0 };
  }
  const actors = plan.actors || {};
  const owner = actor(actors.memberOwner);
  const requester = actor(actors.memberRequester);
  if (!owner || !requester || owner === requester) {
    (assets ? errors : warnings).push('Two distinct provisioned USER accounts required');
  }
  // Values that look present but contain only whitespace are always invalid.
  for (const [key, value] of Object.entries(actors)) {
    if (value !== null && !actor(value)) errors.push('Blank or invalid actor: ' + key);
  }
  const moderator = actor(actors.moderator), admin = actor(actors.admin);
  if (!moderator || !admin) errors.push('Moderator and admin required');
  if ((moderator && [owner, requester, admin].includes(moderator)) ||
      (admin && [owner, requester].includes(admin))) {
    errors.push('Moderator and admin must be distinct from USER identities and from each other');
  }
  // --metadata must reject typos too: the CI skips the strict asset gate
  // for draft manifests, never for unknown/unsupported readiness values.
  if (!['DRAFT_NOT_READY', 'READY_FOR_REVIEW'].includes(plan.readiness)) {
    errors.push('Invalid readiness state: expected DRAFT_NOT_READY or READY_FOR_REVIEW');
  }
  if (assets && plan.readiness !== 'READY_FOR_REVIEW') {
    errors.push('Manifest is not marked READY_FOR_REVIEW by the kit curator');
  }

  const credits = assets ? loadRegistry(root, errors) : new Map();
  const seenCredits = new Set(), keys = new Set(), paths = new Set();
  const listingByKey = new Map();
  for (const item of plan.listings) {
    if (typeof item?.key !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.key) || keys.has(item.key)) {
      errors.push('Duplicate/invalid listing key: ' + String(item?.key));
    }
    keys.add(item.key);
    listingByKey.set(item.key, item);
    if (!['memberOwner','memberRequester'].includes(item.owner)) errors.push('Invalid listing owner: ' + item.key);
    if (!label(item.title, 3, 120)) errors.push('Title must be 3–120 characters: ' + item.key);
    if (!label(item.description, 10, 2000)) errors.push('Description must be 10–2000 characters: ' + item.key);
    if (!['DONATION','TRADE'].includes(item.operationType)) errors.push('Invalid operation: ' + item.key);
    if (!Array.isArray(item.tradeWishes)) {
      errors.push('Missing wish list: ' + item.key);
    } else if (item.operationType === 'TRADE') {
      const wishes = item.tradeWishes;
      if (wishes.length < 5 || wishes.length > 10 ||
          wishes.some(w => !label(w, 1, 120)) ||
          new Set(wishes.map(w => typeof w === 'string' ? w.trim().toLocaleLowerCase('fr') : '')).size !== wishes.length) {
        errors.push('TRADE requires 5–10 distinct wishes of 1–120 characters: ' + item.key);
      }
    } else if (item.tradeWishes.length) errors.push('DONATION cannot have wishes: ' + item.key);
    if (!Array.isArray(item.images) || item.images.length < 5 || item.images.length > 8) {
      errors.push('Five to eight images required: ' + item.key);
      continue;
    }
    for (const [index, photo] of item.images.entries()) {
      const name = photo?.file;
      const extension = typeof name === 'string' ? name.split('.').at(-1) : '';
      const prefix = typeof item.key === 'string' ? 'assets/' + item.key + '/' : '';
      const expectedNumber = String(index + 1).padStart(2, '0');
      if (typeof name !== 'string' ||
          !/^assets\/[a-z0-9-]+\/[0-9]{2}\.(jpg|jpeg|png|webp)$/.test(name) ||
          !name.startsWith(prefix + expectedNumber + '.') || paths.has(name)) {
        errors.push('Invalid/duplicate image path or wrong listing: ' + String(name));
        continue;
      }
      paths.add(name);
      if (!assets) {
        if (!meaningful(photo.creditId) || photo.creditId === 'PENDING') warnings.push('Unverified rights: ' + name);
        continue;
      }
      const absolute = resolve(root, name);
      try {
        if (!absolute.startsWith(resolve(root) + sep) || !existsSync(absolute) ||
            !lstatSync(absolute).isFile() || !realpathSync(absolute).startsWith(realpathSync(root) + sep) ||
            !checkPhotoFile(absolute, extension)) {
          errors.push('Missing/invalid real image file: ' + name);
        }
      } catch {
        errors.push('Missing/invalid real image file: ' + name);
      }
      const creditId = photo.creditId;
      const record = credits.get(creditId);
      if (!meaningful(creditId) || creditId === 'PENDING' || !record ||
          record.file !== name || seenCredits.has(creditId) ||
          !meaningful(record.source) || !meaningful(record.author) ||
          !meaningful(record.licenseOrPermission) || !meaningful(record.conditions) ||
          record.authorizedForDemo !== true ||
          !strictCalendarDate(record.verifiedAt)) {
        errors.push('Unverified or mismatched image provenance: ' + name);
      }
      if (meaningful(creditId)) seenCredits.add(creditId);
    }
  }
  if (plan.listings.length !== 4 ||
      plan.listings.filter(x => x.operationType === 'DONATION').length !== 2 ||
      plan.listings.filter(x => x.operationType === 'TRADE').length !== 2 ||
      paths.size !== 20) errors.push('Exactly two DON, two TRADE and twenty image paths required');

  const expected = {
    'don-reject': { operation: 'DONATION', outcome: 'REJECTED' },
    'don-accept': { operation: 'DONATION', outcome: 'COMPLETED' },
    'trade-complete': { operation: 'TRADE', outcome: 'COMPLETED' },
  };
  if (!Array.isArray(plan.journeys) || plan.journeys.length !== 3 ||
      new Set(plan.journeys?.map(j => j.key)).size !== 3) {
    errors.push('Exactly three distinct DON/TROC journeys required');
  }
  for (const [key, spec] of Object.entries(expected)) {
    const journey = plan.journeys?.find(j => j.key === key);
    const target = listingByKey.get(journey?.target);
    const offered = journey?.offered ? listingByKey.get(journey.offered) : null;
    if (!journey || !target || target.operationType !== spec.operation ||
        target.owner !== 'memberOwner' || journey.outcome !== spec.outcome ||
        (spec.operation === 'TRADE'
          ? !offered || offered.operationType !== 'TRADE' ||
            offered.owner !== 'memberRequester' || journey.offered === journey.target
          : Boolean(journey.offered))) {
      errors.push('Invalid journey semantics/ownership: ' + key);
    }
  }
  return { errors, warnings, images: paths.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--metadata', '--assets'].includes(args[0])) {
    console.error('Usage: node scripts/jury-demo-validate.mjs --metadata|--assets');
    process.exitCode = 2;
  } else {
    const result = inspectPlan(JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')),
      { assets: args[0] === '--assets' });
    console.log('Jury ' + args[0] + ': ' + (result.errors.length ? 'FAIL' : 'PASS STRUCTURE ONLY') +
      '; planned photos=' + result.images + '; warnings=' + result.warnings.length);
    for (const error of result.errors) console.error('ERROR: ' + error);
    if (result.warnings.length) console.log('NOT JURY-READY: missing USER and/or media provenance');
    if (result.errors.length) process.exitCode = 1;
  }
}
