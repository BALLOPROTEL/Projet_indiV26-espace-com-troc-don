#!/usr/bin/env node
// Real-browser smoke against disposable Compose. Uses built-in Node 24
// WebSocket/CDP to WAIT for hydrated Next.js UI, never a premature dump-dom.
// Captures only synthetic public listing and unauthenticated member entry.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, statSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci');
assert.equal(process.env.M9_RUN_WORKFLOWS, 'true');
const id = readFileSync('.m6-smoke/m9-browser-listing-id', 'utf8').trim();
assert.match(id, /^m9-don-[0-9a-f-]+$/);
const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:13001';
const output = 'reports/m9-browser';
mkdirSync(output, { recursive: true });

const chrome = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .find(name => spawnSync('which', [name]).status === 0);
assert.ok(chrome, 'Headless Chrome/Chromium is required on GitHub Actions runner');
const profileDir = mkdtempSync(join(tmpdir(), 'm9-chrome-'));
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + profileDir,
  'about:blank',
], { stdio: 'ignore' });
let socket;
const pending = new Map();
let sequence = 0;

async function waitForPort() {
  const file = join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(file)) return Number(readFileSync(file, 'utf8').split('\n')[0]);
    if (browser.exitCode !== null) throw new Error('Headless Chrome unexpectedly exited');
    await sleep(150);
  }
  throw new Error('Chrome debugging port did not become ready');
}

function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Chrome CDP timeout: ' + method));
    }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function startCdp(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  assert.equal(response.status, 200);
  const pages = await response.json();
  const page = pages.find(p => p.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl, 'Missing Chrome page target');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(String(data));
    const promise = pending.get(msg.id);
    if (!promise) return;
    pending.delete(msg.id);
    clearTimeout(promise.timeout);
    if (msg.error) promise.reject(new Error(JSON.stringify(msg.error)));
    else promise.resolve(msg.result);
  });
  await command('Page.enable');
  await command('Runtime.enable');
}

async function capture(route, width, height, filename, expected, selector) {
  await command('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600,
  });
  const pageUrl = new URL(route, base).href;
  await command('Page.navigate', { url: pageUrl });

  let last = '';
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await command('Runtime.evaluate', {
      expression: `({text:document.body?.innerText ?? '', found:!!document.querySelector(${JSON.stringify(selector)})})`,
      returnByValue: true,
    });
    const snapshot = result.result?.value;
    last = snapshot?.text?.slice(0, 500) ?? '';
    if (snapshot?.found && snapshot.text.includes(expected)) {
      ready = true;
      break;
    }
    await sleep(450);
  }
  assert.ok(ready,
    `Hydrated UI not ready on ${route}, expected ${JSON.stringify(expected)}; DOM starts with: ${last}`);

  const image = await command('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const file = join(output, filename + '.png');
  writeFileSync(file, Buffer.from(image.data, 'base64'));
  assert.ok(statSync(file).size > 8000, 'Screenshot too small: ' + file);
  console.log('[M9 Browser] ' + filename + ': PASS (' + file + ')');
}

try {
  await startCdp(await waitForPort());
  await capture('/annonces/' + encodeURIComponent(id), 1440, 1000,
    'don-detail-desktop', 'M9 live donation refusal', '.marketplace-action');
  await capture('/annonces/' + encodeURIComponent(id), 390, 844,
    'don-detail-mobile', 'Demander ce don', '.marketplace-action');
  await capture('/espace', 1440, 900,
    'espace-login-desktop', 'Votre étagère vous attend.', '.gate-card');
  console.log('[M9 Browser] Chrome desktop/mobile hydrated UI: PASS');
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
  browser.kill('SIGTERM');
  await sleep(300);
  rmSync(profileDir, { recursive: true, force: true });
}
