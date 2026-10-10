#!/usr/bin/env node
// Real-browser smoke against disposable Compose. Uses built-in Node 24
// WebSocket/CDP to WAIT for hydrated Next.js UI, never a premature dump-dom.
// Captures only synthetic public listing and unauthenticated member entry.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
const apiResponses = [];

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

  const image = await command('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const file = join(output, filename + '.png');
  writeFileSync(file, Buffer.from(image.data, 'base64'));
  assert.ok(statSync(file).size > 8000, 'Screenshot too small: ' + file);
  console.log('[M9 Browser] ' + filename + ': PASS (' + file + ')');
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
    const button = [...document.querySelectorAll('header button')]
      .find(element => element.textContent?.trim() === 'Sortir');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(logoutClicked, true, 'Owner logout button must be available');

  await waitUntil('Keycloak logout returns to the public app', `(
    location.origin === ${JSON.stringify(new URL(base).origin)} &&
    !document.body.innerText.includes('Demo Moderator')
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
const browserIds = {
  donation: 'm9-browser-donation-' + randomUUID(),
  rejected: 'm9-browser-rejected-' + randomUUID(),
  trade: 'm9-browser-trade-' + randomUUID(),
  offered: 'm9-browser-offered-' + randomUUID(),
};
const browserGateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');

async function browserToken(username) {
  const issuer = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:18081';
  const response = await fetch(issuer + '/realms/projet-indiv26/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'cli',
      username, password: username + '-local',
    }),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, 'Could not get fixture token for ' + username);
  const data = await response.json();
  const claims = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url'));
  return { value: data.access_token, sub: claims.sub };
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

async function journeyOpen(route, expectedSelector, label) {
  await command('Page.navigate', { url: new URL(route, base).href });
  await waitUntil(label, '!!document.querySelector(' + JSON.stringify(expectedSelector) + ')', 120);
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
    '&&card.innerText.includes(status));})()';
  await waitUntil('UI listing ' + targetListingId + ' status ' + status, predicate, 120);
}

async function journeyOffer(targetId, offeredId, label) {
  await journeyOpen('/annonces/' + encodeURIComponent(targetId), '.marketplace-action form',
    'authenticated ' + label + ' form');
  if (offeredId) {
    const change = '(() => {const element=document.querySelector(".marketplace-action select");' +
      'if(!element)return false;' +
      'const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set;' +
      'setter.call(element,' + JSON.stringify(offeredId) + ');' +
      'element.dispatchEvent(new Event("change",{bubbles:true}));return true;})()';
    assert.equal(await evaluate(change), true, 'Missing TROC offered-listing selector');
    await waitUntil('TROC visual side-by-side preview',
      '(document.querySelector(".marketplace-compare")?.innerText??"").includes("M9 visual trade offered")', 120);
    await journeyScreenshot('m9-journey-trade-comparison');
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

async function journeySwitchUser(username) {
  const logout = '(() => {const button=[...document.querySelectorAll("header button")]' +
    '.find(el=>el.textContent?.trim()==="Sortir");if(!button)return false;' +
    'button.click();return true;})()';
  assert.equal(await evaluate(logout), true, 'Missing real browser logout');
  await waitUntil('Keycloak logout and app return',
    'location.origin===' + JSON.stringify(new URL(base).origin) +
    '&& !document.body.innerText.includes("Demo User") && !document.body.innerText.includes("Demo Moderator")', 120);
  await journeyOpen('/espace', '.gate-card button', 'member sign-in after logout');
  assert.equal(await evaluate('(() => {const b=document.querySelector(".gate-card button");if(!b)return false;b.click();return true;})()'),
    true, 'Missing sign-in button');
  await waitUntil('Keycloak sign-in form for ' + username,
    '!!document.querySelector("#username") && !!document.querySelector("#password")', 120);
  const signIn = '(() => {' +
    'const user=document.querySelector("#username"),pass=document.querySelector("#password");' +
    'const form=user?.closest("form")??document.querySelector("#kc-form-login");' +
    'if(!user||!pass||!form)return false;' +
    'user.value=' + JSON.stringify(username) + ';' +
    'pass.value=' + JSON.stringify(username + '-local') + ';' +
    'user.dispatchEvent(new Event("input",{bubbles:true}));' +
    'pass.dispatchEvent(new Event("input",{bubbles:true}));' +
    'form.requestSubmit();return true;})()';
  assert.equal(await evaluate(signIn), true, 'Unable to submit Keycloak login for ' + username);
  const display = username === 'demo-user' ? 'Demo User' : 'Demo Moderator';
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

  // Existing smoke test leaves a real Keycloak demo-user session in Chrome.
  await journeyOffer(browserIds.donation, null, 'don-accepted');
  await journeyOffer(browserIds.rejected, null, 'don-rejected');
  await journeyOffer(browserIds.trade, browserIds.offered, 'troc');

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
  await journeyClick('Refuser', browserIds.rejected);
  await journeyWaitCard(browserIds.rejected, 'Refusée');
  browserFindProposal(await browserApi(owner, '/api/proposals/received'), browserIds.rejected, 'REJECTED');
  await journeyScreenshot('m9-journey-owner-rejected');

  await journeyClick('Accepter', browserIds.donation);
  await journeyWaitCard(browserIds.donation, 'Acceptée');
  browserFindTransaction(await browserApi(owner, '/api/transactions/me'), browserIds.donation, 'IN_PROGRESS');
  await journeyScreenshot('m9-journey-owner-donation-accepted');

  await journeyClick('Accepter', browserIds.trade);
  await journeyWaitCard(browserIds.trade, 'Acceptée');
  browserFindTransaction(await browserApi(owner, '/api/transactions/me'), browserIds.trade, 'IN_PROGRESS');
  await journeyScreenshot('m9-journey-owner-trade-accepted');

  await journeyClick('Confirmer la remise', browserIds.donation);
  await waitUntil('owner donation confirmation shown',
    'document.body.innerText.includes("Votre confirmation : reçue")', 120);
  let ownerTx = await browserApi(owner, '/api/transactions/me');
  assert.ok(browserFindTransaction(ownerTx, browserIds.donation, 'IN_PROGRESS').ownerConfirmedAt,
    'First donation confirmation must be stored without completing the transaction');
  await journeyClick('Confirmer la remise', browserIds.trade);
  ownerTx = await browserApi(owner, '/api/transactions/me');
  assert.ok(browserFindTransaction(ownerTx, browserIds.trade, 'IN_PROGRESS').ownerConfirmedAt,
    'First trade confirmation must not finish the transaction');
  await journeyScreenshot('m9-journey-owner-confirmed-first');

  // Second real user finishes BOTH transactions via the visible buttons.
  await journeySwitchUser('demo-user');
  await journeyWaitCard(browserIds.rejected, 'Refusée');
  await journeyClick('Confirmer la remise', browserIds.donation);
  await waitUntil('DON completed in browser',
    '(() => {const id=' + JSON.stringify(browserIds.donation) +
    ';return [...document.querySelectorAll(".marketplace-transactions .marketplace-entry")].some(c=>' +
    '[...c.querySelectorAll("a[href]")].some(a=>a.getAttribute("href")==="/annonces/"+id)' +
    '&&c.innerText.includes("Terminé"));})()', 120);
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

try {
  await startCdp(await waitForPort());
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
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
  browser.kill('SIGTERM');
  await sleep(300);
  rmSync(profileDir, { recursive: true, force: true });
}
