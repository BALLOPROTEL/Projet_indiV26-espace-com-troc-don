#!/usr/bin/env node
import { createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const juryRoot = resolve(repo, 'demo', 'jury');
const assetsRoot = resolve(juryRoot, 'assets');
const sourceCatalogPath = resolve(assetsRoot, 'sources.json');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const LISTINGS = new Set(['don-lampe', 'don-etagere', 'troc-sac', 'troc-livres']);
const ALLOWED_FINAL_HOSTS = new Set(['commons.wikimedia.org', 'upload.wikimedia.org']);

export function commonsDownloadUrl(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('Commons filename required');
  return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(fileName);
}

export function isAllowedFinalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_FINAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function resolveAssetTarget(root, target) {
  if (typeof target !== 'string' || !/^assets\/[a-z0-9-]+\/[0-9]{2}\.(jpg|jpeg|png|webp)$/.test(target)) {
    throw new Error('Invalid jury asset target: ' + String(target));
  }
  const absolute = resolve(root, target);
  const expectedRoot = resolve(root, 'assets');
  if (!absolute.startsWith(expectedRoot + sep)) throw new Error('Asset target escapes jury assets root');
  return absolute;
}

export function checkImageSignature(bytes, extension) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 || bytes.length > MAX_IMAGE_BYTES) return false;
  const ext = extension.replace(/^\./, '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (ext === 'png') {
    return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.subarray(12, 16).toString('ascii') === 'IHDR';
  }
  if (ext === 'webp') {
    return bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16));
  }
  return false;
}

export function validateSourceCatalog(catalog) {
  const errors = [];
  if (catalog?.version !== 1 || catalog?.provider !== 'Wikimedia Commons' ||
      catalog?.humanReviewRequired !== true || !Array.isArray(catalog.sources)) {
    return ['Invalid media source catalog header'];
  }
  if (catalog.sources.length !== 20) errors.push('Exactly 20 candidate sources are required');
  const ids = new Set(), targets = new Set(), names = new Set(), counts = new Map();
  for (const source of catalog.sources) {
    if (!/^candidate-[0-9]{2}$/.test(source?.id || '') || ids.has(source.id)) {
      errors.push('Invalid/duplicate candidate id: ' + String(source?.id));
    } else ids.add(source.id);
    if (!LISTINGS.has(source?.listing)) errors.push('Invalid listing: ' + String(source?.listing));
    counts.set(source?.listing, (counts.get(source?.listing) || 0) + 1);
    if (typeof source?.target !== 'string' || targets.has(source.target)) {
      errors.push('Invalid/duplicate target: ' + String(source?.target));
    } else {
      targets.add(source.target);
      try { resolveAssetTarget(juryRoot, source.target); } catch (error) { errors.push(error.message); }
    }
    if (typeof source?.commonsFileName !== 'string' || !source.commonsFileName.endsWith('.jpg') ||
        names.has(source.commonsFileName)) {
      errors.push('Invalid/duplicate Commons filename: ' + String(source?.commonsFileName));
    } else names.add(source.commonsFileName);
    if (!isAllowedFinalUrl(source?.sourcePage)) errors.push('Invalid Commons source page: ' + String(source?.sourcePage));
    if (typeof source?.expectedAuthor !== 'string' || !source.expectedAuthor.trim()) errors.push('Expected author missing: ' + source?.id);
    if (typeof source?.expectedLicense !== 'string' || !source.expectedLicense.trim()) errors.push('Expected license missing: ' + source?.id);
    if (typeof source?.conditions !== 'string' || !source.conditions.trim()) errors.push('Reuse conditions missing: ' + source?.id);
    if (!isAllowedFinalUrl(source?.licenseUrl) && !String(source?.licenseUrl || '').startsWith('https://creativecommons.org/')) {
      errors.push('Invalid license URL: ' + source?.id);
    }
    if (source?.rightsReviewStatus !== 'CANDIDATE_NOT_AUTHORIZED') {
      errors.push('Candidate must remain non-authorized until human review: ' + source?.id);
    }
  }
  for (const listing of LISTINGS) {
    if (counts.get(listing) !== 5) errors.push('Exactly 5 candidates required for ' + listing);
  }
  return errors;
}

function verifyExistingFile(path) {
  if (!existsSync(path)) return false;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Existing candidate is not a regular file: ' + path);
  const bytes = readFileSync(path);
  if (!checkImageSignature(bytes, extname(path))) throw new Error('Existing candidate is invalid: ' + path);
  return true;
}

async function fetchOne(source) {
  const target = resolveAssetTarget(juryRoot, source.target);
  if (verifyExistingFile(target)) {
    console.log('SKIP valid existing: ' + source.target);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  const part = target + '.part-' + process.pid;
  rmSync(part, { force: true });

  const response = await fetch(commonsDownloadUrl(source.commonsFileName), {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: { 'user-agent': 'ProjetIndiv26-jury-media-review/1.0' },
  });
  if (!response.ok || !response.body) throw new Error('Download failed (' + response.status + '): ' + source.commonsFileName);
  if (!isAllowedFinalUrl(response.url)) throw new Error('Unexpected redirect host: ' + response.url);
  const length = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES) throw new Error('Image exceeds 5 MiB: ' + source.commonsFileName);

  let total = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) callback(new Error('Image exceeds 5 MiB while streaming'));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(part, { flags: 'wx', mode: 0o644 }));
    const bytes = readFileSync(part);
    if (!checkImageSignature(bytes, extname(target))) throw new Error('Downloaded file signature is invalid');
    renameSync(part, target);
    console.log('FETCHED ' + source.target + ' <- ' + source.commonsFileName);
  } catch (error) {
    rmSync(part, { force: true });
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  const catalog = JSON.parse(readFileSync(sourceCatalogPath, 'utf8'));
  const errors = validateSourceCatalog(catalog);
  if (errors.length) {
    for (const error of errors) console.error('ERROR: ' + error);
    process.exitCode = 1;
    return;
  }
  if (mode === '--check') {
    console.log('Jury media candidate catalog: PASS; candidates=20; authorized=0');
    return;
  }
  if (mode !== '--fetch' || process.argv.length !== 3) {
    console.error('Usage: node scripts/jury-assets-fetch.mjs --check|--fetch');
    process.exitCode = 2;
    return;
  }
  if (process.env.JURY_ASSET_FETCH_CONFIRMED !== 'commons-review') {
    console.error('[FAIL] Set JURY_ASSET_FETCH_CONFIRMED=commons-review to download review candidates.');
    process.exitCode = 1;
    return;
  }
  for (const source of catalog.sources) await fetchOne(source);
  console.log('');
  console.log('[OK] 20 candidate files downloaded for HUMAN REVIEW ONLY.');
  console.log('No provenance authorization or READY_FOR_REVIEW state was changed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('[FAIL] ' + error.message);
    process.exitCode = 1;
  });
}
