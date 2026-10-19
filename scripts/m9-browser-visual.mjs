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
// Preserve each caller's viewport during temporary login geometry checks.
// All viewport changes flow through command(), including prior Chrome journeys.
let currentDeviceMetrics = null;

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
  // Exercise Keycloak's own toggle, including restoration to masked mode.
  // Do not log credential contents or replace Keycloak event handlers.
  const visibility = await evaluate('(() => {' +
    'const password=document.querySelector("#password"),' +
    'group=password?.closest(".pf-v5-c-input-group"),' +
    'toggle=group?.querySelector("button");' +
    'if(!password||!group||!toggle)return null;' +
    'const before=password.type;toggle.focus();' +
    'const groupRing=parseFloat(getComputedStyle(group).outlineWidth);' +
    'const toggleRing=parseFloat(getComputedStyle(toggle).outlineWidth);' +
    'toggle.click();const revealed=password.type;' +
    'toggle.click();const restored=password.type;' +
    'return {before,revealed,restored,groupRing,toggleRing,' +
    'toggleIsCurrent:document.contains(toggle),' +
    'isFocusVisible:toggle.matches(":focus-visible"),' +
    'inLoginForm:!!toggle.closest("#kc-form-login"),' +
    'cssOverrideMatched:toggle.matches("#kc-form-login .pf-v5-c-input-group button:focus-visible"),' +
    'toggleId:toggle.id,groupTag:group.tagName,' +
    'groupInLoginForm:!!group.closest("#kc-form-login")};})()');
  assert.ok(visibility && visibility.before === 'password' &&
    visibility.revealed === 'text' && visibility.restored === 'password',
    'Native password visibility must toggle and re-mask at ' +
    viewport + ': ' + JSON.stringify(visibility));
  assert.ok(visibility.groupRing >= 2 && visibility.toggleRing === 0,
    'Password group needs one visible focus outline (not two) at ' +
    viewport + ': ' + JSON.stringify(visibility));
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
    'pass.value=' + JSON.stringify(username + '-local') + ';' +
    'user.dispatchEvent(new Event("input",{bubbles:true}));' +
    'pass.dispatchEvent(new Event("input",{bubbles:true}));' +
    'form.requestSubmit();return true;})()';
  assert.equal(await evaluate(signIn), true, 'Unable to submit Keycloak login for ' + username);
  const display = {
    'demo-user': 'Demo User',
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

async function enrichedCreateListing(username, type, label) {
  const slug = randomUUID().slice(0, 8);
  const title = '9BF Chrome ' + label + ' ' + slug;
  const expectedWishes = type === 'TRADE'
    ? Array.from({ length: 5 }, (_, i) => '9BF contrepartie ' + (i + 1))
    : [];
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
  const paths = enrichedFiles(slug);
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


async function runFrontV2HomeJourney() {
  assert.equal(process.env.FRONT_V2_RUN_HOME, 'true');
  const moderatorToken = await browserToken('demo-moderator');
  let publicListings = await browserApi(moderatorToken, '/api/listings');

  // Ensure a real approved catalogue spanning at least two pages.
  // New fixtures are published through the actual Chrome form and approved
  // after private gallery review, never inserted directly into the UI.
  const needed = Math.max(0, 7 - publicListings.length);
  if (needed) await journeySwitchUser('demo-moderator');
  for (let index = 0; index < needed; index++) {
    const entry = await enrichedCreateListing('demo-moderator', 'DONATION', 'f1-extra-' + index);
    await enrichedModerate(entry, moderatorToken);
  }
  publicListings = await browserApi(moderatorToken, '/api/listings');
  assert.ok(publicListings.length >= 7, 'F1 requires at least seven real approved articles');

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await journeyOpen('/', '.home-v2__welcome h1', 'FRONT-V2 F1 public homepage');
  await waitUntil('F1 exactly six cards on the first page',
    'document.querySelectorAll(".home-v2__grid .listing-card").length===6' +
    '&&document.querySelector(".home-v2__results")?.innerText.includes("sur")', 120);

  const reportedTotal = Number(await evaluate(
    'document.querySelector(".home-v2__facts strong")?.textContent',
  ));
  assert.equal(reportedTotal, publicListings.length,
    'The hero must show the actual number of approved Catalog listings');
  const firstLinks = await evaluate('([...document.querySelectorAll(".home-v2__grid .listing-card__link")]' +
    '.map(a=>a.getAttribute("href")) )');
  assert.equal(firstLinks.length, 6);
  await journeyScreenshot('f1-catalog-six-articles-desktop');

  assert.equal(await evaluate('(() => {' +
    'const button=document.querySelector(".home-v2__pagination button[aria-label=\\"Page 2\\"]");' +
    'if(!button)return false;button.click();return true;})()'), true,
  'F1 must display a usable second page');
  const secondSize = Math.min(6, publicListings.length - 6);
  await waitUntil('F1 second page has new records and correct count',
    '(() => {const cards=[...document.querySelectorAll(".home-v2__grid .listing-card__link")];' +
    'return cards.length===' + secondSize +
    '&&document.querySelector(".home-v2__pagination button[aria-current=page]")?.textContent==="2"' +
    '&&cards[0]?.getAttribute("href")!==' + JSON.stringify(firstLinks[0]) + ';})()', 120);
  const secondLinks = await evaluate('[...document.querySelectorAll(".home-v2__grid .listing-card__link")]' +
    '.map(a=>a.getAttribute("href"))');
  assert.ok(secondLinks.every(url => !firstLinks.includes(url)),
    'No duplicate listing may appear across the first two pages');
  await journeyScreenshot('f1-catalog-second-page');

  // Changing the type while page 2 is active must reset pagination to page 1.
  const filterSet = await evaluate('(() => {const select=document.querySelector(".home-v2__filter-type select");' +
    'if(!select)return false;select.value="DONATION";' +
    'select.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  assert.equal(filterSet, true, 'Missing real DON filter');
  const donationIds = publicListings.filter(item => item.operationType === 'DONATION')
    .map(item => '/annonces/' + item.id);
  const expectedDonLinks = donationIds.slice(0, 6);
  await waitUntil('F1 DON filter shows only donation listings and resets page', '(() => {' +
    'const links=[...document.querySelectorAll(".home-v2__grid .listing-card__link")]' +
    '.map(a=>a.getAttribute("href"));' +
    'const expected=' + JSON.stringify(expectedDonLinks) + ';' +
    'return document.querySelector(".home-v2__filter-type select")?.value==="DONATION"' +
    ' && links.length===expected.length && links.every((href,i)=>href===expected[i])' +
    ' && !document.querySelector(".home-v2__pagination button[aria-current=page]")?.textContent?.includes("2");' +
    '})()', 120);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".home-v2__grid .listing-card__link")]' +
    '.map(a=>a.getAttribute("href"))'), expectedDonLinks,
    'Every filtered page-one card must have type DONATION');

  // Search for a real title, never for a mocked or hardcoded catalogue item.
  const title = publicListings.find(item => item.title.startsWith('9BF Chrome'))?.title;
  assert.ok(title, 'Missing real Chrome enriched listing to test search');
  const searchSet = await evaluate('(() => {const select=document.querySelector(".home-v2__filter-type select");' +
    'select.value="ALL";select.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  assert.equal(searchSet, true);
  await sleep(150);
  assert.equal(await evaluate('(() => {const input=document.querySelector("#home-v2-search");' +
    'if(!input)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' +
    JSON.stringify(title) + ');input.dispatchEvent(new Event("input",{bubbles:true}));return true;})()'),
    true, 'F1 search input must be interactive');
  await waitUntil('F1 search finds exactly the real listing',
    '(() => {const cards=[...document.querySelectorAll(".home-v2__grid .listing-card")];' +
    'return cards.length===1&&cards[0].textContent.includes(' + JSON.stringify(title) + ');})()', 120);
  await journeyScreenshot('f1-catalog-search-live-title');

  // F7/#81 break-ui: a real approved legacy fixture without images must
  // display a neutral, accessible placeholder rather than a blank 185px void.
  const noPhoto = publicListings.find(item =>
    item.status === 'APPROVED' && item.images.length === 0);
  assert.ok(noPhoto, 'F7 #81 requires an approved no-photo Catalog fixture');
  assert.equal(await evaluate('(() => {' +
    'const input=document.querySelector("#home-v2-search");' +
    'if(!input)return false;' +
    'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,' +
    JSON.stringify(noPhoto.title) + ');' +
    'input.dispatchEvent(new Event("input",{bubbles:true}));return true;})()'),
    true, 'F7 #81 no-photo search input must work');
  await waitUntil('F7 #81 no-photo card visible', '(() => {' +
    'const cards=[...document.querySelectorAll(".home-v2__grid .listing-card")];' +
    'return cards.length===1 &&' +
    'cards[0].querySelector("h3")?.textContent===' + JSON.stringify(noPhoto.title) + ' &&' +
    '!!cards[0].querySelector(".listing-card__cover--empty");})()', 120);
  const missingImage = await evaluate('(() => {' +
    'const card=document.querySelector(".home-v2__grid .listing-card");' +
    'const cover=card.querySelector(".listing-card__cover--empty");' +
    'return {label:cover.innerText.trim(),images:cover.querySelectorAll("img").length,' +
    'height:cover.getBoundingClientRect().height,' +
    'link:card.querySelector(".listing-card__link")?.getAttribute("href")};})()');
  assert.equal(missingImage.label, 'Aucune photo disponible');
  assert.equal(missingImage.images, 0, 'F7 #81 must never invent a product photo');
  assert.ok(missingImage.height >= 175, 'F7 #81 placeholder occupies the existing cover area');
  assert.equal(missingImage.link, '/annonces/' + noPhoto.id,
    'F7 #81 placeholder must preserve the real product detail link');
  await journeyScreenshot('f7-catalog-no-photo-desktop');

  // F7/mobile-native: mobile metrics alone do NOT emulate a touch pointer.
  // Real CDP touch emulation is necessary to exercise (any-pointer: coarse).
  await command('Emulation.setTouchEmulationEnabled', {
    enabled: true, maxTouchPoints: 1,
  });
  for (const width of [320, 390]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await journeyOpen('/', '.home-v2__welcome h1',
      'F7 mobile homepage at ' + width + 'px');
    await waitUntil('F7 six cards at ' + width + 'px',
      'document.querySelectorAll(".home-v2__grid .listing-card").length===6', 120);
    const checks = await evaluate('(() => {' +
      'const root=document.documentElement;' +
      'const search=document.querySelector("#home-v2-search");' +
      'const type=document.querySelector(".home-v2__filter-type select");' +
      'const c=document.querySelector(".home-v2__grid");' +
      'const buttons=[...document.querySelectorAll(".home-v2__pagination button:not(:disabled)")];' +
      'return {scroll:root.scrollWidth,client:root.clientWidth,' +
      'touch:matchMedia("(any-pointer: coarse)").matches,' +
      'touchPoints:navigator.maxTouchPoints,' +
      'searchFont:parseFloat(getComputedStyle(search).fontSize),' +
      'typeFont:parseFloat(getComputedStyle(type).fontSize),' +
      'columns:getComputedStyle(c).gridTemplateColumns.split(" ").length,' +
      'buttons:buttons.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))};' +
      '})()');
    assert.ok(checks.scroll <= checks.client + 2,
      'F7 mobile homepage must not overflow at ' + width + 'px: ' + JSON.stringify(checks));
    assert.equal(checks.columns, 1, 'F7 expects one card column on phone');
    assert.equal(checks.touch, true, 'F7 must emulate coarse touch media at ' + width + 'px');
    assert.ok(checks.touchPoints >= 1, 'F7 Chrome must expose at least one touch point');
    assert.ok(checks.searchFont >= 16 && checks.typeFont >= 16,
      'F7 mobile fields must use >=16px to prevent iOS zoom: ' + JSON.stringify(checks));
    assert.ok(checks.buttons.length > 0 && checks.buttons.every(b=>b.w>=44 && b.h>=44),
      'F7 pagination touch targets >=44px: ' + JSON.stringify(checks));
    // Force :hover at the CSS engine level. Merely moving a mouse under touch
    // emulation can be ignored and would produce a false-positive regression.
    await command('DOM.enable');
    await command('CSS.enable');
    const documentNode = await command('DOM.getDocument', { depth: 1 });
    const cardSelector = '.home-v2__grid .listing-card--interactive:has(.listing-card__cover img)';
    const hoverNode = await command('DOM.querySelector', {
      nodeId: documentNode.root.nodeId, selector: cardSelector,
    });
    const hoverLink = await command('DOM.querySelector', {
      nodeId: documentNode.root.nodeId, selector: cardSelector + ' .listing-card__link',
    });
    assert.ok(hoverNode.nodeId && hoverLink.nodeId,
      'F7 must find a real Catalog card with photo and detail link');
    await command('CSS.forcePseudoState', {
      nodeId: hoverNode.nodeId, forcedPseudoClasses: ['hover'],
    });
    await command('CSS.forcePseudoState', {
      nodeId: hoverLink.nodeId, forcedPseudoClasses: ['hover'],
    });
    const touchCard = await evaluate('(() => {' +
      'const el=document.querySelector(' + JSON.stringify(cardSelector) + ');' +
      'const link=el.querySelector(".listing-card__link");' +
      'const image=el.querySelector(".listing-card__cover img");' +
      'const arrow=el.querySelector(".listing-card__cta span");' +
      'const css=getComputedStyle(el);return {hover:el.matches(":hover"),' +
      'linkHover:link.matches(":hover"),' +
      'transform:css.transform,shadow:css.boxShadow,border:css.borderTopColor,' +
      'imageTransform:getComputedStyle(image).transform,' +
      'arrowTransform:getComputedStyle(arrow).transform};})()');
    assert.equal(touchCard.hover, true, 'F7 must actually apply :hover to the test card');
    assert.equal(touchCard.linkHover, true, 'F7 must apply :hover to the detail link');
    assert.equal(touchCard.transform, 'none', 'F7 touch card must not lift on hover');
    assert.equal(touchCard.border, 'rgb(226, 236, 231)',
      'F7 touch card must retain its base border color');
    assert.ok(touchCard.shadow.includes('5px 20px'),
      'F7 touch card must retain its base shadow: ' + JSON.stringify(touchCard));
    assert.equal(touchCard.imageTransform, 'none',
      'F7 touch must not leave the image scaled');
    assert.equal(touchCard.arrowTransform, 'none',
      'F7 touch must not leave the detail CTA arrow displaced');
    await command('CSS.forcePseudoState', {
      nodeId: hoverLink.nodeId, forcedPseudoClasses: [],
    });
    await command('CSS.forcePseudoState', {
      nodeId: hoverNode.nodeId, forcedPseudoClasses: [],
    });
    await journeyScreenshot('f7-catalog-mobile-' + width);
  }
  await command('Emulation.setTouchEmulationEnabled', { enabled: false });
  console.log('[FRONT-V2/F1] Chrome: true Catalog ≥7; six per page; page 2 distinct; DON filter; live search; mobile: PASS');
}

async function runAdminDashboardBrowser() {
  assert.equal(process.env.FRONT_V2_RUN_ADMIN, 'true');
  const adminToken = await browserToken('demo-admin');
  const summary = await browserApi(adminToken, '/api/admin/catalog/summary');
  assert.ok(Number.isInteger(summary.total) && summary.total >= 1);

  await journeySwitchUser('demo-moderator');
  await journeyOpen('/admin', '.gate-card--denied',
    'F5 moderator forbidden from ADMIN dashboard');
  assert.equal(await evaluate('document.body.innerText.includes("Accès réservé aux administrateurs")'),
    true, 'MODERATOR must see the actual ADMIN denial');
  assert.equal(await evaluate('!!document.querySelector(".admin-v2__stats")'),
    false, 'No ADMIN numbers rendered for MODERATOR');
  assert.equal(await evaluate('!!document.querySelector(' + JSON.stringify('.primary-nav__link[href="/admin"]') + ')'),
    false, 'No ADMIN link for a MODERATOR');
  await journeyScreenshot('f5-moderator-access-denied');

  await journeySwitchUser('demo-admin');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await journeyOpen('/admin', '.admin-v2__stats',
    'F5 true Keycloak ADMIN dashboard');
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
  assert.equal(await evaluate('!!document.querySelector(' + JSON.stringify('.primary-nav__link[href="/admin"]') + ')'),
    true, 'ADMIN navigation must exist for authorized sessions');
  assert.equal(await evaluate('document.body.innerText.includes("Suspendre un utilisateur")'),
    false, 'Do not expose fake account suspension UI');
  assert.equal(await evaluate('document.querySelectorAll(".admin-v2__sidebar").length'), 0,
    'UX V3: admin uses the shared header navigation without duplicate sidebar');
  assert.equal(await evaluate('document.querySelectorAll(".primary-nav a[aria-current=page]").length'), 1,
    'UX V3: primary header has one active link on admin');
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
    const closed = await evaluate('(() => {' +
      'const nav=document.querySelector(".primary-nav");' +
      'const menu=document.querySelector(".site-header__menu-toggle");' +
      'return getComputedStyle(menu).display!=="none" &&' +
      'getComputedStyle(nav).display==="none" &&' +
      'document.documentElement.scrollWidth<=document.documentElement.clientWidth+2;' +
      '})()');
    assert.equal(closed, true, 'F5 ADMIN navigation must collapse and fit at ' + width + 'px');
    await evaluate('document.querySelector(".site-header__menu-toggle").click()');
    assert.equal(await evaluate('document.querySelector(".site-header__menu-toggle").getAttribute("aria-expanded")'),
      'true', 'F5 ADMIN menu must open at ' + width + 'px');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".primary-nav")).display'),
      'flex', 'F5 ADMIN menu must expose links at ' + width + 'px');
    const fit = await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2');
    assert.equal(fit, true, 'F5 expanded ADMIN menu must not overflow at ' + width + 'px');
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
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
  browser.kill('SIGTERM');
  await sleep(300);
  rmSync(profileDir, { recursive: true, force: true });
}
