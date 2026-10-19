#!/usr/bin/env node
// Read-only Keycloak Admin API preflight for the jury sandbox.
// Never provisions users, changes roles, or prints tokens/credentials.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = {
  memberOwner: 'USER',
  memberRequester: 'USER',
  moderator: 'MODERATOR',
  admin: 'ADMIN',
};
const asActor = value => typeof value === 'string' ? value.trim() : '';

// Never accept arbitrary remote HTTPS destinations with an Admin bearer token.
// Access a VERIFIED disposable Keycloak by running in that sandbox, or establish
// a separately reviewed local port forward to its port 8081 first.
export function validateAdminEndpoint(input) {
  const address = new URL(input);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname);
  if (!loopback || address.protocol !== 'http:' || address.port !== '8081' ||
      address.pathname !== '/' || address.username || address.password ||
      address.search || address.hash) {
    throw new Error('Keycloak Admin API must be the verified loopback port 8081');
  }
  return address.origin;
}

export async function checkJuryKeycloakActors(plan, {
  baseUrl, realm = 'projet-indiv26', token, fetchImpl = fetch,
} = {}) {
  const errors = [];
  const members = plan?.actors ?? {};
  const seen = new Set();
  for (const key of Object.keys(EXPECTED)) {
    const name = asActor(members[key]);
    if (!name || name.toLowerCase() === 'pending') {
      errors.push('Missing real identity for ' + key);
      continue;
    }
    const normalized = name.toLocaleLowerCase('en');
    if (seen.has(normalized)) errors.push('Duplicate jury identity: ' + key);
    seen.add(normalized);
  }
  if (errors.length) return { errors, checked: 0 };

  let root;
  try { root = validateAdminEndpoint(baseUrl); }
  catch { return { errors: ['Invalid Keycloak Admin API base URL'], checked: 0 }; }
  if (!token || typeof token !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(realm)) {
    return { errors: ['Admin access token and valid realm are required'], checked: 0 };
  }
  // Unauthenticated OIDC discovery FIRST. Never send any Admin bearer token
  // until a local Keycloak realm reports its exact expected issuer.
  const issuer = root + '/realms/' + encodeURIComponent(realm);
  try {
    const discovery = await fetchImpl(issuer + '/.well-known/openid-configuration', {
      method: 'GET', redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!discovery.ok || (await discovery.json())?.issuer !== issuer) {
      return { errors: ['Local Keycloak issuer mismatch or discovery unavailable'], checked: 0 };
    }
  } catch {
    return { errors: ['Local Keycloak issuer mismatch or discovery unavailable'], checked: 0 };
  }

  let checked = 0;
  async function getJson(resource, actorKey) {
    // Redirects must not forward bearer tokens to another origin.
    const res = await fetchImpl(root + '/admin/realms/' +
      encodeURIComponent(realm) + resource, {
      method: 'GET', redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + actorKey);
    return res.json();
  }
  for (const [key, expectedRole] of Object.entries(EXPECTED)) {
    const name = asActor(members[key]);
    try {
      const matches = await getJson('/users?username=' +
        encodeURIComponent(name) + '&exact=true', key);
      const user = Array.isArray(matches) &&
        matches.find(u => u?.username?.toLocaleLowerCase('en') === name.toLocaleLowerCase('en'));
      if (!user?.id || user.enabled !== true) {
        errors.push('User does not exist or is disabled: ' + key);
        continue;
      }
      const effectiveRoles = await getJson('/users/' +
        encodeURIComponent(user.id) + '/role-mappings/realm/composite', key);
      if (!Array.isArray(effectiveRoles)) {
        errors.push('Invalid role mapping returned for ' + key);
        continue;
      }
      const names = new Set(effectiveRoles.map(role => role?.name));
      if (!names.has(expectedRole)) {
        errors.push('Expected ' + expectedRole + ' realm role missing for ' + key);
        continue;
      }
      if (expectedRole === 'USER' &&
          (names.has('MODERATOR') || names.has('ADMIN'))) {
        errors.push('Jury USER must not hold privileged roles: ' + key);
        continue;
      }
      if (expectedRole === 'MODERATOR' && names.has('ADMIN')) {
        errors.push('Jury MODERATOR must not hold ADMIN privileges: ' + key);
        continue;
      }
      checked++;
    } catch {
      // Do not dump response bodies, URL query values, tokens or personal data.
      errors.push('Keycloak Admin API check failed for ' + key);
    }
  }
  return { errors, checked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.JURY_ENVIRONMENT_CONFIRMED !== 'isolated') {
      throw new Error('Set JURY_ENVIRONMENT_CONFIRMED=isolated only after verifying the sandbox');
    }
    const plan = JSON.parse(readFileSync(join(repo, 'demo/jury/manifest.json'), 'utf8'));
    const result = await checkJuryKeycloakActors(plan, {
      baseUrl: process.env.JURY_KEYCLOAK_BASE_URL,
      realm: process.env.JURY_KEYCLOAK_REALM || 'projet-indiv26',
      token: process.env.JURY_KEYCLOAK_ADMIN_TOKEN,
    });
    for (const error of result.errors) console.error('FAIL: ' + error);
    console.log('Jury Keycloak read-only: ' +
      (result.errors.length ? 'NOT READY' : 'PASS') +
      ' (' + result.checked + '/4 role-checked identities)');
    if (result.errors.length) process.exitCode = 1;
  } catch {
    console.error('Jury Keycloak preflight blocked: verify isolated target and inputs.');
    process.exitCode = 1;
  }
}
