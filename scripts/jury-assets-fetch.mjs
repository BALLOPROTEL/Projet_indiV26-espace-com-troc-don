#!/usr/bin/env node
import {
  createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync,
  realpathSync, renameSync, rmSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const juryRoot = resolve(repo, 'demo', 'jury');
const assetsRoot = resolve(juryRoot, 'assets');
const sourceCatalogPath = resolve(assetsRoot, 'sources.json');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_RATE_LIMIT_RETRIES = 5;
export const BASE_RETRY_DELAY_MS = 2000;
export const MAX_RETRY_DELAY_MS = 60000;
const configuredServerRetryAfterMs = Number(process.env.JURY_ASSET_MAX_SERVER_RETRY_AFTER_MS || '');
export const MAX_SERVER_RETRY_AFTER_MS =
  Number.isSafeInteger(configuredServerRetryAfterMs) &&
  configuredServerRetryAfterMs >= BASE_RETRY_DELAY_MS &&
  configuredServerRetryAfterMs <= 10 * 60 * 1000
    ? configuredServerRetryAfterMs
    : 60000;
const configuredBetweenFileDelayMs = Number(process.env.JURY_ASSET_BETWEEN_FILE_DELAY_MS || '');
export const BETWEEN_FILE_DELAY_MS =
  Number.isSafeInteger(configuredBetweenFileDelayMs) &&
  configuredBetweenFileDelayMs >= 1000 &&
  configuredBetweenFileDelayMs <= 10000
    ? configuredBetweenFileDelayMs
    : 1500;

const LISTINGS = new Set(['don-lampe', 'don-etagere', 'troc-sac', 'troc-livres']);
const ALLOWED_FINAL_HOSTS = new Set(['commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org']);
const EXPECTED_TARGETS = new Set(
  [...LISTINGS].flatMap(listing =>
    Array.from({ length: 5 }, (_, i) =>
      `assets/${listing}/${String(i + 1).padStart(2, '0')}.jpg`
    )
  )
);
const activeParts = new Set();

export function commonsDownloadUrl(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('Commons filename required');
  return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(fileName);
}

export function commonsImageInfoApiUrl(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 50) {
    throw new Error('Commons imageinfo requires 1 to 50 sources');
  }
  const titles = sources.map(source => {
    if (typeof source?.commonsFileName !== 'string' || !source.commonsFileName.trim()) {
      throw new Error('Commons filename required for imageinfo');
    }
    return 'File:' + source.commonsFileName;
  });

  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size');
  url.searchParams.set('iiurlwidth', '1600');
  url.searchParams.set('titles', titles.join('|'));
  return url.toString();
}

function commonsFileKey(value) {
  return String(value || '')
    .replace(/^File:/i, '')
    .replaceAll('_', ' ')
    .trim()
    .normalize('NFC');
}

export function extractResolvedMediaUrls(payload, sources) {
  const pages = payload?.query?.pages;
  if (!Array.isArray(pages)) throw new Error('Invalid Commons imageinfo response');

  const byFile = new Map();
  for (const page of pages) {
    if (page?.missing === true) continue;
    const info = page?.imageinfo?.[0];
    const originalSize = Number(info?.size);
    const canUseOriginal =
      typeof info?.url === 'string' &&
      Number.isFinite(originalSize) &&
      originalSize > 0 &&
      originalSize <= MAX_IMAGE_BYTES;
    const mediaUrl = canUseOriginal ? info.url : (info?.thumburl || info?.url);
    if (typeof page?.title !== 'string' || typeof mediaUrl !== 'string') continue;
    const parsed = new URL(mediaUrl);
    if (parsed.protocol !== 'https:' ||
        !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(parsed.hostname)) {
      throw new Error('Commons imageinfo returned disallowed media URL: ' + mediaUrl);
    }
    const key = commonsFileKey(page.title);
    if (byFile.has(key)) {
      throw new Error('Commons imageinfo returned duplicate canonical title: ' + page.title);
    }
    byFile.set(key, mediaUrl);
  }

  const resolved = new Map();
  for (const source of sources) {
    const mediaUrl = byFile.get(commonsFileKey(source.commonsFileName));
    if (!mediaUrl) throw new Error('Commons imageinfo did not resolve: ' + source.commonsFileName);
    resolved.set(source.id, mediaUrl);
  }
  if (resolved.size !== sources.length) throw new Error('Commons imageinfo resolution count mismatch');
  const uniqueMediaUrls = new Set(resolved.values());
  if (uniqueMediaUrls.size !== sources.length) {
    throw new Error('Commons imageinfo resolved duplicate media URLs for distinct candidates');
  }
  return resolved;
}

export function isAllowedFinalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_FINAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) return null;
  return Math.max(0, dateMs - nowMs);
}

export function rateLimitDelayMs(attempt, retryAfterValue, nowMs = Date.now()) {
  const retryAfterMs = parseRetryAfterMs(retryAfterValue, nowMs);
  if (retryAfterMs !== null) return Math.max(retryAfterMs, BASE_RETRY_DELAY_MS);
  return Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), MAX_RETRY_DELAY_MS);
}

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

export function resolveAllowedRedirect(currentUrl, location) {
  if (typeof location !== 'string' || !location.trim()) throw new Error('Redirect location missing');
  const next = new URL(location, currentUrl).toString();
  if (!isAllowedFinalUrl(next)) throw new Error('Blocked redirect target: ' + next);
  return next;
}

export function resolveAssetTarget(root, target) {
  if (typeof target !== 'string' || !/^assets\/[a-z0-9-]+\/[0-9]{2}\.jpg$/.test(target)) {
    throw new Error('Invalid jury asset target: ' + String(target));
  }
  const absolute = resolve(root, target);
  const expectedRoot = resolve(root, 'assets');
  if (!absolute.startsWith(expectedRoot + sep)) throw new Error('Asset target escapes jury assets root');
  return absolute;
}

export function ensureSafeParentDirs(root, targetDir, { create = false } = {}) {
  const rootReal = realpathSync(root);
  const lexicalTarget = resolve(targetDir);
  const rel = relative(resolve(root), lexicalTarget);
  if (!rel || rel.startsWith('..' + sep) || rel === '..' || rel.startsWith(sep)) {
    throw new Error('Parent directory escapes jury assets root');
  }

  let current = rootReal;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('Unsafe asset parent: ' + current);
      }
      const currentReal = realpathSync(current);
      if (currentReal !== rootReal && !currentReal.startsWith(rootReal + sep)) {
        throw new Error('Asset parent resolves outside jury assets root');
      }
    } else {
      if (!create) throw new Error('Missing asset parent: ' + current);
      mkdirSync(current, { mode: 0o755 });
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('Unsafe created asset parent: ' + current);
      }
    }
  }
  return current;
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
      if (!EXPECTED_TARGETS.has(source.target) ||
          !source.target.startsWith('assets/' + source.listing + '/')) {
        errors.push('Candidate target does not match manifest slot: ' + source.target);
      }
    }

    if (typeof source?.commonsFileName !== 'string' || !source.commonsFileName.endsWith('.jpg') ||
        names.has(source.commonsFileName)) {
      errors.push('Invalid/duplicate Commons filename: ' + String(source?.commonsFileName));
    } else names.add(source.commonsFileName);

    if (!isAllowedFinalUrl(source?.sourcePage)) errors.push('Invalid Commons source page: ' + String(source?.sourcePage));
    if (typeof source?.expectedAuthor !== 'string' || !source.expectedAuthor.trim()) errors.push('Expected author missing: ' + source?.id);
    if (typeof source?.expectedLicense !== 'string' || !source.expectedLicense.trim()) errors.push('Expected license missing: ' + source?.id);
    if (typeof source?.conditions !== 'string' || !source.conditions.trim()) errors.push('Reuse conditions missing: ' + source?.id);
    if (!isAllowedFinalUrl(source?.licenseUrl) &&
        !String(source?.licenseUrl || '').startsWith('https://creativecommons.org/')) {
      errors.push('Invalid license URL: ' + source?.id);
    }
    if (source?.rightsReviewStatus !== 'CANDIDATE_NOT_AUTHORIZED') {
      errors.push('Candidate must remain non-authorized until human review: ' + source?.id);
    }
  }

  for (const listing of LISTINGS) {
    if (counts.get(listing) !== 5) errors.push('Exactly 5 candidates required for ' + listing);
  }
  for (const expected of EXPECTED_TARGETS) {
    if (!targets.has(expected)) errors.push('Missing manifest media slot: ' + expected);
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

async function requestWithRateLimitRetry(url) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: { 'user-agent': 'ProjetIndiv26-jury-media-review/1.0' },
    });

    if (response.status !== 429) return response;

    const retryAfter = response.headers.get('retry-after');
    await response.body?.cancel().catch(() => {});

    if (attempt === MAX_RATE_LIMIT_RETRIES) {
      throw new Error('Commons rate limit persisted after ' + (attempt + 1) + ' attempts');
    }

    const delayMs = rateLimitDelayMs(attempt, retryAfter);
    if (retryAfter && delayMs > MAX_SERVER_RETRY_AFTER_MS) {
      throw new Error(
        'Commons requested Retry-After ' + Math.ceil(delayMs / 1000) +
        's, above the operator limit of ' + Math.ceil(MAX_SERVER_RETRY_AFTER_MS / 1000) +
        's; aborting without an early retry'
      );
    }
    console.warn(
      'RATE LIMIT 429: retry ' + (attempt + 1) + '/' + MAX_RATE_LIMIT_RETRIES +
      ' after ' + Math.ceil(delayMs / 1000) + 's'
    );
    await sleep(delayMs);
  }
  throw new Error('Unexpected rate-limit retry state');
}

async function fetchWithAllowedRedirects(initialUrl, maxRedirects = 5) {
  let current = initialUrl;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (!isAllowedFinalUrl(current)) throw new Error('Blocked request target: ' + current);
    const response = await requestWithRateLimitRetry(current);

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount === maxRedirects) {
        await response.body?.cancel().catch(() => {});
        throw new Error('Too many redirects');
      }
      const next = resolveAllowedRedirect(current, response.headers.get('location'));
      await response.body?.cancel().catch(() => {});
      current = next;
      continue;
    }
    return response;
  }
  throw new Error('Redirect loop');
}

async function resolveMediaUrls(sources) {
  const response = await fetchWithAllowedRedirects(commonsImageInfoApiUrl(sources));
  if (!response.ok || !response.body) {
    throw new Error('Commons imageinfo failed (' + response.status + ')');
  }
  const payload = await response.json();
  return extractResolvedMediaUrls(payload, sources);
}

async function fetchOne(source, mediaUrl) {
  const target = resolveAssetTarget(juryRoot, source.target);
  ensureSafeParentDirs(assetsRoot, dirname(target), { create: true });

  if (verifyExistingFile(target)) {
    console.log('SKIP valid existing: ' + source.target);
    return;
  }

  const part = target + '.part-' + process.pid;
  rmSync(part, { force: true });
  activeParts.add(part);

  try {
    if (typeof mediaUrl !== 'string') throw new Error('Resolved media URL missing: ' + source.id);
    const response = await fetchWithAllowedRedirects(mediaUrl);
    if (!response.ok || !response.body) {
      throw new Error('Download failed (' + response.status + '): ' + source.commonsFileName);
    }

    const length = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(length) && length > MAX_IMAGE_BYTES) {
      await response.body.cancel().catch(() => {});
      throw new Error('Image exceeds 5 MiB: ' + source.commonsFileName);
    }

    let total = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        total += chunk.length;
        if (total > MAX_IMAGE_BYTES) callback(new Error('Image exceeds 5 MiB while streaming'));
        else callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      createWriteStream(part, { flags: 'wx', mode: 0o644 })
    );

    const bytes = readFileSync(part);
    if (!checkImageSignature(bytes, extname(target))) throw new Error('Downloaded file signature is invalid');

    ensureSafeParentDirs(assetsRoot, dirname(target), { create: false });
    renameSync(part, target);
    activeParts.delete(part);
    console.log('FETCHED ' + source.target + ' <- ' + source.commonsFileName);
  } catch (error) {
    rmSync(part, { force: true });
    activeParts.delete(part);
    throw error;
  }
}

function cleanupActiveParts() {
  for (const part of activeParts) {
    try { rmSync(part, { force: true }); } catch {}
  }
  activeParts.clear();
}

function installSignalCleanup() {
  for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.once(signal, () => {
      cleanupActiveParts();
      process.exit(exitCode);
    });
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

  installSignalCleanup();
  const mediaUrls = await resolveMediaUrls(catalog.sources);
  console.log('Resolved 20 Commons media URLs in one imageinfo batch; originals are preferred when <= 5 MiB.');
  for (const [index, source] of catalog.sources.entries()) {
    await fetchOne(source, mediaUrls.get(source.id));
    if (index < catalog.sources.length - 1) await sleep(BETWEEN_FILE_DELAY_MS);
  }
  cleanupActiveParts();

  console.log('');
  console.log('[OK] 20 candidate files downloaded for HUMAN REVIEW ONLY.');
  console.log('No provenance authorization or READY_FOR_REVIEW state was changed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    cleanupActiveParts();
    console.error('[FAIL] ' + error.message);
    process.exitCode = 1;
  });
}
