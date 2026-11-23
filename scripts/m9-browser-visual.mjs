#!/usr/bin/env node
// Real-browser smoke against disposable Compose. Uses built-in Node 24
// WebSocket/CDP to WAIT for hydrated Next.js UI, never a premature dump-dom.
// Captures only synthetic public listing and unauthenticated member entry.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { readFileSync, mkdirSync, statSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const juryFinalRun = process.env.JURY_FINAL_RUN === 'true';
if (juryFinalRun) {
  assert.match(process.env.COMPOSE_PROJECT_NAME ?? '', /^projet-indiv26-jury-[a-f0-9]{8}$/,
    'Jury final browser run must target an isolated jury Compose project');
} else {
  assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci');
  assert.equal(process.env.M9_RUN_WORKFLOWS, 'true');
}
const id = juryFinalRun
  ? null
  : readFileSync('.m6-smoke/m9-browser-listing-id', 'utf8').trim();
if (!juryFinalRun) assert.match(id, /^m9-don-[0-9a-f-]+$/);
const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:13001';
const output = juryFinalRun ? 'reports/jury-final-browser' : 'reports/m9-browser';
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
], { stdio: ['ignore', 'ignore', 'pipe'] });
// On loaded CI runners Chrome CDP may initialize slowly. Capture only a
// bounded startup diagnostic; never dump browser cookies or environment.
let chromeStartupDiagnostic = '';
let chromeSpawnError = null;
browser.on('error', error => { chromeSpawnError = String(error); });
browser.stderr?.on('data', data => {
  chromeStartupDiagnostic = (chromeStartupDiagnostic + String(data)).slice(-2500);
});
let socket;
const pending = new Map();
let sequence = 0;
const apiResponses = [];
// Preserve each caller's viewport during temporary login geometry checks.
// All viewport changes flow through command(), including prior Chrome journeys.
let currentDeviceMetrics = null;

async function waitForPort() {
  const file = join(profileDir, 'DevToolsActivePort');
  // One minute avoids the previous 15-second premature Chrome startup failure.
  for (let attempt = 0; attempt < 240; attempt++) {
    if (existsSync(file)) {
      const port = Number(readFileSync(file, 'utf8').split('\n')[0]);
      if (Number.isSafeInteger(port) && port > 0 && port < 65536) return port;
    }
    if (chromeSpawnError || browser.exitCode !== null || browser.signalCode !== null) {
      throw new Error('Chrome failed before CDP startup: ' +
        (chromeSpawnError ?? 'exit=' + browser.exitCode + ', signal=' + browser.signalCode) +
        '; stderr=' + chromeStartupDiagnostic);
    }
    await sleep(250);
  }
  throw new Error('Chrome debugging port not ready after 60s; pid=' + browser.pid +
    '; stderr=' + chromeStartupDiagnostic);
}

function command(method, params = {}) {
  if (method === 'Emulation.setDeviceMetricsOverride') currentDeviceMetrics = { ...params };
  if (method === 'Emulation.clearDeviceMetricsOverride') currentDeviceMetrics = null;
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
    if (msg.method === 'Network.responseReceived') {
      const response = msg.params?.response;
      if (response?.url?.includes('/api/')) {
        try { apiResponses.push({ path: new URL(response.url).pathname, status: response.status }); }
        catch { /* ignore invalid URLs */ }
      }
    }
    const promise = pending.get(msg.id);
    if (!promise) return;
    pending.delete(msg.id);
    clearTimeout(promise.timeout);
    if (msg.error) promise.reject(new Error(JSON.stringify(msg.error)));
    else promise.resolve(msg.result);
  });
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
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
    if (snapshot?.found && snapshot.text.toLocaleLowerCase('fr').includes(expected.toLocaleLowerCase('fr'))) {
      ready = true;
      break;
    }
    await sleep(450);
  }
  assert.ok(ready,
    `Hydrated UI not ready on ${route}, expected ${JSON.stringify(expected)}; DOM starts with: ${last}`);

  // Hydration can finish before the browser's navigation lifecycle. Never
  // archive a zero loadEventEnd as if it were a valid performance measure.
  await waitUntil('completed navigation timing on ' + route, `(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return document.readyState === 'complete' &&
      Number.isFinite(nav?.domContentLoadedEventEnd) &&
      nav.domContentLoadedEventEnd > 0 &&
      Number.isFinite(nav?.loadEventEnd) &&
      nav.loadEventEnd > 0;
  })()`, 45);

  // ResourceTiming is sampled only after it has been stable across three
  // bounded observations. This keeps late image/font requests from making
  // the artifact depend on the exact capture instant.
  let stableResourceSamples = 0;
  let previousResourceSignature = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const snapshot = await evaluate(`(() => {
      const resources = performance.getEntriesByType('resource');
      return {
        count: resources.length,
        transferBytes: Math.round(resources.reduce(
          (sum, entry) => sum + (entry.transferSize || 0), 0)),
        decodedBodyBytes: Math.round(resources.reduce(
          (sum, entry) => sum + (entry.decodedBodySize || 0), 0)),
        lastResponseEndMs: Math.round(resources.reduce(
          (latest, entry) => Math.max(latest, entry.responseEnd || 0), 0)),
      };
    })()`);
    const signature = JSON.stringify(snapshot);
    if (signature === previousResourceSignature) stableResourceSamples++;
    else stableResourceSamples = 0;
    previousResourceSignature = signature;
    if (stableResourceSamples >= 2) break;
    await sleep(250);
  }
  assert.ok(stableResourceSamples >= 2,
    'Resource timing did not settle before capture on ' + route);

  const image = await command('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const file = join(output, filename + '.png');
  writeFileSync(file, Buffer.from(image.data, 'base64'));
  assert.ok(statSync(file).size > 8000, 'Screenshot too small: ' + file);

  const performanceMetrics = await evaluate(`(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const images = resources.filter(entry => entry.initiatorType === 'img');
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map(entry => [
        entry.name,
        Math.round(entry.startTime),
      ]),
    );
    const round = value =>
      Number.isFinite(value) ? Math.round(value) : null;

    return {
      url: location.href,
      domContentLoadedMs: round(nav?.domContentLoadedEventEnd),
      loadEventMs: round(nav?.loadEventEnd),
      responseEndMs: round(nav?.responseEnd),
      resourceCount: resources.length,
      imageResourceCount: images.length,
      transferBytes: Math.round(
        resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      ),
      decodedBodyBytes: Math.round(
        resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
      ),
      paints,
    };
  })()`);

  assert.ok(
    Number.isFinite(performanceMetrics?.domContentLoadedMs) &&
      performanceMetrics.domContentLoadedMs > 0 &&
      Number.isFinite(performanceMetrics?.loadEventMs) &&
      performanceMetrics.loadEventMs > 0 &&
      Number.isFinite(performanceMetrics?.responseEndMs) &&
      performanceMetrics.responseEndMs >= 0,
    'Completed navigation timing missing for ' + filename,
  );

  const performanceFile = join(
    output,
    filename + '-performance.json',
  );
  writeFileSync(
    performanceFile,
    JSON.stringify(performanceMetrics, null, 2) + '\n',
  );

  console.log('[M9 Browser] ' + filename + ': PASS (' + file + ')');
  console.log(
    '[M9 Performance] ' + filename +
      ': DOMContentLoaded=' + performanceMetrics.domContentLoadedMs + 'ms' +
      ', load=' + performanceMetrics.loadEventMs + 'ms' +
      ', resources=' + performanceMetrics.resourceCount +
      ', images=' + performanceMetrics.imageResourceCount +
      ', transfer=' + performanceMetrics.transferBytes + ' bytes',
  );
}

async function evaluate(expression) {
  const answer = await command('Runtime.evaluate', { expression, returnByValue: true });
  if (answer.exceptionDetails) throw new Error('Browser JS: ' + JSON.stringify(answer.exceptionDetails).slice(0, 450));
  return answer.result?.value;
}

async function waitUntil(label, predicate, maxAttempts = 100) {
  let reason = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (await evaluate(predicate)) return;
    } catch (error) {
      reason = String(error);
    }
    await sleep(450);
  }
  let browserState = null;
  try {
    browserState = await evaluate(`({
      url: location.href,
      title: document.title,
      text: document.body?.innerText?.slice(0, 1500) ?? '(empty)',
      hasDashboard: !!document.querySelector('.marketplace-dashboard'),
      dashboardText: document.querySelector('.marketplace-dashboard')?.innerText?.slice(0, 2500) ?? null,
      errors: [...document.querySelectorAll('[role=alert]')].map(e => e.innerText).slice(0, 6),
      hasKeycloakLogin: !!document.querySelector('#username'),
    })`);
    const shot = await command('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
    });
    writeFileSync(join(output, 'authenticated-owner-diagnostic.png'),
      Buffer.from(shot.data, 'base64'));
    console.error('[M9 Browser] Authentication diagnosis:', JSON.stringify({ ...browserState, apiResponses: apiResponses.slice(-35) }));
  } catch (diagnosticError) {
    console.error('[M9 Browser] Could not capture diagnostic:', String(diagnosticError));
  }
  throw new Error('Timed out waiting for ' + label + (reason ? ': ' + reason : '') +
    '; state=' + JSON.stringify(browserState));
}

async function loginAsDemoOwner() {
  const clicked = await evaluate(`(() => {
    const button = document.querySelector('.gate-card button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, 'Member sign-in button must be present');

  await waitUntil('Keycloak login form', `!!document.querySelector('#username') &&
    !!document.querySelector('#password')`, 90);

  const submitted = await evaluate(`(() => {
    const user = document.querySelector('#username');
    const pass = document.querySelector('#password');
    const form = user?.closest('form') ?? document.querySelector('#kc-form-login');
    if (!user || !pass || !form) return false;
    user.value = 'demo-moderator';
    pass.value = 'demo-moderator-local';
    user.dispatchEvent(new Event('input', { bubbles: true }));
    pass.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  assert.equal(submitted, true, 'Local demo Keycloak form could not be submitted');
  await waitUntil('authenticated owner inbox and rejected proposal', `(
    location.origin === ${JSON.stringify(new URL(base).origin)} &&
    !!document.querySelector('.marketplace-dashboard') &&
    document.body.innerText.includes('Mes dons et trocs') &&
    document.body.innerText.toLocaleLowerCase('fr').includes('refusée')
  )`, 120);
  console.log('[M9 Browser] Keycloak login as demo owner + rejected inbox: PASS');
}

async function loginAsDemoRequester() {
  const logoutClicked = await evaluate(`(() => {
    const root = document.querySelector('.pm-account-menu');
    if (!root) return false;
    if (!root.open) root.querySelector('summary')?.click();
    const button = root.querySelector('[data-account-action="logout"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(logoutClicked, true, 'Owner logout button must be available');

  await waitUntil('Keycloak logout returns to the public app', `(
    location.origin === ${JSON.stringify(new URL(base).origin)} &&
    !document.querySelector('.pm-account-menu')
  )`, 100);

  await command('Page.navigate', { url: new URL('/espace', base).href });
  await waitUntil('Member login gate after logout', `!!document.querySelector('.gate-card button')`, 90);

  const clicked = await evaluate(`(() => {
    const button = document.querySelector('.gate-card button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true);

  await waitUntil('requester Keycloak login form', `!!document.querySelector('#username') &&
    !!document.querySelector('#password')`, 90);
  const submitted = await evaluate(`(() => {
    const user = document.querySelector('#username');
    const password = document.querySelector('#password');
    const form = user?.closest('form') ?? document.querySelector('#kc-form-login');
    if (!user || !password || !form) return false;
    user.value = 'demo-user';
    password.value = 'demo-user-local';
    user.dispatchEvent(new Event('input', { bubbles: true }));
    password.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  assert.equal(submitted, true, 'Requester login form not submitted');

  await waitUntil('authenticated requester sent rejected proposal', `(
    location.origin === ${JSON.stringify(new URL(base).origin)} &&
    document.body.innerText.includes('Demo User') &&
    !!document.querySelector('.marketplace-dashboard') &&
    document.querySelector('.marketplace-dashboard').innerText.includes('Mes demandes envoyées') &&
    document.querySelector('.marketplace-dashboard').innerText.toLocaleLowerCase('fr').includes('refusée')
  )`, 120);
  console.log('[M9 Browser] Keycloak login as requester + rejected sent proposal: PASS');
}


// M9 final browser acceptance: genuine UI clicks, no API mutations.
// All listings belong to the disposable Compose stack and all accounts are
// demo Keycloak users. API calls below ONLY seed fixture identity / verify
// persisted outcomes; business mutations must go through the browser UI.
// Each fixture must have a DIFFERENT first eight characters: the listing
// detail only renders id.slice(0,8), which is our browser readiness proof.
// Shared prefixes could mistake the previous page for the new one.
const browserIds = {
  donation: 'don-accepted-' + randomUUID(),
  rejected: 'don-rejected-' + randomUUID(),
  trade: 'troc-requested-' + randomUUID(),
  offered: 'troc-offered-' + randomUUID(),
};
assert.equal(new Set(Object.values(browserIds).map(id => id.slice(0, 8))).size, 4,
  'All M9 browser fixture IDs must have unique rendered eight-character prefixes');
const browserGateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');

function browserPassword(username) {
  const password = username === 'demo-requester'
    ? process.env.JURY_REQUESTER_PASSWORD
    : username + '-local';
  assert.ok(typeof password === 'string' && password.length >= 14,
    'Missing safe local credential for ' + username);
  return password;
}

async function browserToken(username) {
  const issuer = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:18081';
  const response = await fetch(issuer + '/realms/projet-indiv26/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'cli',
      username, password: browserPassword(username),
    }),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, 'Could not get fixture token for ' + username);
  const data = await response.json();
  const claims = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url'));
  return {
    value: data.access_token,
    sub: claims.sub,
    username: claims.preferred_username,
    roles: claims.realm_access?.roles ?? [],
  };
}

async function browserApi(token, path) {
  const response = await fetch(browserGateway + path, {
    headers: { authorization: 'Bearer ' + token.value },
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, 'M9 UI verification GET ' + path + ': HTTP ' + response.status);
  return response.json();
}

async function seedBrowserJourneys(owner, requester) {
  const listings = [
    { id: browserIds.donation, ownerId: owner.sub, title: 'M9 visual donation accepted', operationType: 'DONATION' },
    { id: browserIds.rejected, ownerId: owner.sub, title: 'M9 visual donation refused', operationType: 'DONATION' },
    { id: browserIds.trade, ownerId: owner.sub, title: 'M9 visual trade requested', operationType: 'TRADE' },
    { id: browserIds.offered, ownerId: requester.sub, title: 'M9 visual trade offered', operationType: 'TRADE' },
  ];
  const source = 'const {PrismaClient}=require("./generated/prisma");' +
    'const listings=' + JSON.stringify(listings) + ';' +
    '(async()=>{const prisma=new PrismaClient();try{' +
    'for(const item of listings){await prisma.listing.create({data:{' +
    '...item,description:"Disposable synthetic fixture for real Chrome UI acceptance.",' +
    'status:"APPROVED",availabilityStatus:"AVAILABLE",' +
    '...(item.operationType==="TRADE"?{tradeWishes:{create:' +
    '["Livres","Jeux","Accessoires","Mobilier","Loisirs"].map((label,position)=>({label,position}))}}:{})' +
    '}});}' +
    '}finally{await prisma.$disconnect();}})()' +
    '.catch(e=>{console.error(e);process.exit(1)});';
  const run = spawnSync('docker', [
    'compose', '-f', 'compose.yaml', 'exec', '-T',
    'catalog-service', 'node', '-',
  ], { input: source, encoding: 'utf8', timeout: 60000 });
  assert.equal(run.status, 0,
    'M9 browser fixture seed failed: ' + (run.stderr || run.error || '').toString().slice(0, 900));
  console.log('[M9 Journey] Four isolated approved DON/TROC listings: PASS');
}

async function journeyScreenshot(name) {
  const result = await command('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const path = join(output, name + '.png');
  writeFileSync(path, Buffer.from(result.data, 'base64'));
  assert.ok(statSync(path).size > 8000, 'Missing real Chrome screenshot: ' + path);
  console.log('[M9 Journey] Screenshot ' + name + ': PASS');
}

async function journeyOpen(route, expectedSelector, label, expectedTitle = null) {
  const destination = new URL(route, base);
  // CDP Page.navigate resolves before the new document is guaranteed to load.
  // Never accept a matching form from the page we are leaving: successive
  // donation pages expose identical selectors.
  const listingId = destination.pathname.startsWith('/annonces/')
    ? decodeURIComponent(destination.pathname.slice('/annonces/'.length))
    : null;
  await command('Page.navigate', { url: destination.href });
  const predicate = '(() => {' +
    'if (location.href !== ' + JSON.stringify(destination.href) +
    ' || document.readyState === "loading") return false;' +
    'if (!document.querySelector(' + JSON.stringify(expectedSelector) + ')) return false;' +
    'const listingId=' + JSON.stringify(listingId) + ';' +
    // CUIDs generated in quick succession may share the first 8 chars: verify
    // a distinct title in addition to the displayed index when supplied.
    'const expectedTitle=' + JSON.stringify(expectedTitle) + ';' +
    'if (expectedTitle && !(document.body?.innerText??"").includes(expectedTitle)) return false;' +
    'if (!listingId) return true;' +
    // The listing index is populated only after the requested detail loaded.
    'const displayed=document.querySelector(".listing-detail__index")?.textContent ?? "";' +
    'return displayed.toUpperCase().includes(listingId.slice(0,8).toUpperCase());' +
    '})()';
  await waitUntil(label + ' at ' + destination.pathname, predicate, 120);
}

async function journeyClick(buttonLabel, targetListingId) {
  const expression = '(() => {' +
    'const id=' + JSON.stringify(targetListingId) + ';' +
    'const label=' + JSON.stringify(buttonLabel) + ';' +
    'const cards=[...document.querySelectorAll(".marketplace-dashboard .marketplace-entry")];' +
    'const card=cards.find(card=>[...card.querySelectorAll("a[href]")].some(link=>' +
    'link.getAttribute("href")==="/annonces/"+id)&&' +
    '[...card.querySelectorAll("button")].some(button=>button.textContent.trim()===label));' +
    'const button=[...(card?.querySelectorAll("button")??[])].find(button=>button.textContent.trim()===label);' +
    'if(!button||button.disabled)return false;button.click();return true;})()';
  assert.equal(await evaluate(expression), true,
    'Missing enabled UI button "' + buttonLabel + '" for ' + targetListingId);
}

async function journeyWaitCard(targetListingId, status) {
  const predicate = '(() => {' +
    'const id=' + JSON.stringify(targetListingId) + ';' +
    'const status=' + JSON.stringify(status) + ';' +
    'return [...document.querySelectorAll(".marketplace-dashboard .marketplace-entry")].some(card=>' +
    '[...card.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&card.innerText.toLocaleLowerCase("fr").includes(status.toLocaleLowerCase("fr")));})()';
  await waitUntil('UI listing ' + targetListingId + ' status ' + status, predicate, 120);
}

async function journeyWaitAction(targetListingId, buttonLabel) {
  const predicate = '(() => {const id=' + JSON.stringify(targetListingId) +
    ';const label=' + JSON.stringify(buttonLabel) +
    ';return [...document.querySelectorAll(".marketplace-dashboard .marketplace-entry")].some(card=>' +
    '[...card.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&[...card.querySelectorAll("button")].some(b=>b.textContent.trim()===label&&!b.disabled));})()';
  await waitUntil('enabled ' + buttonLabel + ' for ' + targetListingId, predicate, 120);
}

async function journeyWaitConfirmation(targetListingId) {
  const predicate = '(() => {const id=' + JSON.stringify(targetListingId) +
    ';return [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")].some(card=>' +
    '[...card.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&card.innerText.includes("Votre confirmation : reçue"));})()';
  await waitUntil('stored visible first confirmation for ' + targetListingId, predicate, 120);
}

async function journeyOffer(targetId, offeredId, label,
  offeredTitle = 'M9 visual trade offered',
  comparisonScreenshot = 'm9-journey-trade-comparison',
  targetTitle = null) {
  await journeyOpen('/annonces/' + encodeURIComponent(targetId), '.marketplace-action form',
    'authenticated ' + label + ' form', targetTitle);
  if (offeredId) {
    await waitUntil('approved trade offer loaded into the select',
      '[...document.querySelectorAll(".marketplace-action select option")].some(option=>option.value===' +
      JSON.stringify(offeredId) + ')', 120);
    const change = '(() => {const element=document.querySelector(".marketplace-action select");' +
      'if(!element)return false;' +
      'const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set;' +
      'setter.call(element,' + JSON.stringify(offeredId) + ');' +
      'element.dispatchEvent(new Event("change",{bubbles:true}));return true;})()';
    assert.equal(await evaluate(change), true, 'Missing TROC offered-listing selector');
    await waitUntil('TROC visual side-by-side preview',
      '(document.querySelector(".marketplace-compare")?.innerText??"").includes(' + JSON.stringify(offeredTitle) + ')', 120);
    await journeyScreenshot(comparisonScreenshot);
  }
  const fill = '(() => {' +
    'const field=document.querySelector(".marketplace-action textarea");if(!field)return false;' +
    'const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set;' +
    'setter.call(field,' + JSON.stringify('Recette Chrome M9 : ' + label) + ');' +
    'field.dispatchEvent(new Event("input",{bubbles:true}));' +
    'const button=document.querySelector(".marketplace-action button[type=submit]");' +
    'if(!button||button.disabled)return false;button.click();return true;})()';
  assert.equal(await evaluate(fill), true, 'Could not submit ' + label + ' through Chrome UI');
  await waitUntil('UI success ' + label,
    '(document.querySelector(".marketplace-action [role=status]")?.textContent??"").includes("Proposition envoyée")', 120);
  await journeyScreenshot('m9-journey-' + label + '-sent');
  console.log('[M9 Journey] Real browser submission ' + label + ': PASS');
}

// #98: inspect the actual password INPUT, not only the visually wide
// PatternFly wrapper. A 1%-wide input escaped previous login CSS assertions.
async function assertKeycloakPasswordLayout(viewport) {
  const geometry = await evaluate('(() => {' +
    'const username=document.querySelector("#username"),' +
    'password=document.querySelector("#password"),' +
    'group=password?.closest(".pf-v5-c-input-group"),' +
    'toggle=group?.querySelector("button");' +
    'const r=(el)=>{if(!el)return null;const x=el.getBoundingClientRect();' +
    'return {left:x.left,right:x.right,width:x.width,height:x.height};};' +
    'return {username:r(username),password:r(password),group:r(group),' +
    'toggle:r(toggle),overflow:document.documentElement.scrollWidth-' +
    'document.documentElement.clientWidth};})()');
  assert.ok(geometry?.username && geometry?.password &&
    geometry?.group && geometry?.toggle,
    'Native Keycloak password input and visibility toggle missing at ' + viewport);
  assert.ok(geometry.password.width >= Math.max(160, geometry.username.width * .67),
    'Password TEXT INPUT compressed compared with username at ' + viewport +
    ': ' + JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.group.width - geometry.username.width) <= 12 &&
    Math.abs(geometry.group.left - geometry.username.left) <= 8,
    'Password field must align with username at ' + viewport + ': ' +
    JSON.stringify(geometry));
  assert.ok(geometry.toggle.width >= 44 && geometry.toggle.width <= 64 &&
    geometry.toggle.height >= 44 &&
    Math.abs(geometry.password.right - geometry.toggle.left) <= 5,
    'Native show-password button must adjoin the input on both axes, with a 44px target: ' +
    JSON.stringify(geometry));
  assert.ok(geometry.password.height >= 44 && geometry.overflow <= 2,
    'Password control must remain touchable without horizontal scroll: ' +
    JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.group.height - geometry.username.height) <= 3,
    'Password group height must match username field: ' + JSON.stringify(geometry));
  // Exercise actual keyboard Tab navigation before clicking the native toggle.
  // Visibility changes can restore focus to the input, so measure button
  // focus BEFORE the clicks rather than mixing two different focus states.
  assert.equal(await evaluate('(() => {' +
    'const input=document.querySelector("#password");input?.focus();' +
    'return document.activeElement===input;})()'), true,
  'Keycloak password input must be keyboard-focusable at ' + viewport);
  await command('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
  });
  await command('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
  });
  const focus = await evaluate('(() => {' +
    'const password=document.querySelector("#password"),' +
    'group=password?.closest(".pf-v5-c-input-group"),' +
    'toggle=group?.querySelector("button");' +
    'if(!group||!toggle)return null;' +
    'const buttonCss=getComputedStyle(toggle);' +
    'return {eyeFocused:document.activeElement===toggle,' +
    'eyeFocusVisible:toggle.matches(":focus-visible"),' +
    'groupRing:parseFloat(getComputedStyle(group).outlineWidth),' +
    'toggleRing:parseFloat(buttonCss.outlineWidth),' +
    'toggleShadow:buttonCss.boxShadow,' +
    'toggleId:toggle.id};})()');
  assert.ok(focus && focus.eyeFocused && focus.eyeFocusVisible &&
    focus.groupRing >= 2 && focus.toggleRing === 0 &&
    focus.toggleShadow.includes('inset'),
    'Keyboard Tab must identify eye with an inset cue and ONE outer group ring at ' +
    viewport + ': ' + JSON.stringify(focus));
  // Real forced-colors emulation: unlike box-shadow/background, a system-color
  // inset outline survives Windows High Contrast and signals focus transfer.
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'forced-colors', value: 'active' }],
  });
  try {
    const highContrast = await evaluate('(() => {' +
      'const eye=document.querySelector("#password")' +
      '?.closest(".pf-v5-c-input-group")?.querySelector("button");' +
      'if(!eye)return null;const css=getComputedStyle(eye);' +
      'return {forced:matchMedia("(forced-colors: active)").matches,' +
      'eyeFocused:document.activeElement===eye,' +
      'eyeFocusVisible:eye.matches(":focus-visible"),' +
      'outlineWidth:parseFloat(css.outlineWidth),' +
      'outlineOffset:parseFloat(css.outlineOffset),' +
      'outlineStyle:css.outlineStyle};})()');
    assert.ok(highContrast && highContrast.forced &&
      highContrast.eyeFocused && highContrast.eyeFocusVisible &&
      highContrast.outlineWidth >= 2 &&
      highContrast.outlineOffset <= -2 &&
      highContrast.outlineStyle !== 'none',
      'High Contrast must retain an inset native eye focus outline at ' +
      viewport + ': ' + JSON.stringify(highContrast));
  } finally {
    await command('Emulation.setEmulatedMedia', { features: [] });
  }
  // Click Keycloak's own show/hide button; never log password content.
  const visibility = await evaluate('(() => {' +
    'const password=document.querySelector("#password"),' +
    'toggle=password?.closest(".pf-v5-c-input-group")?.querySelector("button");' +
    'if(!password||!toggle)return null;' +
    'const before=password.type;toggle.click();const revealed=password.type;' +
    'toggle.click();const restored=password.type;' +
    'return {before,revealed,restored};})()');
  assert.ok(visibility && visibility.before === 'password' &&
    visibility.revealed === 'text' && visibility.restored === 'password',
    'Native password visibility must toggle and re-mask at ' +
    viewport + ': ' + JSON.stringify(visibility));
}

async function journeySwitchUser(username) {
  const logout = '(() => {const root=document.querySelector(".pm-account-menu");' +
    'if(!root)return false;if(!root.open)root.querySelector("summary")?.click();' +
    'const button=root.querySelector("[data-account-action=logout]");' +
    'if(!button)return false;button.click();return true;})()';
  assert.equal(await evaluate(logout), true, 'Missing real browser logout');
  await waitUntil('Keycloak logout and app return',
    'location.origin===' + JSON.stringify(new URL(base).origin) +
    '&& !document.querySelector(".pm-account-menu")', 120);
  await journeyOpen('/espace', '.gate-card button', 'member sign-in after logout');
  assert.equal(await evaluate('(() => {const b=document.querySelector(".gate-card button");if(!b)return false;b.click();return true;})()'),
    true, 'Missing sign-in button');
  await waitUntil('Keycloak sign-in form for ' + username,
    '!!document.querySelector("#username") && !!document.querySelector("#password")', 120);
  // #93: measure the real Keycloak page in Chrome before entering credentials.
  // A CSS build alone cannot detect PatternFly compressing the login to 290px.
  if (username === 'demo-user') {
    const restoreMetrics = currentDeviceMetrics ? { ...currentDeviceMetrics } : null;
    await command('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 860, deviceScaleFactor: 1, mobile: false,
    });
    await waitUntil('desktop Keycloak page laid out', '!!document.querySelector(".pf-v5-c-login__main")', 60);
    const desktopLogin = await evaluate('(() => {' +
      'const form=document.querySelector(".pf-v5-c-login__main"),' +
      'brand=document.querySelector("#kc-header")||document.querySelector(".pf-v5-c-login__header"),' +
      'container=document.querySelector(".pf-v5-c-login__container");' +
      'if(!form||!brand||!container)return null;' +
      'return {form:form.getBoundingClientRect().width,' +
      'left:form.getBoundingClientRect().left,' +
      'brandRight:brand.getBoundingClientRect().right,' +
      'container:container.getBoundingClientRect().width};})()');
    assert.ok(desktopLogin && desktopLogin.form >= 380 &&
      desktopLogin.container >= 850 && desktopLogin.left >= desktopLogin.brandRight - 14,
      'Keycloak desktop must show a generous two-column login: ' + JSON.stringify(desktopLogin));
    await assertKeycloakPasswordLayout('desktop-1280');
    await journeyScreenshot('uxv3-keycloak-desktop-1280');
    await command('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await waitUntil('Keycloak reflows into a mobile column',
      'document.querySelector(".pf-v5-c-login__main")?.getBoundingClientRect().width < 390', 80);
    const mobileLogin = await evaluate('(() => {' +
      'const form=document.querySelector(".pf-v5-c-login__main");' +
      'const user=document.querySelector("#username");' +
      'return {width:form?.getBoundingClientRect().width,' +
      'user:user?.getBoundingClientRect().width,' +
      'overflow:document.documentElement.scrollWidth-innerWidth};})()');
    assert.ok(mobileLogin && mobileLogin.width >= 305 &&
      mobileLogin.user >= 250 && mobileLogin.overflow <= 1,
      'Keycloak 390px mobile form must remain spacious without horizontal overflow: ' +
      JSON.stringify(mobileLogin));
    await assertKeycloakPasswordLayout('mobile-390');
    await journeyScreenshot('uxv3-keycloak-mobile-390');
    await command('Emulation.setDeviceMetricsOverride', {
      width: 320, height: 760, deviceScaleFactor: 1, mobile: true,
    });
    await assertKeycloakPasswordLayout('mobile-320');
    if (restoreMetrics) await command('Emulation.setDeviceMetricsOverride', restoreMetrics);
    else await command('Emulation.clearDeviceMetricsOverride');
  }
  const signIn = '(() => {' +
    'const user=document.querySelector("#username"),pass=document.querySelector("#password");' +
    'const form=user?.closest("form")??document.querySelector("#kc-form-login");' +
    'if(!user||!pass||!form)return false;' +
    'user.value=' + JSON.stringify(username) + ';' +
    'pass.value=' + JSON.stringify(browserPassword(username)) + ';' +
    'user.dispatchEvent(new Event("input",{bubbles:true}));' +
    'pass.dispatchEvent(new Event("input",{bubbles:true}));' +
    'form.requestSubmit();return true;})()';
  assert.equal(await evaluate(signIn), true, 'Unable to submit Keycloak login for ' + username);
  const display = {
    'demo-user': 'Demo User',
    'demo-requester': 'Demo Requester',
    'demo-moderator': 'Demo Moderator',
    'demo-admin': 'Demo Admin',
  }[username];
  assert.ok(display, 'Unsupported synthetic Keycloak identity: ' + username);
  await waitUntil('authenticated dashboard for ' + username,
    'location.origin===' + JSON.stringify(new URL(base).origin) +
    '&&document.body.innerText.includes(' + JSON.stringify(display) + ')' +
    '&&!!document.querySelector(".marketplace-dashboard")', 120);
  console.log('[M9 Journey] Browser switched to ' + username + ': PASS');
}

function browserFindProposal(items, target, expected) {
  const proposal = items.find(p => p.targetListingId === target);
  assert.ok(proposal, 'No actual persisted proposal for ' + target);
  assert.equal(proposal.status, expected, 'Wrong API proposal status for ' + target);
  return proposal;
}

function browserFindTransaction(items, target, expected) {
  const transaction = items.find(t => t.targetListingId === target);
  assert.ok(transaction, 'No actual transaction for ' + target);
  assert.equal(transaction.status, expected, 'Wrong transaction status for ' + target);
  return transaction;
}

async function runRealBrowserJourneys() {
  const owner = await browserToken('demo-moderator');
  const requester = await browserToken('demo-user');
  await seedBrowserJourneys(owner, requester);

  // UX V4: a signed-in visitor must return to the intended proposal form
  // after the listing detail is asynchronously fetched, not the top of page.
  await journeyOpen('/annonces/' + browserIds.donation + '#faire-une-demande',
    '.listing-detail__proposal-target', 'UX V4 deferred product request destination',
    'M9 visual donation accepted');
  // Debug only public layout geometry, never page credentials or tokens.
  // This distinguishes broken hash scroll from an overstrict viewport check.
  await sleep(850);
  const productAnchorGeometry = await evaluate('(() => {' +
    'const target=document.getElementById("faire-une-demande");' +
    'const rect=target?.getBoundingClientRect();' +
    'return {hash:location.hash,scrollY:window.scrollY,innerHeight:innerHeight,' +
    'scrollHeight:document.documentElement.scrollHeight,' +
    'behavior:getComputedStyle(document.documentElement).scrollBehavior,' +
    'top:rect?.top,bottom:rect?.bottom,height:rect?.height};})()');
  console.log('[UX V4] Product anchor geometry:', JSON.stringify(productAnchorGeometry));
  await waitUntil('UX V4 product deep link restored after asynchronous fetch',
    '(() => {const target=document.getElementById("faire-une-demande");' +
    'const form=target?.querySelector(".marketplace-action form.listing-form");' +
    'const box=form?.getBoundingClientRect();' +
    'return location.hash==="#faire-une-demande" && window.scrollY>0 && !!target && !!box' +
    '&& target.getBoundingClientRect().top>=56' +
    '&& target.getBoundingClientRect().top<Math.min(innerHeight*.8,600)' +
    '&& target.getBoundingClientRect().bottom>56' +
    '&& box.top<innerHeight-80 && box.bottom>56;})()', 120);
  await journeyScreenshot('uxv4-product-request-deep-link');

  // Existing smoke test leaves a real Keycloak demo-user session in Chrome.
  await journeyOffer(browserIds.donation, null, 'don-accepted');
  await journeyOffer(browserIds.rejected, null, 'don-rejected');
  await journeyOffer(browserIds.trade, browserIds.offered, 'troc');

  // UX V4: exercise the actual header account dropdown with a Keycloak
  // USER session, not only the static shortcuts within PersonalSpace.
  await journeyOpen('/espace', '.marketplace-dashboard', 'UX V4 USER account dropdown');
  const memberDestinations = [
    ['/publier', '.workspace-v3--publish .form-panel'],
    ['/mes-annonces', '.workspace-v3--listings .shelf-panel'],
    ['/messages', '.pm-conversations'],
  ];
  for (const [href, selector] of memberDestinations) {
    const menu = await evaluate('(() => {' +
      'const root=document.querySelector(".pm-account-menu");' +
      'const summary=root?.querySelector("summary");' +
      'if(!summary)return null;if(!root.open)summary.click();return {' +
      'open:root.open, links:[...root.querySelectorAll(".pm-account-menu__panel a")]' +
      '.map(a=>a.getAttribute("href"))};})()');
    assert.equal(menu?.open, true, 'Prototype USER account menu must open');
    for (const required of ['/espace', '/publier', '/mes-annonces', '/messages']) {
      assert.ok(menu?.links.includes(required),
        'Prototype USER account menu must include ' + required);
    }
    const clicked = await evaluate('(() => {' +
      'const href=' + JSON.stringify(href) + ';' +
      'const link=[...document.querySelectorAll(".pm-account-menu__panel a")]' +
      '.find(a=>a.getAttribute("href")===href);' +
      'if(!link)return false;link.click();return true;})()');
    assert.equal(clicked, true, 'Prototype USER must click account destination ' + href);
    await waitUntil('Prototype USER account menu navigates to ' + href,
      'location.pathname===' + JSON.stringify(href) +
      '&&!document.querySelector(".pm-account-menu")?.open' +
      '&&!!document.querySelector(' + JSON.stringify(selector) + ')', 120);
  }
  console.log('[#149] USER account dropdown: dedicated member destinations PASS');

  // Unlike a same-document hash transition, a new document forces the
  // asynchronous Keycloak bootstrap and PersonalSpace mount. Otherwise the
  // previous USER-menu click would mask a broken deep-link restoration.
  await command('Page.navigate', { url: 'about:blank' });
  await waitUntil('UX V4 prior member document unloaded',
    'location.href==="about:blank"', 40);

  // UX V4: member navigation must survive the delayed Keycloak bootstrap
  // and restore the dedicated private-conversation workspace.
  await journeyOpen('/messages', '.pm-conversations',
    'Prototype Messages page after login');
  const memberTargets = await evaluate('[...document.querySelectorAll(".pm-account-nav a")]' +
    '.map(a=>a.getAttribute("href")).filter(Boolean)');
  assert.ok(memberTargets.includes('/mes-annonces'),
    'Prototype account sidebar must link to Mes annonces');
  assert.ok(memberTargets.includes('/messages'),
    'Prototype account sidebar must link to Messages & échanges');
  assert.equal(await evaluate('location.pathname'), '/messages',
    'Messages must be a dedicated member route after Keycloak bootstrap');
  await journeyScreenshot('prototype-10-messages-page');
  await journeyOpen('/espace', '.marketplace-dashboard', 'requester outgoing dashboard');
  await journeyWaitCard(browserIds.donation, 'En attente');
  await journeyWaitCard(browserIds.rejected, 'En attente');
  await journeyWaitCard(browserIds.trade, 'En attente');
  const outgoing = await browserApi(requester, '/api/proposals/me');
  browserFindProposal(outgoing, browserIds.donation, 'PENDING');
  browserFindProposal(outgoing, browserIds.rejected, 'PENDING');
  browserFindProposal(outgoing, browserIds.trade, 'PENDING');
  await journeyScreenshot('m9-journey-requester-three-pending');
  console.log('[M9 Journey] Browser created 2 donations + 1 trade, requester inbox: PASS');

  // Owner makes real rejection and acceptance clicks, not API POST requests.
  await journeySwitchUser('demo-moderator');
  await journeyWaitCard(browserIds.rejected, 'En attente');
  await journeyWaitAction(browserIds.rejected, 'Refuser');
  await journeyClick('Refuser', browserIds.rejected);
  await journeyWaitCard(browserIds.rejected, 'Refusée');
  browserFindProposal(await browserApi(owner, '/api/proposals/received'), browserIds.rejected, 'REJECTED');
  await journeyScreenshot('m9-journey-owner-rejected');

  await journeyWaitAction(browserIds.donation, 'Accepter');
  await journeyClick('Accepter', browserIds.donation);
  await journeyWaitCard(browserIds.donation, 'Acceptée');
  browserFindTransaction(await browserApi(owner, '/api/transactions/me'), browserIds.donation, 'IN_PROGRESS');
  await journeyScreenshot('m9-journey-owner-donation-accepted');

  await journeyWaitAction(browserIds.trade, 'Accepter');
  await journeyClick('Accepter', browserIds.trade);
  await journeyWaitCard(browserIds.trade, 'Acceptée');
  browserFindTransaction(await browserApi(owner, '/api/transactions/me'), browserIds.trade, 'IN_PROGRESS');
  await journeyScreenshot('m9-journey-owner-trade-accepted');

  await journeyWaitAction(browserIds.donation, 'Confirmer la remise');
  await journeyClick('Confirmer la remise', browserIds.donation);
  await journeyWaitConfirmation(browserIds.donation);
  let ownerTx = await browserApi(owner, '/api/transactions/me');
  assert.ok(browserFindTransaction(ownerTx, browserIds.donation, 'IN_PROGRESS').ownerConfirmedAt,
    'First donation confirmation must be stored without completing the transaction');
  await journeyWaitAction(browserIds.trade, 'Confirmer la remise');
  await journeyClick('Confirmer la remise', browserIds.trade);
  await journeyWaitConfirmation(browserIds.trade);
  ownerTx = await browserApi(owner, '/api/transactions/me');
  assert.ok(browserFindTransaction(ownerTx, browserIds.trade, 'IN_PROGRESS').ownerConfirmedAt,
    'First trade confirmation must not finish the transaction');
  await journeyScreenshot('m9-journey-owner-confirmed-first');

  // Second real user finishes BOTH transactions via the visible buttons.
  await journeySwitchUser('demo-user');
  await journeyWaitCard(browserIds.rejected, 'Refusée');
  await journeyWaitAction(browserIds.donation, 'Confirmer la remise');
  await journeyClick('Confirmer la remise', browserIds.donation);
  await waitUntil('DON completed in browser',
    '(() => {const id=' + JSON.stringify(browserIds.donation) +
    ';return [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")].some(c=>' +
    '[...c.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&c.innerText.includes("Terminé"));})()', 120);
  await journeyWaitAction(browserIds.trade, 'Confirmer la remise');
  await journeyClick('Confirmer la remise', browserIds.trade);
  await waitUntil('TROC completed in browser',
    '(() => {const id=' + JSON.stringify(browserIds.trade) +
    ';return [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")].some(c=>' +
    '[...c.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&c.innerText.includes("Terminé"));})()', 120);
  await journeyScreenshot('m9-journey-requester-don-troc-completed');

  const transactions = await browserApi(requester, '/api/transactions/me');
  const donation = browserFindTransaction(transactions, browserIds.donation, 'COMPLETED');
  const trade = browserFindTransaction(transactions, browserIds.trade, 'COMPLETED');
  for (const item of [donation, trade]) {
    assert.ok(item.ownerConfirmedAt && item.requesterConfirmedAt && item.completedAt,
      'Both user confirmations and completion must be durable for ' + item.id);
  }
  const listingChecks = [
    [browserIds.donation, 'COMPLETED'],
    [browserIds.rejected, 'AVAILABLE'],
    [browserIds.trade, 'COMPLETED'],
    [browserIds.offered, 'COMPLETED'],
  ];
  for (const [listingId, availability] of listingChecks) {
    const response = await fetch(browserGateway + '/api/listings/' + encodeURIComponent(listingId));
    assert.equal(response.status, 200, 'M9 fixture listing must remain available for verification');
    const record = await response.json();
    assert.equal(record.availabilityStatus, availability, 'Catalog listing state ' + listingId);
  }
  await journeyOpen('/annonces/' + encodeURIComponent(browserIds.donation),
    '.notice', 'completed donation not bookable');
  await waitUntil('completed listing unavailable to further request',
    'document.body.innerText.includes("Cet objet est déjà réservé ou attribué.")', 120);
  await journeyScreenshot('m9-journey-completed-don-no-duplicate');
  console.log('[M9 Journey] Real Chrome DON/TROC: create, reject, accept, 2 confirmations, COMPLETED, no duplicate: PASS');
}


// LOT 9B-F end-to-end Chrome acceptance. Browser actions mutate real data;
// authenticated Gateway GET requests are only used for verification.
let enrichedColorSeed = 0;
function enrichedChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}

function enrichedPng(color) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(64, 0);
  header.writeUInt32BE(64, 4);
  header[8] = 8;
  header[9] = 6;
  const row = Buffer.alloc(1 + 64 * 4);
  for (let x = 0; x < 64; x++) {
    const offset = 1 + x * 4;
    row[offset] = color;
    row[offset + 1] = (color + x * 3) % 256;
    row[offset + 2] = 255 - color;
    row[offset + 3] = 255;
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    enrichedChunk('IHDR', header),
    enrichedChunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 64 }, () => row)))),
    enrichedChunk('IEND', Buffer.alloc(0)),
  ]);
}

function enrichedFiles(slug) {
  const directory = join(profileDir, '9bf-photos-' + slug);
  mkdirSync(directory, { recursive: true });
  const serial = enrichedColorSeed++;
  return Array.from({ length: 5 }, (_, index) => {
    const path = join(directory, 'photo-' + (index + 1) + '.png');
    writeFileSync(path, enrichedPng(12 + serial * 23 + index * 33));
    return path;
  });
}

async function enrichedCreateListing(username, type, label, options = {}) {
  const slug = randomUUID().slice(0, 8);
  const title = options.title ?? ('9BF Chrome ' + label + ' ' + slug);
  const expectedWishes = options.tradeWishes ?? (type === 'TRADE'
    ? Array.from({ length: 5 }, (_, i) => '9BF contrepartie ' + (i + 1))
    : []);
  const memberToken = await browserToken(username);
  await journeyOpen('/espace', '.form-panel form.listing-form',
    'authenticated listing editor for ' + username);

  const radioSelector = '.form-panel input[name="operationType"][value="' + type + '"]';
  const selected = await evaluate('(() => {' +
    'const radio=document.querySelector(' + JSON.stringify(radioSelector) + ');' +
    'if(!radio)return false;radio.click();return true;})()');
  assert.equal(selected, true, 'Missing operationType radio ' + type);
  await waitUntil('Selected ' + type + ' in publication editor',
    '!!document.querySelector(' + JSON.stringify(radioSelector + ':checked') + ')', 60);

  async function advancePublicationStep(next, label) {
    const clicked = await evaluate('(() => {' +
      'const button=document.querySelector(".form-panel form.listing-form button[type=submit]");' +
      'if(!button || button.disabled || button.textContent.trim()!=="Continuer")return false;' +
      'button.click();return true;})()');
    assert.equal(clicked, true, 'Cannot proceed to ' + label + ' from the wizard');
    await waitUntil('publication step ' + next + ': ' + label,
      'document.querySelector(".publication-progress [aria-current=step]")?.textContent.includes(' +
      JSON.stringify(String(next)) + ')', 80);
    assert.equal(await evaluate('document.querySelector(".publication-step-heading")?.textContent.trim()'),
      label, 'Step heading and keyboard destination must match ' + label);
    assert.equal(await evaluate('document.activeElement?.classList.contains("publication-step-heading")'),
      true, 'Keyboard focus must follow the wizard into ' + label);
  }
  await advancePublicationStep(2, 'Description');
  // Keyboard regression: returning from Description must leave focus within
  // the first step, not stranded on document.body when its button disappears.
  const back = await evaluate('(() => {' +
    'const b=[...document.querySelectorAll(".form-panel form.listing-form button")].find(x=>x.textContent.trim()==="Retour");' +
    'if(!b)return false;b.click();return true;})()');
  assert.equal(back, true, 'Wizard must offer the previous-step action');
  await waitUntil('wizard return to first step',
    'document.querySelector(".publication-progress [aria-current=step]")?.textContent.includes("1") && ' +
    'document.querySelector(".publication-step-heading")?.textContent.trim()==="Choix"', 80);
  assert.equal(await evaluate('document.activeElement?.classList.contains("publication-step-heading")'),
    true, 'Returning to step 1 must restore keyboard focus inside the form');
  await advancePublicationStep(2, 'Description');

  // React controlled inputs are updated one at a time, allowing each onChange
  // commit before the next field. A batch of synthetic input events in a
  // single CDP evaluation may reuse stale React state between event handlers.
  async function fillReactField(selector, value, index = null) {
    const nodes = 'document.querySelectorAll(' + JSON.stringify(selector) + ')';
    const code = '(() => {' +
      'const nodes=' + nodes + ';' +
      'const element=nodes[' + (index === null ? '0' : index) + '];' +
      'if(!element)return false;' +
      'const proto=element.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;' +
      'Object.getOwnPropertyDescriptor(proto,"value").set.call(element,' + JSON.stringify(value) + ');' +
      'element.dispatchEvent(new Event("input",{bubbles:true}));return true;})()';
    assert.equal(await evaluate(code), true, 'Missing React field ' + selector);
    await sleep(90);
    const read = nodes + '[' + (index === null ? '0' : index) + ']?.value';
    assert.equal(await evaluate(read), value,
      'React field state did not retain ' + selector + ' ' + index);
  }
  await fillReactField('.form-panel form.listing-form label.field input', title);
  await fillReactField('.form-panel form.listing-form label.field textarea',
    options.description ??
      'Certification LOT 9B-F, publication réelle avec cinq photographies de test indépendantes.');
  if (type === 'TRADE') {
    for (let index = 0; index < 5; index++) {
      await fillReactField('.form-panel form.listing-form .wish-editor input',
        expectedWishes[index], index);
    }
  }
  await waitUntil('React form values retained',
    '(() => {const f=document.querySelector(".form-panel form.listing-form");' +
    'return !!f&&f.querySelector("label.field input")?.value===' + JSON.stringify(title) +
    '&&(!f.querySelector(".wish-editor")||[...f.querySelectorAll(".wish-editor input")].every(x=>x.value.trim()));})()', 60);

  await advancePublicationStep(3, 'Photos');
  // Unlike API-level fixture creation, this genuinely selects five files on
  // the browser's file input, firing the React change handler via Chrome CDP.
  const root = await command('DOM.getDocument', { depth: -1, pierce: true });
  const input = await command('DOM.querySelector', {
    nodeId: root.root.nodeId,
    selector: '.form-panel form.listing-form input[type=file]',
  });
  assert.ok(input.nodeId, 'Missing publication input[type=file]');
  const paths = options.photoPaths ?? enrichedFiles(slug);
  assert.equal(paths.length, 5, 'Exactly five files are required for the browser publication');
  for (const file of paths) assert.ok(existsSync(file), 'Missing browser publication media: ' + file);
  await command('DOM.setFileInputFiles', { nodeId: input.nodeId, files: paths });
  await waitUntil('Five image previews in React publication form',
    '(() => {const f=document.querySelector(".form-panel form.listing-form");' +
    'return !!f&&f.querySelector("input[type=file]")?.files.length===5' +
    '&&f.querySelectorAll(".upload-gallery img").length===5;})()', 120);
  await advancePublicationStep(4, 'Vérification');
  assert.equal(await evaluate('document.querySelector(".publication-review")?.textContent.includes(' +
    JSON.stringify(title) + ')'), true, 'Wizard review must preserve the real title');
  await journeyScreenshot('9bf-form-' + label + '-5-photos');

  const submit = await evaluate('(() => {const button=document.querySelector(".form-panel form.listing-form button[type=submit]");' +
    'if(!button||button.disabled)return false;button.click();return true;})()');
  assert.equal(submit, true, 'Cannot submit enriched listing with Chrome');
  await waitUntil('Real Chrome publication success ' + label,
    '(document.querySelector(".form-panel .notice--success")?.textContent??"").includes("Annonce complète déposée")' +
    '||(document.querySelector(".feedback-stack .notice--success")?.textContent??"").includes("Annonce complète déposée")', 150);
  const mine = await browserApi(memberToken, '/api/listings/me');
  const created = mine.find(x => x.title === title);
  assert.ok(created, 'Browser-submitted listing must be stored in Catalog');
  assert.equal(created.status, 'PENDING', 'Publication must require moderation');
  assert.equal(created.images.length, 5, 'Browser must have uploaded five real photos');
  assert.deepEqual(created.tradeWishes.map(w => w.label), expectedWishes,
    'All five trade wishes must be persisted exactly as typed by Chrome');
  await journeyScreenshot('9bf-pending-' + label);
  console.log('[LOT9B-F Chrome] Member UI published ' + label + ' with 5 images: PASS');
  return { id: created.id, title, token: memberToken, photoPaths: paths, expectedWishes };
}

async function enrichedModerate(listing, moderatorToken) {
  await journeyOpen('/moderation', '.moderation-list',
    'real moderation inbox for ' + listing.title);
  const cardPredicate = '(() => [' +
    '...document.querySelectorAll(".moderation-list .moderation-item")].some(' +
    'c=>c.textContent.includes(' + JSON.stringify(listing.title) + ')))()';
  await waitUntil('Pending listing in real moderation UI', cardPredicate, 120);
  // UX V3 #92: the queue is a compact list. Open the native disclosure
  // deliberately before requesting private photos and approving the item.
  const opened = await evaluate('(() => {' +
    'const row=[...document.querySelectorAll(".moderation-list .moderation-item")].find(' +
    'c=>c.textContent.includes(' + JSON.stringify(listing.title) + '));' +
    'if(!row||row.open||!row.querySelector("summary"))return false;' +
    'if(row.querySelector(".moderation-gallery-gate")?.getClientRects().length)return false;' +
    'row.querySelector("summary").click();return row.open;})()');
  assert.equal(opened, true, 'Moderator must expand the right pending listing before reviewing');
  await waitUntil('Moderation actions visible for ' + listing.title,
    '(() => {const row=[...document.querySelectorAll(".moderation-list .moderation-item")].find(' +
    'c=>c.textContent.includes(' + JSON.stringify(listing.title) + '));' +
    'return !!row?.open && !!row.querySelector(".moderation-gallery-gate button") && ' +
    'row.querySelector(".moderation-gallery-gate").getClientRects().length>0;})()', 80);
  const openGallery = '(() => {' +
    'const card=[...document.querySelectorAll(".moderation-list .moderation-item")]' +
    '.find(c=>c.textContent.includes(' + JSON.stringify(listing.title) + '));' +
    'const button=card?.querySelector(".moderation-gallery-gate button");' +
    'if(!button||button.disabled)return false;button.click();return true;})()';
  assert.equal(await evaluate(openGallery), true,
    'Moderator must be able to request private images through UI');
  await waitUntil('Private gallery hydrated with all 5 photos for ' + listing.title,
    '(() => {const card=[...document.querySelectorAll(".moderation-list .moderation-item")]' +
    '.find(c=>c.textContent.includes(' + JSON.stringify(listing.title) + '));' +
    'const images=[...(card?.querySelectorAll(".moderation-gallery img")??[])];' +
    'return images.length===5&&images.every(img=>img.complete&&img.naturalWidth>0);})()', 120);
  await journeyScreenshot('9bf-moderator-private-' + listing.id);
  const approve = '(() => {' +
    'const card=[...document.querySelectorAll(".moderation-list .moderation-item")]' +
    '.find(c=>c.textContent.includes(' + JSON.stringify(listing.title) + '));' +
    'const button=[...(card?.querySelectorAll("button")??[])].find(b=>' +
    'b.textContent?.trim()==="Approuver la fiche");' +
    'if(!button||button.disabled)return false;button.click();return true;})()';
  assert.equal(await evaluate(approve), true, 'Cannot approve browser-submitted listing');
  await waitUntil('Listing removed from moderation inbox after approval',
    '!([...document.querySelectorAll(".moderation-list .moderation-item")].some(' +
    'c=>c.textContent.includes(' + JSON.stringify(listing.title) + ')))', 120);
  const approved = await browserApi(moderatorToken, '/api/listings/' + listing.id);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.images.length, 5);
  await journeyScreenshot('9bf-approved-' + listing.id);
  console.log('[LOT9B-F Chrome] Moderator UI reviewed 5 private images and approved ' + listing.id + ': PASS');
}


// F2 regression gate: images must really load from Catalog/MinIO in Chrome.
// A screenshot-only check would not prove thumbnail and keyboard navigation.
async function runF2GalleryJourneys(listing) {
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await journeyOpen('/annonces/' + encodeURIComponent(listing.id),
    '.product-gallery__main img', 'F2 real gallery desktop', listing.title);
  const predicate = '(() => {' +
    'const buttons=[...document.querySelectorAll(".product-gallery__thumbnails button")];' +
    'const imgs=[...document.querySelectorAll(".product-gallery__thumbnails img")];' +
    'const lead=document.querySelector(".product-gallery__main img");' +
    'return buttons.length===5 && imgs.length===5 && ' +
    'imgs.every(img=>img.complete && img.naturalWidth>0) && ' +
    'lead?.complete && lead.naturalWidth>0 && lead.alt.includes("photo 1 sur 5");' +
    '})()';
  await waitUntil('F2 real five-image gallery loaded from MinIO', predicate, 120);
  const firstSrc = await evaluate('document.querySelector(".product-gallery__main img").src');
  assert.equal(await evaluate('(() => {' +
    'const button=document.querySelectorAll(".product-gallery__thumbnails button")[3];' +
    'if(!button)return false;button.click();return true;})()'), true);
  await waitUntil('F2 thumbnail 4 changes lead image',
    '(() => {const img=document.querySelector(".product-gallery__main img");' +
    'return img?.alt.includes("photo 4 sur 5") && img.src!==' +
    JSON.stringify(firstSrc) + ' && img.complete && img.naturalWidth>0;' +
    '})()', 120);
  assert.equal(await evaluate('document.querySelectorAll(".product-gallery__thumbnails button[aria-pressed=true]").length'),1,
    'Exactly one thumbnail must be selected');
  await journeyScreenshot('f2-gallery-five-photos-desktop');

  assert.equal(await evaluate('(() => {' +
    'const next=document.querySelector(".product-gallery__navigation button[aria-label=\\"Photo suivante\\"]");' +
    'if(!next)return false;next.click();return true;})()'), true);
  await waitUntil('F2 next button opens fifth photo',
    'document.querySelector(".product-gallery__main img")?.alt.includes("photo 5 sur 5")',120);
  assert.equal(await evaluate('(() => {' +
    'const prev=document.querySelector(".product-gallery__navigation button[aria-label=\\"Photo précédente\\"]");' +
    'if(!prev)return false;prev.click();return true;})()'), true);
  await waitUntil('F2 previous button opens fourth photo',
    'document.querySelector(".product-gallery__main img")?.alt.includes("photo 4 sur 5")',120);
  assert.equal(await evaluate('(() => {' +
    'const gallery=document.querySelector(".product-gallery");' +
    'if(!gallery)return false;' +
    'gallery.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true}));return true;})()'),true);
  await waitUntil('F2 keyboard arrow changes active photo',
    'document.querySelector(".product-gallery__main img")?.alt.includes("photo 3 sur 5")',120);

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await journeyOpen('/annonces/' + encodeURIComponent(listing.id),
    '.product-gallery__main img', 'F2 real gallery mobile', listing.title);
  await waitUntil('F2 mobile images display',predicate,120);
  const width = await evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(width.scroll <= width.client + 2,
    'F2 mobile gallery must not overflow the viewport: ' + JSON.stringify(width));
  const controls = await evaluate('(() => {' +
    'return [...document.querySelectorAll(".product-gallery__navigation button, .product-gallery__thumbnails button")]' +
    '.map(button => ({width:button.getBoundingClientRect().width,' +
    'height:button.getBoundingClientRect().height}));})()');
  assert.equal(controls.length, 7, 'F2 five-image gallery must expose seven photo controls');
  assert.ok(controls.every(({width,height}) => width >= 44 && height >= 44),
    'F2 mobile gallery touch targets must be at least 44×44px: ' + JSON.stringify(controls));
  await journeyScreenshot('f2-gallery-five-photos-mobile');
  console.log('[FRONT-V2/F2] Chrome: 5 MinIO photos loaded, thumbnails, next/previous, keyboard, responsive: PASS');
}

async function runEnrichedBrowserJourneys() {
  assert.equal(process.env.LOT9BF_RUN_BROWSER, 'true');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false,
  });
  const ownerToken = await browserToken('demo-moderator');
  const requesterToken = await browserToken('demo-user');

  // M9's tested script ends with demo-user signed in. Browser fixture creation
  // now happens exclusively through the member forms, not Prisma or POST API.
  const offered = await enrichedCreateListing('demo-user', 'TRADE', 'offered');
  await journeySwitchUser('demo-moderator');
  const donated = await enrichedCreateListing('demo-moderator', 'DONATION', 'donated');
  const traded = await enrichedCreateListing('demo-moderator', 'TRADE', 'traded');

  // The two accounts' PENDING listings must appear in the moderator inbox.
  for (const listing of [offered, donated, traded])
    await enrichedModerate(listing, ownerToken);

  if (process.env.FRONT_V2_RUN_GALLERY === 'true')
    await runF2GalleryJourneys(traded);

  await journeySwitchUser('demo-user');
  await journeyOffer(donated.id, null, '9bf-don',
    undefined, undefined, donated.title);
  await journeyOffer(traded.id, offered.id, '9bf-troc', offered.title,
    '9bf-journey-trade-comparison', traded.title);
  await journeyOpen('/espace', '.marketplace-dashboard', '9BF outgoing requests');
  await journeyWaitCard(donated.id, 'En attente');
  await journeyWaitCard(traded.id, 'En attente');
  browserFindProposal(await browserApi(requesterToken, '/api/proposals/me'), donated.id, 'PENDING');
  browserFindProposal(await browserApi(requesterToken, '/api/proposals/me'), traded.id, 'PENDING');
  await journeyScreenshot('9bf-both-proposals-pending');

  await journeySwitchUser('demo-moderator');
  for (const listing of [donated, traded]) {
    await journeyWaitAction(listing.id, 'Accepter');
    await journeyClick('Accepter', listing.id);
    await journeyWaitCard(listing.id, 'Acceptée');
    browserFindTransaction(await browserApi(ownerToken, '/api/transactions/me'),
      listing.id, 'IN_PROGRESS');
  }
  await journeyScreenshot('9bf-owner-accepted-don-troc');
  for (const listing of [donated, traded]) {
    await journeyWaitAction(listing.id, 'Confirmer la remise');
    await journeyClick('Confirmer la remise', listing.id);
    await journeyWaitConfirmation(listing.id);
  }
  await journeyScreenshot('9bf-first-confirmation');

  await journeySwitchUser('demo-user');
  for (const listing of [donated, traded]) {
    await journeyWaitAction(listing.id, 'Confirmer la remise');
    await journeyClick('Confirmer la remise', listing.id);
    await waitUntil('9BF completed transaction in browser for ' + listing.id,
      '(() => [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")]' +
      '.some(c=>[...c.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")===' +
      JSON.stringify('/annonces/' + listing.id) + ')&&c.innerText.includes("Terminé")))()', 120);
  }
  await journeyScreenshot('9bf-full-enriched-don-troc-completed');

  const finalTransactions = await browserApi(requesterToken, '/api/transactions/me');
  for (const listing of [donated, traded]) {
    const transaction = browserFindTransaction(finalTransactions, listing.id, 'COMPLETED');
    assert.ok(transaction.ownerConfirmedAt && transaction.requesterConfirmedAt &&
      transaction.completedAt, 'Both real user confirmations must persist');
  }
  for (const listing of [donated, traded, offered]) {
    const published = await browserApi(requesterToken, '/api/listings/' + listing.id);
    assert.equal(published.status, 'APPROVED');
    assert.equal(published.availabilityStatus, 'COMPLETED');
    assert.equal(published.images.length, 5,
      'Real browser-uploaded images must survive the completed trade');
    assert.deepEqual(published.tradeWishes.map(w => w.label), listing.expectedWishes,
      'Trade wishes typed in Chrome must survive publication and transaction');
    for (const [index, image] of published.images.entries()) {
      const url = '/api/listings/' + listing.id + '/images/' + image.id + '/content';
      const response = await fetch(browserGateway + url, { signal: AbortSignal.timeout(12000) });
      assert.equal(response.status, 200, 'MinIO public content must be readable: ' + url);
      assert.equal(response.headers.get('content-type')?.split(';')[0], 'image/png');
      const content = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(content, readFileSync(listing.photoPaths[index]),
        'Photo ' + index + ' overwritten or altered after all three browser uploads: ' + listing.id);
    }
  }
  console.log('[LOT9B-F Chrome] 15 image bytes + wish labels verified AFTER all Chrome publications: PASS');
  console.log('[LOT9B-F Chrome] Real Chrome: 3 listings, 15 photos, private moderation, DON/TROC two confirmations, COMPLETED: PASS');
}



async function journeyInitialLogin(username) {
  await journeyOpen('/espace', '.gate-card button', 'initial member sign-in');
  assert.equal(await evaluate('(() => {const b=document.querySelector(".gate-card button");if(!b)return false;b.click();return true;})()'),
    true, 'Missing initial sign-in button');
  await waitUntil('initial Keycloak sign-in form for ' + username,
    '!!document.querySelector("#username") && !!document.querySelector("#password")', 120);
  const signIn = '(() => {' +
    'const user=document.querySelector("#username"),pass=document.querySelector("#password");' +
    'const form=user?.closest("form")??document.querySelector("#kc-form-login");' +
    'if(!user||!pass||!form)return false;' +
    'user.value=' + JSON.stringify(username) + ';' +
    'pass.value=' + JSON.stringify(browserPassword(username)) + ';' +
    'user.dispatchEvent(new Event("input",{bubbles:true}));' +
    'pass.dispatchEvent(new Event("input",{bubbles:true}));' +
    'form.requestSubmit();return true;})()';
  assert.equal(await evaluate(signIn), true, 'Unable to submit initial Keycloak login for ' + username);
  const display = {
    'demo-user': 'Demo User',
    'demo-requester': 'Demo Requester',
    'demo-moderator': 'Demo Moderator',
    'demo-admin': 'Demo Admin',
  }[username];
  assert.ok(display, 'Unsupported jury Keycloak identity: ' + username);
  await waitUntil('initial authenticated dashboard for ' + username,
    'location.origin===' + JSON.stringify(new URL(base).origin) +
    '&&document.body.innerText.includes(' + JSON.stringify(display) + ')' +
    '&&!!document.querySelector(".marketplace-dashboard")', 120);
  console.log('[JURY FINAL] Initial browser login ' + username + ': PASS');
}

function juryManifestListing(manifest, key) {
  const listing = manifest.listings.find(item => item.key === key);
  assert.ok(listing, 'Missing jury manifest listing ' + key);
  return listing;
}

function juryListingOptions(listing) {
  return {
    title: listing.title,
    description: listing.description,
    tradeWishes: listing.tradeWishes,
    photoPaths: listing.images.map(image => join(process.cwd(), 'demo/jury', image.file)),
  };
}

async function juryRecentNotifications() {
  const port = process.env.NOTIFICATION_HOST_PORT ?? '13103';
  const response = await fetch('http://127.0.0.1:' + port + '/notifications/recent', {
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, 'Notification recent endpoint must be readable in the isolated stack');
  return response.json();
}

async function waitForJuryRejectedNotification(proposalId) {
  let latest = [];
  for (let attempt = 0; attempt < 80; attempt++) {
    latest = await juryRecentNotifications();
    const matches = latest.filter(item =>
      item?.event?.type === 'proposal.rejected' &&
      item?.event?.data?.proposalId === proposalId);
    if (matches.length === 1) return latest;
    if (matches.length > 1) {
      throw new Error('Duplicate persisted proposal.rejected events for ' + proposalId);
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for persisted proposal.rejected event ' + proposalId);
}

async function runJuryFinalBrowserJourneys() {
  assert.equal(juryFinalRun, true);
  const manifest = JSON.parse(readFileSync('demo/jury/manifest.json', 'utf8'));
  assert.equal(manifest.readiness, 'READY_FOR_REVIEW');
  assert.deepEqual(manifest.actors, {
    memberOwner: 'demo-user',
    memberRequester: 'demo-requester',
    moderator: 'demo-moderator',
    admin: 'demo-admin',
  });

  const ownerToken = await browserToken('demo-user');
  const requesterToken = await browserToken('demo-requester');
  const moderatorToken = await browserToken('demo-moderator');
  const adminToken = await browserToken('demo-admin');
  assert.ok(ownerToken.roles.includes('USER') && !ownerToken.roles.includes('ADMIN'));
  assert.ok(requesterToken.roles.includes('USER') &&
    !requesterToken.roles.includes('MODERATOR') && !requesterToken.roles.includes('ADMIN'));
  assert.ok(moderatorToken.roles.includes('MODERATOR') && !moderatorToken.roles.includes('ADMIN'));
  assert.ok(adminToken.roles.includes('ADMIN'));

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false,
  });
  await journeyInitialLogin('demo-user');

  const lampSpec = juryManifestListing(manifest, 'don-lampe');
  const shelfSpec = juryManifestListing(manifest, 'don-etagere');
  const bagSpec = juryManifestListing(manifest, 'troc-sac');
  const booksSpec = juryManifestListing(manifest, 'troc-livres');

  const lamp = await enrichedCreateListing('demo-user', 'DONATION', 'jury-don-lampe',
    juryListingOptions(lampSpec));
  const shelf = await enrichedCreateListing('demo-user', 'DONATION', 'jury-don-etagere',
    juryListingOptions(shelfSpec));
  const bag = await enrichedCreateListing('demo-user', 'TRADE', 'jury-troc-sac',
    juryListingOptions(bagSpec));

  await journeySwitchUser('demo-requester');
  const books = await enrichedCreateListing('demo-requester', 'TRADE', 'jury-troc-livres',
    juryListingOptions(booksSpec));

  await journeySwitchUser('demo-moderator');
  for (const listing of [lamp, shelf, bag, books]) {
    await enrichedModerate(listing, moderatorToken);
  }

  // Prove all 20 authorized files survived browser upload and public publication byte-for-byte.
  for (const listing of [lamp, shelf, bag, books]) {
    const published = await browserApi(moderatorToken, '/api/listings/' + listing.id);
    assert.equal(published.status, 'APPROVED');
    assert.equal(published.availabilityStatus, 'AVAILABLE');
    assert.equal(published.images.length, 5);
    for (const [index, image] of published.images.entries()) {
      const response = await fetch(browserGateway + '/api/listings/' + listing.id +
        '/images/' + image.id + '/content', { signal: AbortSignal.timeout(12000) });
      assert.equal(response.status, 200, 'Public jury media must be readable');
      const actual = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(actual, readFileSync(listing.photoPaths[index]),
        'Jury media bytes changed after upload: ' + listing.id + ' #' + (index + 1));
    }
  }
  await journeyScreenshot('jury-20-media-approved');

  await journeySwitchUser('demo-requester');
  await journeyOffer(lamp.id, null, 'jury-don-reject', undefined, undefined, lamp.title);
  await journeyOffer(shelf.id, null, 'jury-don-accept', undefined, undefined, shelf.title);
  await journeyOffer(bag.id, books.id, 'jury-trade-complete', books.title,
    'jury-trade-comparison', bag.title);
  await journeyOpen('/espace', '.marketplace-dashboard', 'jury requester pending proposals');
  for (const listing of [lamp, shelf, bag]) await journeyWaitCard(listing.id, 'En attente');
  let outgoing = await browserApi(requesterToken, '/api/proposals/me');
  const lampProposal = browserFindProposal(outgoing, lamp.id, 'PENDING');
  browserFindProposal(outgoing, shelf.id, 'PENDING');
  browserFindProposal(outgoing, bag.id, 'PENDING');
  await journeyScreenshot('jury-requester-three-pending');

  await journeySwitchUser('demo-user');
  await journeyWaitAction(lamp.id, 'Refuser');
  await journeyClick('Refuser', lamp.id);
  await journeyWaitCard(lamp.id, 'Refusée');
  const receivedAfterReject = await browserApi(ownerToken, '/api/proposals/received');
  const rejectedProposal = browserFindProposal(receivedAfterReject, lamp.id, 'REJECTED');
  assert.equal(rejectedProposal.id, lampProposal.id);

  for (const listing of [shelf, bag]) {
    await journeyWaitAction(listing.id, 'Accepter');
    await journeyClick('Accepter', listing.id);
    await journeyWaitCard(listing.id, 'Acceptée');
    browserFindTransaction(await browserApi(ownerToken, '/api/transactions/me'),
      listing.id, 'IN_PROGRESS');
  }
  await journeyScreenshot('jury-owner-reject-and-accept');

  for (const listing of [shelf, bag]) {
    await journeyWaitAction(listing.id, 'Confirmer la remise');
    await journeyClick('Confirmer la remise', listing.id);
    await journeyWaitConfirmation(listing.id);
    const tx = browserFindTransaction(await browserApi(ownerToken, '/api/transactions/me'),
      listing.id, 'IN_PROGRESS');
    assert.ok(tx.ownerConfirmedAt && !tx.requesterConfirmedAt,
      'Owner-only confirmation must keep transaction IN_PROGRESS');
  }
  await journeyScreenshot('jury-owner-first-confirmations');

  await journeySwitchUser('demo-requester');
  for (const listing of [shelf, bag]) {
    await journeyWaitAction(listing.id, 'Confirmer la remise');
    await journeyClick('Confirmer la remise', listing.id);
    await waitUntil('jury completed transaction ' + listing.id,
      '(() => [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")]' +
      '.some(c=>[...c.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")===' +
      JSON.stringify('/annonces/' + listing.id) + ')&&c.innerText.includes("Terminé")))()', 120);
  }
  await journeyScreenshot('jury-requester-completed-don-troc');

  const finalTransactions = await browserApi(requesterToken, '/api/transactions/me');
  for (const listing of [shelf, bag]) {
    const tx = browserFindTransaction(finalTransactions, listing.id, 'COMPLETED');
    assert.ok(tx.ownerConfirmedAt && tx.requesterConfirmedAt && tx.completedAt);
  }
  outgoing = await browserApi(requesterToken, '/api/proposals/me');
  browserFindProposal(outgoing, lamp.id, 'REJECTED');
  browserFindProposal(outgoing, shelf.id, 'ACCEPTED');
  browserFindProposal(outgoing, bag.id, 'ACCEPTED');

  for (const [listing, availability] of [
    [lamp, 'AVAILABLE'],
    [shelf, 'COMPLETED'],
    [bag, 'COMPLETED'],
    [books, 'COMPLETED'],
  ]) {
    const record = await browserApi(requesterToken, '/api/listings/' + listing.id);
    assert.equal(record.status, 'APPROVED');
    assert.equal(record.availabilityStatus, availability);
  }

  const recent = await waitForJuryRejectedNotification(rejectedProposal.id);
  const rejectedEvents = recent.filter(item =>
    item?.event?.type === 'proposal.rejected' &&
    item?.event?.data?.proposalId === rejectedProposal.id);
  assert.equal(rejectedEvents.length, 1,
    'Exactly one persisted proposal.rejected event is expected for the refused jury donation');
  assert.equal(new Set(recent.map(item => item?.event?.eventId).filter(Boolean)).size,
    recent.filter(item => item?.event?.eventId).length,
    'Notification recent inbox must not expose duplicate eventId values');

  const deniedAdminApi = await fetch(browserGateway + '/api/admin/catalog/summary', {
    headers: { authorization: 'Bearer ' + ownerToken.value },
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(deniedAdminApi.status, 403,
    'USER token must be rejected by the ADMIN Catalog API guard');

  await journeySwitchUser('demo-admin');
  const summary = await browserApi(adminToken, '/api/admin/catalog/summary');
  assert.ok(summary.total >= 4 && summary.byStatus.approved >= 4,
    'ADMIN summary must include the four final jury listings');
  await journeyOpen('/admin', '.admin-v2__stats', 'jury ADMIN dashboard');
  await waitUntil('jury ADMIN metrics visible',
    'document.querySelectorAll(".admin-v2__metric strong").length===4', 120);
  await journeyScreenshot('jury-admin-dashboard');

  await journeySwitchUser('demo-user');
  await journeyOpen('/admin', '.gate-card--denied', 'jury USER forbidden from ADMIN');
  assert.equal(await evaluate('document.body.innerText.includes("Accès réservé aux administrateurs")'),
    true, 'USER must be denied from the ADMIN dashboard');
  await journeyScreenshot('jury-user-admin-denied');

  const report = {
    sha: process.env.GITHUB_SHA ?? null,
    readiness: manifest.readiness,
    listings: {
      'don-lampe': lamp.id,
      'don-etagere': shelf.id,
      'troc-sac': bag.id,
      'troc-livres': books.id,
    },
    proposals: {
      rejected: rejectedProposal.id,
      donationAccepted: browserFindProposal(outgoing, shelf.id, 'ACCEPTED').id,
      tradeAccepted: browserFindProposal(outgoing, bag.id, 'ACCEPTED').id,
    },
    outcomes: {
      donationRejected: 'REJECTED',
      donationAccepted: 'COMPLETED',
      trade: 'COMPLETED',
      adminRbac: 'PASS',
      media: '20/20 byte-identical after browser upload',
      notificationRejectedUnique: 'PASS',
    },
  };
  writeFileSync(join(output, 'jury-final-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('[JURY FINAL] Real Chrome: 4 listings, 20 authorized media, DON reject, DON complete, TROC complete, ADMIN/USER RBAC: PASS');
}

async function runFrontV2HomeJourney() {
  assert.equal(process.env.FRONT_V2_RUN_HOME, 'true');
  const moderatorToken = await browserToken('demo-moderator');
  let publicListings = await browserApi(moderatorToken, '/api/listings');

  // Keep enough real approved fixtures to exercise a meaningful catalogue.
  const needed = Math.max(0, 7 - publicListings.length);
  if (needed) await journeySwitchUser('demo-moderator');
  for (let index = 0; index < needed; index++) {
    const entry = await enrichedCreateListing('demo-moderator', 'DONATION', 'f1-extra-' + index);
    await enrichedModerate(entry, moderatorToken);
  }
  publicListings = await browserApi(moderatorToken, '/api/listings');
  assert.ok(publicListings.length >= 7,
    'F1 requires at least seven real approved articles');

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  // Screen 01 — Accueil is a landing page with previews, not a collection of pseudo-pages.
  await journeyOpen('/', '.home-v2__welcome h1', 'Prototype 01 public homepage');
  const navigation = await evaluate('(() => ({' +
    'desktop:[...document.querySelectorAll(".pm-main-nav a")].map(a=>a.getAttribute("href")),' +
    'mobile:[...document.querySelectorAll(".pm-mobilebar a")].map(a=>a.getAttribute("href")),' +
    'footerColumns:document.querySelectorAll(".pm-footer__columns > div").length' +
    '}))()');
  assert.deepEqual(
    navigation.desktop,
    ['/', '/boutique', '/echanges', '/fanzines', '/festival'],
    'Prototype desktop header must expose five dedicated pages',
  );
  assert.deepEqual(
    navigation.mobile,
    ['/', '/boutique', '/echanges', '/publier', '/espace'],
    'Prototype mobile bar must expose task-oriented destinations',
  );
  assert.equal(navigation.footerColumns, 4,
    'Prototype footer must keep four columns');

  const homeContract = await evaluate('(() => {' +
    'const hero=[...document.querySelectorAll(".home-v2__hero-actions a")].map(a=>a.getAttribute("href"));' +
    'const links=[...document.querySelectorAll(".home-v2__grid .listing-card__link")].map(a=>a.getAttribute("href"));' +
    'const fake=document.querySelectorAll("[data-product],[data-add],[data-cartqty]");' +
    'return {hero,links,fake:fake.length,' +
    'shop:!!document.querySelector(\'.pm-home-shop-teaser a[href="/boutique"]\'),' +
    'fanzine:!!document.querySelector(\'.pm-story-grid a[href="/fanzines"]\'),' +
    'festival:!!document.querySelector(\'.pm-story-grid a[href="/festival"]\')};})()');
  assert.deepEqual(homeContract.hero, ['/boutique', '/echanges'],
    'Homepage hero must navigate to dedicated Boutique and Exchanges pages');
  assert.equal(homeContract.fake, 0,
    'Homepage must not expose fake commerce controls');
  assert.equal(homeContract.shop && homeContract.fanzine && homeContract.festival, true,
    'Homepage previews must link to their dedicated pages');

  await waitUntil('Prototype home real community preview',
    'document.querySelectorAll(".home-v2__grid .listing-card").length===3', 120);
  const homePreviewLinks = await evaluate(
    '[...document.querySelectorAll(".home-v2__grid .listing-card__link")].map(a=>a.getAttribute("href"))',
  );
  assert.deepEqual(
    homePreviewLinks,
    publicListings.slice(0, 3).map(item => '/annonces/' + item.id),
    'Homepage community section must be a three-item real-data preview',
  );
  await journeyScreenshot('prototype-01-home-desktop');

  // Screen 02 — Boutique is now backed by the real Catalog domain.
  await journeyOpen('/boutique', '.pm-shop-layout', 'Prototype 02 Boutique');
  const boutique = await evaluate('(() => ({' +
    'filters:document.querySelectorAll(".pm-shop-filters label").length,' +
    'cards:document.querySelectorAll(".pm-real-product-card").length,' +
    'empty:!!document.querySelector(".pm-prototype-empty"),' +
    'fake:document.querySelectorAll("[data-fake-product],[data-fake-price]").length,' +
    'categoryHeading:document.querySelector(".pm-shop-filters h2")?.textContent ?? "",' +
    'catalogNote:document.querySelector(".pm-future-note")?.textContent ?? ""}))()');
  assert.ok(boutique.filters >= 1,
    'Boutique must expose the real Catalog category filter');
  assert.equal(boutique.fake, 0,
    'Boutique must never inject fake commercial product data');
  assert.ok(
    boutique.cards >= 0 && (boutique.cards > 0 || boutique.empty),
    'Boutique must render real product cards or an explicit real-catalog empty state',
  );
  assert.ok(
    boutique.categoryHeading.includes('Catégories réelles') &&
      boutique.catalogNote.includes('Les prix et stocks sont issus du service Catalog') &&
      boutique.catalogNote.includes('Stripe reste en mode test'),
    'Boutique must describe the real Catalog/Commerce/Stripe-test state',
  );
  await journeyScreenshot('prototype-02-boutique-desktop');

  // Screen 04 — Fanzines is a dedicated editorial page.
  await journeyOpen('/fanzines', '.pm-editorial-hero', 'Prototype 04 Fanzines');
  assert.equal(
    await evaluate('document.querySelectorAll(".pm-formula-grid article").length'),
    3,
    'Fanzines must expose the three prototype formula cards',
  );
  assert.equal(
    await evaluate('document.body.innerText.includes("39,90 €") || document.body.innerText.includes("29,00 €")'),
    false,
    'Fanzines must not invent prototype prices before real subscriptions exist',
  );
  await journeyScreenshot('prototype-04-fanzines-desktop');

  // Screen 06 — Festival has its own page.
  await journeyOpen('/festival', '.pm-festival-hero', 'Prototype 06 Festival');
  assert.equal(
    await evaluate('document.querySelectorAll(".pm-news-grid article").length'),
    3,
    'Festival must keep the three-column editorial structure',
  );
  await journeyScreenshot('prototype-06-festival-desktop');

  // Screen 07 — real donation/trade catalogue lives here, not on Accueil.
  await journeyOpen('/echanges', '.pm-exchange-hero', 'Prototype 07 Exchanges');
  await waitUntil('Prototype 07 real Catalog cards',
    'document.querySelectorAll(".pm-exchange-grid .pm-exchange-card").length>=' +
      publicListings.length, 120);
  let exchangeLinks = await evaluate(
    '[...document.querySelectorAll(".pm-exchange-grid .pm-exchange-card__link")].map(a=>a.getAttribute("href"))',
  );
  assert.deepEqual(
    exchangeLinks,
    publicListings.map(item => '/annonces/' + item.id),
    'Exchanges page must render the real approved Catalog ordering',
  );

  const filters = await evaluate(
    '[...document.querySelectorAll(".pm-filter-pills button")].map(b=>b.textContent.trim())',
  );
  assert.equal(filters.length, 3,
    'Prototype 07 must expose All / Trades / Donations filters');

  // Real DON filter.
  assert.equal(await evaluate('(() => {' +
    'const button=[...document.querySelectorAll(".pm-filter-pills button")]' +
    '.find(el=>el.textContent.includes("Dons"));if(!button)return false;button.click();return true;})()'),
    true, 'Prototype 07 must expose a Donations filter');
  const donationLinks = publicListings
    .filter(item => item.operationType === 'DONATION')
    .map(item => '/annonces/' + item.id);
  await waitUntil('Prototype 07 DON filter',
    'document.querySelectorAll(".pm-exchange-grid .pm-exchange-card__link").length===' + donationLinks.length,
    120);
  exchangeLinks = await evaluate(
    '[...document.querySelectorAll(".pm-exchange-grid .pm-exchange-card__link")].map(a=>a.getAttribute("href"))',
  );
  assert.deepEqual(exchangeLinks, donationLinks,
    'DON filter must show only real donation listings');

  // Return to All before visual/accessibility checks.
  assert.equal(await evaluate('(() => {' +
    'const button=[...document.querySelectorAll(".pm-filter-pills button")]' +
    '.find(el=>el.textContent.includes("Toutes"));if(!button)return false;button.click();return true;})()'),
    true, 'Prototype 07 must expose an All filter');
  await waitUntil('Prototype 07 all listings restored',
    'document.querySelectorAll(".pm-exchange-grid .pm-exchange-card").length===' + publicListings.length, 120);

  // F7/#81: a real approved fixture without images must display the existing accessible placeholder.
  const noPhoto = publicListings.find(item =>
    item.status === 'APPROVED' && item.images.length === 0);
  assert.ok(noPhoto, 'F7 #81 requires an approved no-photo Catalog fixture');
  const missingImage = await evaluate('(() => {' +
    'const link=document.querySelector(' +
      JSON.stringify('.pm-exchange-grid .pm-exchange-card__link[href="/annonces/' + noPhoto.id + '"]') + ');' +
    'const card=link?.closest(".pm-exchange-card");const cover=card?.querySelector(".pm-exchange-card__fallback");' +
    'if(!card||!cover)return null;return {label:cover.querySelector("strong")?.textContent.trim()??"",' +
    'images:cover.querySelectorAll("img").length,height:cover.getBoundingClientRect().height,' +
    'link:link.getAttribute("href")};})()');
  assert.ok(missingImage, 'No-photo real listing must be present on Exchanges');
  assert.equal(
    missingImage.label,
    noPhoto.operationType === 'DONATION' ? 'DON' : 'ÉCHANGE',
    'No-photo listing must use the V2 operation fallback without inventing an image',
  );
  assert.equal(missingImage.images, 0, 'No fake product photo may be invented');
  assert.ok(missingImage.height >= 175, 'Placeholder must preserve the cover area');
  assert.equal(missingImage.link, '/annonces/' + noPhoto.id);
  await journeyScreenshot('prototype-07-exchanges-desktop');

  // Mobile 320/390 — dedicated pages must remain usable and touch-friendly.
  await command('Emulation.setTouchEmulationEnabled', {
    enabled: true, maxTouchPoints: 1,
  });
  for (const width of [320, 390]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await journeyOpen('/echanges', '.pm-exchange-hero h1',
      'Prototype 07 mobile at ' + width + 'px');
    await waitUntil('Prototype 07 mobile real cards at ' + width + 'px',
      'document.querySelectorAll(".pm-exchange-grid .pm-exchange-card").length>=1', 120);

    const checks = await evaluate('(() => {' +
      'const root=document.documentElement;' +
      'const grid=document.querySelector(".pm-exchange-grid");' +
      'const filters=[...document.querySelectorAll(".pm-filter-pills button")];' +
      'const headerTargets=[...document.querySelectorAll(".pm-header .pm-icon-button,.pm-header .pm-account-menu summary,.pm-header .pm-header__login")];' +
      'const footerTargets=[...document.querySelectorAll(".pm-footer a")];' +
      'return {scroll:root.scrollWidth,client:root.clientWidth,' +
      'touch:matchMedia("(any-pointer: coarse)").matches,touchPoints:navigator.maxTouchPoints,' +
      'columns:getComputedStyle(grid).gridTemplateColumns.split(" ").length,' +
      'filters:filters.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})),' +
      'header:headerTargets.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})),' +
      'footer:footerTargets.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))};})()');
    assert.ok(checks.scroll <= checks.client + 2,
      'Prototype mobile page must not overflow: ' + JSON.stringify(checks));
    assert.equal(checks.columns, 1,
      'Exchanges catalogue must use one card column on phones');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".pm-mobilebar")).display'),
      'grid', 'Prototype mobile bottom navigation must be visible');
    assert.equal(checks.touch, true);
    assert.ok(checks.touchPoints >= 1);
    assert.ok(checks.filters.length === 3 && checks.filters.every(t=>t.h>=44),
      'Prototype filter touch targets must be >=44px: ' + JSON.stringify(checks.filters));
    assert.ok(checks.header.length >= 2 && checks.header.every(t=>t.w>=44&&t.h>=44),
      'Prototype header touch targets must be >=44px');
    assert.ok(checks.footer.length >= 4 && checks.footer.every(t=>t.w>=44&&t.h>=44),
      'Prototype footer touch targets must be >=44px');

    // Force :hover under touch emulation to ensure cards do not lift/zoom.
    await command('DOM.enable');
    await command('CSS.enable');
    const documentNode = await command('DOM.getDocument', { depth: 1 });
    const cardSelector = '.pm-exchange-grid .pm-exchange-card:has(.pm-exchange-card__visual img)';
    const hoverNode = await command('DOM.querySelector', {
      nodeId: documentNode.root.nodeId, selector: cardSelector,
    });
    const hoverLink = await command('DOM.querySelector', {
      nodeId: documentNode.root.nodeId, selector: cardSelector + ' .pm-exchange-card__link',
    });
    assert.ok(hoverNode.nodeId && hoverLink.nodeId,
      'Touch test requires one real Catalog card with photo');
    await command('CSS.forcePseudoState', {
      nodeId: hoverNode.nodeId, forcedPseudoClasses: ['hover'],
    });
    await command('CSS.forcePseudoState', {
      nodeId: hoverLink.nodeId, forcedPseudoClasses: ['hover'],
    });
    const touchCard = await evaluate('(() => {' +
      'const el=document.querySelector(' + JSON.stringify(cardSelector) + ');' +
      'const link=el.querySelector(".pm-exchange-card__link");' +
      'const image=el.querySelector(".pm-exchange-card__visual img");' +
      'const arrow=el.querySelector(".pm-exchange-card__cta span");' +
      'const cta=el.querySelector(".pm-exchange-card__cta");' +
      'const block=el.querySelector(".pm-exchange-card__date");' +
      'return {hover:el.matches(":hover"),linkHover:link.matches(":hover"),' +
      'transform:getComputedStyle(el).transform,imageTransform:getComputedStyle(image).transform,' +
      'arrowTransform:getComputedStyle(arrow).transform,ctaTop:cta?.getBoundingClientRect().top,' +
      'contentBottom:block?.getBoundingClientRect().bottom};})()');
    assert.equal(touchCard.hover, true);
    assert.equal(touchCard.linkHover, true);
    assert.equal(touchCard.transform, 'none',
      'Touch card must not lift when hover is forced');
    assert.equal(touchCard.imageTransform, 'none',
      'Touch image must not zoom');
    assert.equal(touchCard.arrowTransform, 'none',
      'Touch CTA arrow must not move');
    assert.ok(
      Number.isFinite(touchCard.ctaTop) &&
      Number.isFinite(touchCard.contentBottom) &&
      touchCard.ctaTop >= touchCard.contentBottom + 8,
      'Listing CTA must not overlap metadata',
    );
    await command('CSS.forcePseudoState', {
      nodeId: hoverLink.nodeId, forcedPseudoClasses: [],
    });
    await command('CSS.forcePseudoState', {
      nodeId: hoverNode.nodeId, forcedPseudoClasses: [],
    });

    await journeyScreenshot('prototype-07-exchanges-mobile-' + width);
  }
  await command('Emulation.setTouchEmulationEnabled', { enabled: false });

  console.log('[#149] Dedicated pages: home preview, boutique, exchanges, fanzines, festival, mobile: PASS');
}


async function runFinalAccessibilityAutomation() {
  assert.equal(process.env.FRONT_V2_RUN_A11Y_FINAL, 'true');

  // 200% browser zoom on a 1280px desktop yields roughly a 640 CSS-pixel
  // layout viewport. This is an automated layout proxy, not a substitute for
  // the final manual browser-zoom check required by #71.
  await command('Emulation.setDeviceMetricsOverride', {
    width: 640, height: 900, deviceScaleFactor: 2, mobile: false,
  });
  await journeyOpen('/', '.home-v2', 'F7 200-percent zoom layout proxy');
  const zoomHome = await evaluate('({scroll:document.documentElement.scrollWidth,' +
    'client:document.documentElement.clientWidth,' +
    'mobilebar:getComputedStyle(document.querySelector(".pm-mobilebar")).display})');
  assert.ok(zoomHome.scroll <= zoomHome.client + 2,
    '200% zoom proxy must not overflow home horizontally: ' + JSON.stringify(zoomHome));
  await journeyScreenshot('f7-zoom-200-proxy-home');

  await journeyOpen('/admin', '.admin-v2__stats', 'F7 200-percent zoom ADMIN proxy');
  const zoomAdmin = await evaluate('({scroll:document.documentElement.scrollWidth,' +
    'client:document.documentElement.clientWidth,' +
    'metrics:document.querySelectorAll(".admin-v2__metric strong").length})');
  assert.ok(zoomAdmin.scroll <= zoomAdmin.client + 2 && zoomAdmin.metrics === 4,
    '200% zoom proxy must keep ADMIN readable without horizontal overflow: ' +
    JSON.stringify(zoomAdmin));
  await journeyScreenshot('f7-zoom-200-proxy-admin');

  let reduced;
  let slow;

  // The app already declares a global prefers-reduced-motion policy. Exercise
  // the real CSS cascade instead of only checking for the source declaration.
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  try {
    await journeyOpen('/', '.home-v2', 'F7 reduced-motion preference');
    await waitUntil('F7 reduced-motion real Catalog card',
      'document.querySelectorAll(".home-v2__grid .listing-card--interactive").length >= 1', 120);
    reduced = await evaluate('(() => {' +
      'const card=document.querySelector(".listing-card--interactive");' +
      'const root=getComputedStyle(document.documentElement);' +
      'if(!card)return null;' +
      'const cardCss=getComputedStyle(card);' +
      'return {matches:matchMedia("(prefers-reduced-motion: reduce)").matches,' +
      'scrollBehavior:root.scrollBehavior,' +
      'transitionDuration:cardCss.transitionDuration,' +
      'animationDuration:cardCss.animationDuration};})()');
    assert.ok(reduced && reduced.matches && reduced.scrollBehavior === 'auto',
      'Reduced-motion media preference must be active and disable smooth scrolling: ' +
      JSON.stringify(reduced));
    const maxTransition = Math.max(...reduced.transitionDuration.split(',')
      .map(value => Number.parseFloat(value.trim()) || 0));
    assert.ok(maxTransition <= 0.01,
      'Reduced-motion must collapse card transitions: ' + JSON.stringify(reduced));
    await journeyScreenshot('f7-reduced-motion-home');
  } finally {
    await command('Emulation.setEmulatedMedia', { features: [] });
  }

  // Full degraded-network journey: home -> real 5+ image detail/gallery ->
  // authenticated personal space, then a targeted Catalog API outage and
  // recovery through the real Home "Réessayer" control.
  const networkAdminToken = await browserToken('demo-admin');
  const networkListings = await browserApi(networkAdminToken, '/api/listings');
  const networkGalleryTarget = networkListings.find(item =>
    Array.isArray(item.images) && item.images.length >= 5);
  assert.ok(networkGalleryTarget,
    'F7 degraded-network journey requires one real approved listing with at least 5 images');

  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: 64 * 1024,
    uploadThroughput: 32 * 1024,
    connectionType: 'cellular3g',
  });
  try {
    await journeyOpen('/', '.home-v2', 'F7 Slow 3G home');
    await waitUntil('F7 Slow 3G real Catalog cards',
      'document.querySelectorAll(".home-v2__grid .listing-card").length >= 1', 120);
    const slowHome = await evaluate('({cards:document.querySelectorAll(".home-v2__grid .listing-card").length,' +
      'scroll:document.documentElement.scrollWidth,' +
      'client:document.documentElement.clientWidth})');
    assert.ok(slowHome.cards >= 1 && slowHome.scroll <= slowHome.client + 2,
      'Slow 3G home must remain usable: ' + JSON.stringify(slowHome));
    await journeyScreenshot('f7-slow-3g-home');

    await journeyOpen('/annonces/' + encodeURIComponent(networkGalleryTarget.id),
      '.product-gallery__main img', 'F7 Slow 3G listing detail with gallery');
    await waitUntil('F7 Slow 3G gallery images loaded from MinIO',
      '(() => {' +
      'const buttons=[...document.querySelectorAll(".product-gallery__thumbnails button")];' +
      'const thumbs=[...document.querySelectorAll(".product-gallery__thumbnails img")];' +
      'const lead=document.querySelector(".product-gallery__main img");' +
      'return buttons.length>=5 && thumbs.length>=5 &&' +
      'thumbs.every(img=>img.complete&&img.naturalWidth>0)&&' +
      'lead?.complete&&lead.naturalWidth>0;})()', 120);
    const slowDetail = await evaluate('(() => {' +
      'const thumbs=[...document.querySelectorAll(".product-gallery__thumbnails img")];' +
      'const lead=document.querySelector(".product-gallery__main img");' +
      'return {photos:thumbs.length,loadedPhotos:thumbs.filter(img=>img.complete&&img.naturalWidth>0).length,' +
      'scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,' +
      'mainLoaded:!!lead&&lead.complete&&lead.naturalWidth>0};})()');
    assert.ok(slowDetail.mainLoaded && slowDetail.photos >= 5 &&
      slowDetail.loadedPhotos === slowDetail.photos &&
      slowDetail.scroll <= slowDetail.client + 2,
      'Slow 3G detail/gallery must load real MinIO pixels and remain usable: ' +
      JSON.stringify(slowDetail));
    await journeyScreenshot('f7-slow-3g-detail-gallery');

    await journeyOpen('/espace', '.marketplace-dashboard', 'F7 Slow 3G personal space');
    await waitUntil('F7 Slow 3G personal space and exchanges settled',
      '(() => {' +
      'const dashboard=document.querySelector(".marketplace-dashboard");' +
      'const exchangeLoading=[...document.querySelectorAll(".marketplace-dashboard [role=status]")]' +
      '.some(el=>el.textContent?.includes("Actualisation de vos demandes"));' +
      'const exchangeError=dashboard?.querySelector("[role=alert]");' +
      'const listingLoading=document.querySelector("#mes-articles .page-loading");' +
      'return !!document.querySelector("#mes-articles")&&!!dashboard&&!listingLoading' +
      '&&!exchangeLoading&&!exchangeError;})()', 120);
    const slowSpace = await evaluate('(() => {' +
      'const dashboard=document.querySelector(".marketplace-dashboard");' +
      'const counts=[...document.querySelectorAll(".marketplace-dashboard__shortcuts a:nth-child(-n+3) span")]' +
      '.map(el=>el.textContent?.trim());' +
      'const exchangeLoading=[...document.querySelectorAll(".marketplace-dashboard [role=status]")]' +
      '.some(el=>el.textContent?.includes("Actualisation de vos demandes"));' +
      'return {scroll:document.documentElement.scrollWidth,' +
      'client:document.documentElement.clientWidth,dashboard:!!dashboard,' +
      'listingError:document.querySelector("#mes-articles .notice--error")?.textContent??null,' +
      'exchangeError:dashboard?.querySelector("[role=alert]")?.textContent??null,' +
      'exchangeLoading,counts};})()');
    assert.ok(slowSpace.dashboard && !slowSpace.listingError &&
      !slowSpace.exchangeError && !slowSpace.exchangeLoading &&
      slowSpace.counts.length === 3 && slowSpace.counts.every(value => value !== '…') &&
      slowSpace.scroll <= slowSpace.client + 2,
      'Slow 3G personal space/exchanges must fully settle without false success: ' +
      JSON.stringify(slowSpace));
    await journeyScreenshot('f7-slow-3g-personal-space');

    // Restore normal transport, then simulate a scoped Catalog/API outage.
    // This keeps the app shell available so we can assert the actual error UI.
    await command('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'none',
    });
    await command('Network.setBlockedURLs', { urls: ['*/api/listings*'] });
    await journeyOpen('/', '.home-v2', 'F7 Catalog API outage state');
    await waitUntil('F7 Catalog preview API error is visible',
      '!!document.querySelector(".home-v2__error[role=alert]")' +
      '&&document.querySelector(".home-v2__error")?.innerText.includes("Impossible de charger l’aperçu communautaire")' +
      '&&[...document.querySelectorAll(".home-v2__error button")].some(b=>b.textContent?.trim()==="Réessayer")', 120);
    const outage = await evaluate('({alert:document.querySelector(".home-v2__error")?.innerText??null,' +
      'cards:document.querySelectorAll(".home-v2__grid .listing-card").length})');
    assert.ok(outage.alert?.includes('Impossible de charger l’aperçu communautaire') && outage.cards === 0,
      'Catalog preview outage must expose a real error state without stale success cards: ' +
      JSON.stringify(outage));
    await journeyScreenshot('f7-network-outage-error');

    await command('Network.setBlockedURLs', { urls: [] });
    assert.equal(await evaluate('(() => {' +
      'const retry=[...document.querySelectorAll(".home-v2__error button")]' +
      '.find(b=>b.textContent?.trim()==="Réessayer");if(!retry)return false;' +
      'retry.click();return true;})()'), true,
    'Home error state must expose a usable retry control');
    await waitUntil('F7 network recovery reloads the real community preview',
      'document.querySelectorAll(".home-v2__grid .listing-card").length === 3' +
      '&&!document.querySelector(".home-v2__error")', 120);
    const recovery = await evaluate('({cards:document.querySelectorAll(".home-v2__grid .listing-card").length,' +
      'scroll:document.documentElement.scrollWidth,' +
      'client:document.documentElement.clientWidth})');
    assert.ok(recovery.cards === 3 && recovery.scroll <= recovery.client + 2,
      'Catalog recovery must restore the three-card real preview: ' + JSON.stringify(recovery));
    await journeyScreenshot('f7-network-recovery');

    slow = {
      home: slowHome,
      detailGallery: slowDetail,
      personalSpace: slowSpace,
      outage,
      recovery,
    };
  } finally {
    await command('Network.setBlockedURLs', { urls: [] }).catch(() => {});
    await command('Network.setCacheDisabled', { cacheDisabled: false }).catch(() => {});
    await command('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'none',
    }).catch(() => {});
    await command('Network.disable').catch(() => {});
  }

  writeFileSync(join(output, 'a11y-final-report.json'), JSON.stringify({
    sha: process.env.GITHUB_SHA ?? null,
    zoom200LayoutProxy: {
      home: zoomHome,
      admin: zoomAdmin,
      result: 'PASS',
      note: 'Automated CSS-layout proxy; manual real browser zoom 200% remains required by #71.',
    },
    reducedMotion: { ...reduced, result: 'PASS' },
    slow3g: { ...slow, result: 'PASS' },
  }, null, 2) + '\n');

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  console.log('[FRONT-V2/F7] Automated #71 evidence: zoom proxy + reduced-motion + full Slow 3G/outage recovery PASS');
}

async function runAdminDashboardBrowser() {
  assert.equal(process.env.FRONT_V2_RUN_ADMIN, 'true');
  const adminToken = await browserToken('demo-admin');
  const summary = await browserApi(adminToken, '/api/admin/catalog/summary');
  assert.ok(Number.isInteger(summary.total) && summary.total >= 1);

  await journeySwitchUser('demo-moderator');
  await journeyOpen('/moderation', '.management-v2__guide',
    'UX V4 genuine moderator workflow guidance');
  assert.equal(await evaluate('document.querySelectorAll(".management-v2__guide > div").length'), 3,
    'UX V4 moderator must see the three existing review steps');
  await journeyScreenshot('uxv4-moderator-review-guide');
  await journeyOpen('/admin', '.gate-card--denied',
    'F5 moderator forbidden from ADMIN dashboard');
  assert.equal(await evaluate('document.body.innerText.includes("Accès réservé aux administrateurs")'),
    true, 'MODERATOR must see the actual ADMIN denial');
  assert.equal(await evaluate('!!document.querySelector(".admin-v2__stats")'),
    false, 'No ADMIN numbers rendered for MODERATOR');
  assert.equal(await evaluate('!!document.querySelector(' + JSON.stringify('.pm-account-menu__panel a[href="/admin"]') + ')'),
    false, 'No ADMIN account action for a MODERATOR');
  await journeyScreenshot('f5-moderator-access-denied');

  await journeySwitchUser('demo-admin');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await journeyOpen('/admin', '.admin-v2__stats',
    'F5 true Keycloak ADMIN dashboard');
  const adminQuickLinks = await evaluate('[...document.querySelectorAll(".admin-v2__quick-actions a")]' +
    '.map(a=>a.getAttribute("href"))');
  assert.deepEqual(
    adminQuickLinks,
    ['/admin/boutique', '/moderation', '/echanges', '/messages'],
    'Prototype ADMIN shortcuts must point to real authorized destinations only',
  );
  await waitUntil('F5 ADMIN values from Catalog', '(() => {' +
    'const values=[...document.querySelectorAll(".admin-v2__metric strong")]' +
    '.map(el=>Number(el.textContent.replaceAll(/\\s/g,"")));' +
    'const expected=' + JSON.stringify([
      summary.total,
      summary.byStatus.approved,
      summary.byStatus.pending,
      summary.byStatus.rejected,
    ]) + ';' +
    'return values.length===4 && values.every((value,index)=>value===expected[index]);' +
    '})()', 120);
  assert.equal(await evaluate('document.querySelector(".admin-v2__role")?.textContent'),
    'Administrateur');
  assert.equal(await evaluate('!!document.querySelector(' + JSON.stringify('.pm-account-menu__panel a[href="/admin"]') + ')'),
    true, 'ADMIN account action must exist for authorized sessions');
  assert.equal(await evaluate('document.body.innerText.includes("Suspendre un utilisateur")'),
    false, 'Do not expose fake account suspension UI');
  assert.equal(await evaluate('document.querySelectorAll(".admin-v2__sidebar").length'), 0,
    'UX V3: admin uses the shared header navigation without duplicate sidebar');
  assert.equal(await evaluate('document.querySelectorAll(".pm-main-nav a").length'), 5,
    'L1: shared desktop header keeps the five public prototype destinations');
  await journeyScreenshot('f5-admin-summary-catalog-desktop');

  // Tablet and zoom-sensitive viewports: ADMIN adds a fourth header link.
  for (const width of [1120, 1024, 900, 768]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await journeyOpen('/admin', '.admin-v2__stats',
      'F5 ADMIN tablet header at ' + width + 'px');
    await waitUntil('F5 tablet Catalog data at ' + width + 'px',
      'document.querySelectorAll(".admin-v2__metric strong").length===4', 120);
    const navigation = await evaluate('(() => {' +
      'const nav=document.querySelector(".pm-main-nav");' +
      'const mobile=document.querySelector(".pm-mobilebar");' +
      'return {nav:getComputedStyle(nav).display,mobile:getComputedStyle(mobile).display,' +
      'fit:document.documentElement.scrollWidth<=document.documentElement.clientWidth+2};' +
      '})()');
    assert.equal(navigation.fit, true,
      'L1 ADMIN header must not overflow at ' + width + 'px');
    if (width > 860) {
      assert.equal(navigation.nav, 'flex',
        'L1 desktop/tablet navigation remains visible above 860px');
      assert.equal(navigation.mobile, 'none',
        'L1 mobile bottom navigation stays hidden above 860px');
    } else {
      assert.equal(navigation.nav, 'none',
        'L1 desktop navigation hides on mobile');
      assert.equal(navigation.mobile, 'grid',
        'L1 mobile bottom navigation replaces the desktop menu');
    }
    if (width === 1024 || width === 768) {
      await journeyScreenshot('f5-admin-tablet-' + width);
    }
  }

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await journeyOpen('/admin', '.admin-v2__stats',
    'F5 real ADMIN dashboard on mobile');
  await waitUntil('F5 mobile Catalog metrics ready',
    'document.querySelectorAll(".admin-v2__metric strong").length === 4', 120);
  const dimensions = await evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dimensions.scroll <= dimensions.client + 2,
    'F5 mobile dashboard must not overflow horizontally: ' + JSON.stringify(dimensions));
  await journeyScreenshot('f5-admin-summary-catalog-mobile');
  console.log('[FRONT-V2/F5] Chrome: MODERATOR denied, ADMIN Catalog totals verified, desktop/mobile PASS');
}

try {
  await startCdp(await waitForPort());
  if (juryFinalRun) {
    await runJuryFinalBrowserJourneys();
  } else {
    await capture('/annonces/' + encodeURIComponent(id), 1440, 1000,
      'don-detail-desktop', 'M9 live donation refusal', '.marketplace-action');
    await capture('/annonces/' + encodeURIComponent(id), 390, 844,
      'don-detail-mobile', 'Cette trouvaille vous intéresse ?', '.marketplace-action');
    await capture('/espace', 1440, 900,
      'espace-login-desktop', 'Votre étagère vous attend.', '.gate-card');
    await loginAsDemoOwner();
    await capture('/espace', 1440, 980,
      'espace-owner-inbox-desktop', 'Refusée', '.marketplace-dashboard');
    await loginAsDemoRequester();
    await capture('/espace', 1440, 980,
      'espace-requester-outbox-desktop', 'Mes demandes envoyées', '.marketplace-dashboard');
    console.log('[M9 Browser] Chrome desktop/mobile + both authenticated user roles: PASS');
    await runRealBrowserJourneys();
    if (process.env.LOT9BF_RUN_BROWSER === 'true') await runEnrichedBrowserJourneys();
    if (process.env.FRONT_V2_RUN_HOME === 'true') await runFrontV2HomeJourney();
    if (process.env.FRONT_V2_RUN_ADMIN === 'true') await runAdminDashboardBrowser();
    if (process.env.FRONT_V2_RUN_A11Y_FINAL === 'true') await runFinalAccessibilityAutomation();
  }
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
  browser.kill('SIGTERM');
  await sleep(300);
  rmSync(profileDir, { recursive: true, force: true });
}
