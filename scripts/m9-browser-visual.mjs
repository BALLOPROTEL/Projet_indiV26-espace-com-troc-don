#!/usr/bin/env node
// Smoke-test actual Next.js browser rendering against the disposable CI Compose
// stack. Screenshots are CI artifacts, not fixtures, and contain only synthetic
// demo content (no tokens, passwords, or authenticated sessions).
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci',
  'Browser smoke may only run against isolated Compose');
assert.equal(process.env.M9_RUN_WORKFLOWS, 'true',
  'Browser smoke requires seeded M9 acceptance fixture');
const id = readFileSync('.m6-smoke/m9-browser-listing-id', 'utf8').trim();
assert.match(id, /^m9-don-[0-9a-f-]+$/);
const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:13001';
const folder = 'reports/m9-browser';
mkdirSync(folder, { recursive: true });

const executables = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const chrome = executables.find(name => spawnSync('which', [name]).status === 0);
assert.ok(chrome, 'Headless Chrome/Chromium is required for M9 browser smoke on GitHub runner');

function runBrowser(route, viewport, filename, expected, marker) {
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking',
    '--virtual-time-budget=14000', '--window-size=' + viewport,
    '--user-data-dir=/tmp/m9-browser-' + filename.replace(/[^a-z0-9]/gi, '-'),
  ];
  const url = new URL(route, base).href;

  const dom = spawnSync(chrome, [...args, '--dump-dom', url], {
    encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(dom.status, 0, 'Browser DOM failed for ' + route + ': ' + (dom.stderr ?? '').slice(-350));
  assert.ok(dom.stdout.includes(expected),
    'Expected browser text missing from ' + route + ': ' + expected);
  assert.ok(dom.stdout.includes(marker),
    'Expected rendered UI marker missing from ' + route + ': ' + marker);

  const output = join(folder, filename + '.png');
  const screenshot = spawnSync(chrome, [...args,
    '--screenshot=' + process.cwd() + '/' + output, url,
  ], { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 });
  assert.equal(screenshot.status, 0,
    'Browser screenshot failed: ' + (screenshot.stderr ?? '').slice(-500));
  assert.ok(statSync(output).size > 8000, 'Screenshot is empty: ' + output);
  console.log('[M9 Browser] ' + filename + ': PASS (' + output + ')');
}

runBrowser('/annonces/' + encodeURIComponent(id), '1440,1000',
  'don-detail-desktop', 'M9 live donation refusal', 'marketplace-action');
runBrowser('/annonces/' + encodeURIComponent(id), '390,844',
  'don-detail-mobile', 'Demander ce don', 'marketplace-action');
runBrowser('/espace', '1440,900',
  'espace-login-desktop', 'Votre étagère vous attend.', 'gate-card');

console.log('[M9 Browser] Real Chrome desktop/mobile public listing + member login UI: PASS');
