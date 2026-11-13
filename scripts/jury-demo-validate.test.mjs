import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectPlan } from './jury-demo-validate.mjs';

// Purposefully independent of demo/jury/manifest.json: the real kit may become
// READY_FOR_REVIEW without changing the expectations of draft/error tests.
const makeListing = (key, operationType, owner, wishes = []) => ({
  key,
  title: 'Article de test ' + key,
  description: 'Objet réutilisable pour scénario automatisé, sans utilisateur réel.',
  operationType, owner, tradeWishes: wishes,
  images: Array.from({ length: 5 }, (_, i) => ({
    file: 'assets/' + key + '/' + String(i + 1).padStart(2, '0') + '.jpg',
    creditId: 'PENDING',
  })),
});
const plan = {
  version: 1,
  readiness: 'DRAFT_NOT_READY',
  actors: {
    memberOwner: 'demo-user',
    memberRequester: null,
    moderator: 'demo-moderator',
    admin: 'demo-admin',
  },
  listings: [
    makeListing('don-lampe', 'DONATION', 'memberOwner'),
    makeListing('don-etagere', 'DONATION', 'memberOwner'),
    makeListing('troc-sac', 'TRADE', 'memberOwner', ['Livre', 'Lampe', 'Jeu', 'Pochette', 'Chaise']),
    makeListing('troc-livres', 'TRADE', 'memberRequester', ['Sac', 'Tapis', 'Boîte', 'Casque', 'Étagère']),
  ],
  journeys: [
    { key: 'don-reject', target: 'don-lampe', outcome: 'REJECTED' },
    { key: 'don-accept', target: 'don-etagere', outcome: 'COMPLETED' },
    { key: 'trade-complete', target: 'troc-sac', offered: 'troc-livres', outcome: 'COMPLETED' },
  ],
};
const modify = fn => { const value = structuredClone(plan); fn(value); return value; };
const invalid = (value, needle) =>
  assert.ok(inspectPlan(value).errors.some(e => e.includes(needle)),
    'Expected error containing "' + needle + '"');

test('draft structure passes but warns about missing second USER and rights', () => {
  const v = inspectPlan(plan);
  assert.deepEqual(v.errors, []);
  assert.equal(v.images, 20);
  assert.ok(v.warnings.some(x => x.includes('Two distinct')));
  assert.ok(v.warnings.some(x => x.includes('rights')));
});
test('strict gate fails on missing media, provenance and readiness', () => {
  const v = inspectPlan(plan, { assets: true, directory: '/nonexistent-jury-kit' });
  assert.ok(v.errors.some(x => x.includes('Two distinct')));
  assert.ok(v.errors.some(x => x.includes('image')));
  assert.ok(v.errors.some(x => x.includes('provenance')));
  assert.ok(v.errors.some(x => x.includes('READY_FOR_REVIEW')));
});

test('metadata rejects unsupported readiness states before any conditional asset gate', () => {
  for (const readiness of ['READY_FOR_REVEIW', 'PENDING', '', null, undefined]) {
    const invalidState = modify(p => { p.readiness = readiness; });
    const metadata = inspectPlan(invalidState);
    assert.ok(metadata.errors.some(e => e.includes('Invalid readiness state')),
      'Metadata must reject unknown readiness: ' + String(readiness));
  }
  assert.deepEqual(inspectPlan(plan).errors, []);
  const ready = modify(p => { p.readiness = 'READY_FOR_REVIEW'; });
  assert.ok(!inspectPlan(ready).errors.some(e => e.includes('Invalid readiness')));
});

test('a completed manifest does not invalidate the draft test fixture', () => {
  const completed = modify(p => {
    p.readiness = 'READY_FOR_REVIEW';
    p.actors.memberRequester = 'demo-member-2';
    p.listings.forEach((item, index) => item.images.forEach((photo, photoIndex) => {
      photo.creditId = 'verified-' + index + '-' + photoIndex;
    }));
  });
  const metadata = inspectPlan(completed);
  assert.deepEqual(metadata.errors, []);
  assert.deepEqual(metadata.warnings, []);
  const strict = inspectPlan(completed, { assets: true, directory: '/nonexistent-jury-kit' });
  assert.ok(!strict.errors.some(e => e.includes('Two distinct')));
  assert.ok(!strict.errors.some(e => e.includes('READY_FOR_REVIEW')));
  assert.ok(strict.errors.some(e => e.includes('Missing')));
});

test('moderator and admin must remain distinct from both members and one another', () => {
  invalid(modify(p => { p.actors.moderator = ' demo-user '; }), 'distinct from USER');
  invalid(modify(p => { p.actors.admin = 'demo-user'; }), 'distinct from USER');
  invalid(modify(p => {
    p.actors.memberRequester = 'demo-member-2';
    p.actors.moderator = 'demo-member-2';
  }), 'distinct from USER');
  invalid(modify(p => { p.actors.admin = 'demo-moderator'; }), 'distinct from USER');
});

test('reject duplicate image names and wrong listing photo folders', () => {
  invalid(modify(p => { p.listings[1].images[0].file = p.listings[0].images[0].file; }), 'image path');
  invalid(modify(p => { p.listings[2].images[0].file = 'assets/don-lampe/01.jpg'; }), 'wrong listing');
});
test('reject TRADE wish limits and invalid Catalog title/description', () => {
  invalid(modify(p => { p.listings[2].tradeWishes = ['One wish']; }), '5–10');
  invalid(modify(p => { p.listings[2].tradeWishes = Array.from({length: 11}, (_,i) => 'Wish '+i); }), '5–10');
  invalid(modify(p => { p.listings[2].tradeWishes[0] = ' '; }), '5–10');
  invalid(modify(p => { p.listings[0].title = 'x'.repeat(121); }), 'Title');
  invalid(modify(p => { delete p.listings[0].description; }), 'Description');
});
test('reject blank identities in every mode and same USER actor', () => {
  invalid(modify(p => { p.actors.moderator = ' '; }), 'Blank or invalid actor');
  const b = modify(p => { p.actors.memberRequester = ' '; });
  invalid(b, 'Blank or invalid actor');
  assert.ok(inspectPlan(b, {assets:true}).errors.some(e=>e.includes('Two distinct')));
  const c = modify(p=>{p.actors.memberRequester=' demo-user ';});
  assert.ok(inspectPlan(c, {assets:true}).errors.some(e=>e.includes('Two distinct')));
});
test('reject wrong DON/TROC operations, outcomes and owners', () => {
  invalid(modify(p=>{p.journeys[0].target='troc-sac';}), 'Invalid journey');
  invalid(modify(p=>{p.journeys[1].outcome='REJECTED';}), 'Invalid journey');
  invalid(modify(p=>{p.journeys[2].offered='don-lampe';}), 'Invalid journey');
  invalid(modify(p=>{p.listings[3].owner='memberOwner';}), 'Invalid journey');
});
test('reject extra listings or journeys changing the deterministic kit', () => {
  invalid(modify(p => { p.listings.push({...p.listings[0],key:'extra-don'}); }), 'Exactly two DON');
  invalid(modify(p => { p.journeys.push({...p.journeys[0],key:'surprise'}); }), 'Exactly three');
});
test('strict gate rejects zero-byte, directories, and forged registry credits', () => {
  const temp = mkdtempSync(join(tmpdir(), 'jury-validate-'));
  try {
    const v = modify(p=>{p.actors.memberRequester='demo-user-2';p.readiness='READY_FOR_REVIEW';});
    const first = v.listings[0].images[0];
    first.creditId = 'FABRICATED';
    mkdirSync(join(temp,'assets','don-lampe'), { recursive: true });
    writeFileSync(join(temp,first.file), '');
    const registry={version:1,credits:[{
      id:'FABRICATED',file:first.file,author:'A',source:'B',licenseOrPermission:'C',
      verifiedAt:'2026-10-16',conditions:'D',authorizedForDemo:true,
    }]};
    writeFileSync(join(temp,'assets','provenance.json'), JSON.stringify(registry));
    const result=inspectPlan(v,{assets:true,directory:temp});
    assert.ok(result.errors.some(x=>x.includes('Missing/invalid real image file')));
    assert.ok(result.errors.some(x=>x.includes('Unverified or mismatched image provenance')));
    // Replacing a file by a directory may never satisfy the image validator.
    rmSync(join(temp,first.file));
    mkdirSync(join(temp,first.file));
    const result2=inspectPlan(v,{assets:true,directory:temp});
    assert.ok(result2.errors.some(x=>x.includes('Missing/invalid real image file')));
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
test('a valid-looking credit ID is not enough without a matching complete registry', () => {
  const v=modify(p=>{p.actors.memberRequester='demo-user-2';p.readiness='READY_FOR_REVIEW';p.listings[0].images[0].creditId='MADE_UP';});
  const errors=inspectPlan(v,{assets:true}).errors;
  assert.ok(errors.some(e=>e.includes('provenance')));
});

test('strict asset gate rejects image files larger than the application 5 MiB limit', () => {
  const temp = mkdtempSync(join(tmpdir(), 'jury-size-'));
  try {
    const p = modify(value => {
      value.actors.memberRequester = 'demo-user-2';
      value.readiness = 'READY_FOR_REVIEW';
      value.listings[0].images[0].creditId = 'test-credit';
    });
    const fileName = p.listings[0].images[0].file;
    mkdirSync(join(temp, 'assets', 'don-lampe'), { recursive: true });
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
    bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
    bytes[bytes.length - 2] = 0xff; bytes[bytes.length - 1] = 0xd9;
    writeFileSync(join(temp, fileName), bytes);
    writeFileSync(join(temp, 'assets', 'provenance.json'), JSON.stringify({
      version: 1, credits: [{
        id: 'test-credit', file: fileName, author: 'Test author', source: 'Fixture',
        licenseOrPermission: 'Local test fixture', conditions: 'Test only',
        authorizedForDemo: true, verifiedAt: '2026-10-16',
      }],
    }));
    const result = inspectPlan(p, { assets: true, directory: temp });
    assert.ok(result.errors.includes('Missing/invalid real image file: ' + fileName),
      'Oversize image must fail despite valid JPG signature and credit');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('strict provenance checks reject impossible dates but allow valid leap dates', () => {
  const temp = mkdtempSync(join(tmpdir(), 'jury-date-'));
  try {
    const p = modify(value => {
      value.actors.memberRequester = 'demo-user-2';
      value.readiness = 'READY_FOR_REVIEW';
      value.listings[0].images[0].creditId = 'credit-date';
    });
    const fileName = p.listings[0].images[0].file;
    mkdirSync(join(temp, 'assets', 'don-lampe'), { recursive: true });
    const bytes = Buffer.alloc(64, 0);
    bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
    bytes[62] = 0xff; bytes[63] = 0xd9;
    writeFileSync(join(temp, fileName), bytes);
    const record = {
      id: 'credit-date', file: fileName, author: 'Test author', source: 'Fixture',
      licenseOrPermission: 'Test authorization', conditions: 'Test only',
      authorizedForDemo: true, verifiedAt: '2026-02-30',
    };
    const registry = { version: 1, credits: [record] };
    const registerPath = join(temp, 'assets', 'provenance.json');
    writeFileSync(registerPath, JSON.stringify(registry));
    const invalidDate = inspectPlan(p, { assets: true, directory: temp });
    assert.ok(invalidDate.errors.includes('Unverified or mismatched image provenance: ' + fileName));
    record.verifiedAt = '2099-01-01';
    writeFileSync(registerPath, JSON.stringify(registry));
    const futureDate = inspectPlan(p, { assets: true, directory: temp });
    assert.ok(futureDate.errors.includes('Unverified or mismatched image provenance: ' + fileName),
      'Rights provenance verification cannot be dated in the future');
    record.verifiedAt = '2024-02-29';
    writeFileSync(registerPath, JSON.stringify(registry));
    const validLeapDate = inspectPlan(p, { assets: true, directory: temp });
    assert.ok(!validLeapDate.errors.includes('Unverified or mismatched image provenance: ' + fileName),
      'Valid leap day must pass the first photo credit even while other photos are absent');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
