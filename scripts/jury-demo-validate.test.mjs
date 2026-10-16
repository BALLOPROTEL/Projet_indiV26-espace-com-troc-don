import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectPlan } from './jury-demo-validate.mjs';
const plan = JSON.parse(readFileSync(new URL('../demo/jury/manifest.json', import.meta.url)));
test('draft structure passes while explicitly warning it is incomplete', () => {
  const result = inspectPlan(plan);
  assert.deepEqual(result.errors, []);
  assert.equal(result.images, 20);
  assert.ok(result.warnings.some(x => x.includes('Two distinct')));
  assert.ok(result.warnings.some(x => x.includes('rights')));
});
test('strict check blocks unprovisioned USER and missing media', () => {
  const result = inspectPlan(plan, { assets: true, directory: '/nonexistent-jury-kit' });
  assert.ok(result.errors.some(x => x.includes('Two distinct')));
  assert.ok(result.errors.some(x => x.includes('Missing asset')));
});
test('duplicate images and insufficient TRADE wishes rejected', () => {
  const altered = structuredClone(plan);
  altered.listings[1].images[0].file = altered.listings[0].images[0].file;
  altered.listings[2].tradeWishes = ['Un seul souhait'];
  const result = inspectPlan(altered);
  assert.ok(result.errors.some(x => x.includes('duplicate image')));
  assert.ok(result.errors.some(x => x.includes('five distinct wishes')));
});
