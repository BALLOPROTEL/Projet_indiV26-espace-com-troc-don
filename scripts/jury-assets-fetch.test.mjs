import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_IMAGE_BYTES,
  checkImageSignature,
  commonsDownloadUrl,
  ensureSafeParentDirs,
  isAllowedFinalUrl,
  resolveAllowedRedirect,
  resolveAssetTarget,
  validateSourceCatalog,
} from './jury-assets-fetch.mjs';

function catalog() {
  const listings = ['don-lampe','don-etagere','troc-sac','troc-livres'];
  let n = 0;
  return {
    version: 1,
    provider: 'Wikimedia Commons',
    humanReviewRequired: true,
    sources: listings.flatMap(listing => Array.from({length:5}, (_, i) => {
      n += 1;
      return {
        id: 'candidate-' + String(n).padStart(2,'0'),
        listing,
        target: 'assets/' + listing + '/' + String(i + 1).padStart(2,'0') + '.jpg',
        commonsFileName: 'Example ' + n + '.jpg',
        sourcePage: 'https://commons.wikimedia.org/wiki/File:Example_' + n + '.jpg',
        expectedAuthor: 'Author',
        expectedLicense: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        conditions: 'Attribution required',
        rightsReviewStatus: 'CANDIDATE_NOT_AUTHORIZED',
      };
    })),
  };
}

test('catalog enforces 20 candidates, five per listing and exact manifest slots', () => {
  assert.deepEqual(validateSourceCatalog(catalog()), []);

  const missing = catalog();
  missing.sources.pop();
  assert.ok(validateSourceCatalog(missing).some(x => x.includes('20 candidate')));
  assert.ok(validateSourceCatalog(missing).some(x => x.includes('5 candidates')));
  assert.ok(validateSourceCatalog(missing).some(x => x.includes('Missing manifest media slot')));

  const wrong = catalog();
  wrong.sources[0].target = 'assets/don-etagere/01.jpg';
  const errors = validateSourceCatalog(wrong);
  assert.ok(errors.some(x => x.includes('does not match manifest slot') || x.includes('duplicate target')));
  assert.ok(errors.some(x => x.includes('Missing manifest media slot')));
});

test('catalog refuses pre-authorized candidate and duplicate filename', () => {
  const broken = catalog();
  broken.sources[0].rightsReviewStatus = 'APPROVED';
  broken.sources[1].commonsFileName = broken.sources[0].commonsFileName;
  const errors = validateSourceCatalog(broken);
  assert.ok(errors.some(x => x.includes('non-authorized')));
  assert.ok(errors.some(x => x.includes('duplicate Commons filename')));
});

test('asset target stays inside jury assets', () => {
  const root = '/repo/demo/jury';
  assert.equal(resolveAssetTarget(root, 'assets/don-lampe/01.jpg'), '/repo/demo/jury/assets/don-lampe/01.jpg');
  assert.throws(() => resolveAssetTarget(root, '../secret.jpg'));
  assert.throws(() => resolveAssetTarget(root, 'assets/don-lampe/../../secret.jpg'));
});

test('safe parents reject symlinks and can create normal nested directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'jury-assets-test-'));
  const assets = join(root, 'assets');
  mkdirSync(assets);
  const outside = mkdtempSync(join(tmpdir(), 'jury-assets-outside-'));
  symlinkSync(outside, join(assets, 'bad'));
  assert.throws(() => ensureSafeParentDirs(assets, join(assets, 'bad'), { create: true }), /Unsafe asset parent/);

  const created = ensureSafeParentDirs(assets, join(assets, 'good', 'nested'), { create: true });
  assert.equal(created, join(assets, 'good', 'nested'));
});

test('download and redirect URL allowlists are strict', () => {
  assert.match(commonsDownloadUrl('A file.jpg'), /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\//);
  assert.equal(isAllowedFinalUrl('https://upload.wikimedia.org/example.jpg'), true);
  assert.equal(isAllowedFinalUrl('https://commons.wikimedia.org/wiki/File:Example.jpg'), true);
  assert.equal(isAllowedFinalUrl('http://upload.wikimedia.org/example.jpg'), false);
  assert.equal(isAllowedFinalUrl('https://evil.example/example.jpg'), false);

  assert.equal(
    resolveAllowedRedirect('https://commons.wikimedia.org/wiki/Special:Redirect/file/A.jpg', 'https://upload.wikimedia.org/A.jpg'),
    'https://upload.wikimedia.org/A.jpg'
  );
  assert.throws(
    () => resolveAllowedRedirect('https://commons.wikimedia.org/wiki/Special:Redirect/file/A.jpg', 'http://upload.wikimedia.org/A.jpg'),
    /Blocked redirect/
  );
  assert.throws(
    () => resolveAllowedRedirect('https://commons.wikimedia.org/wiki/Special:Redirect/file/A.jpg', 'https://evil.example/A.jpg'),
    /Blocked redirect/
  );
});

test('JPEG signature and max size are enforced', () => {
  const jpeg = Buffer.alloc(64);
  jpeg[0]=0xff; jpeg[1]=0xd8; jpeg[2]=0xff; jpeg[62]=0xff; jpeg[63]=0xd9;
  assert.equal(checkImageSignature(jpeg,'.jpg'), true);
  assert.equal(checkImageSignature(Buffer.alloc(63),'.jpg'), false);
  assert.equal(checkImageSignature(Buffer.alloc(MAX_IMAGE_BYTES + 1),'.jpg'), false);
});
