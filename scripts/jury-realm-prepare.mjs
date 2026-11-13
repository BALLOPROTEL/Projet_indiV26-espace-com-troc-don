#!/usr/bin/env node
// Prepare an import file for a NEW disposable jury realm; never call Keycloak,
// write to the repository, edit the base realm or mutate a running account.
import { readFileSync, writeFileSync, mkdtempSync, realpathSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REALM = join(root, 'infra/keycloak/projet-indiv26-realm.json');
export const REQUESTER = 'demo-requester';

export function prepareJuryRealm(base, password, id = randomUUID()) {
  if (base?.realm !== 'projet-indiv26' || !Array.isArray(base?.users)) {
    throw new Error('Expected the disposable projet-indiv26 realm export');
  }
  if (typeof password !== 'string' || password.length < 14 ||
      password.length > 256 || /[\r\n\0]/.test(password)) {
    throw new Error('Requester password must be 14–256 characters without line breaks');
  }
  const usernames = new Set(base.users.map(u => String(u?.username || '').toLowerCase()));
  if (usernames.has(REQUESTER)) throw new Error('Requester already exists in import');
  const owner = base.users.find(u => u?.username === 'demo-user');
  if (!owner || !Array.isArray(owner.realmRoles) || !owner.realmRoles.includes('USER')) {
    throw new Error('Base lab realm must include the member owner with USER role');
  }
  if (base.users.some(u => u?.id === id)) throw new Error('Duplicate user ID');
  const realm = structuredClone(base);
  realm.users.push({
    id,
    username: REQUESTER,
    enabled: true,
    emailVerified: true,
    email: 'demo-requester@example.invalid',
    firstName: 'Demo',
    lastName: 'Requester',
    realmRoles: ['USER'],
    requiredActions: [],
    credentials: [{ type: 'password', value: password, temporary: false }],
  });
  return realm;
}

// TMPDIR/TMP/TEMP are user-controlled: resolve symlinks and reject checkout
// paths BEFORE creating any file that contains plaintext Keycloak credentials.
function outsideCheckout(directory) {
  const relativePath = relative(realpathSync(root), realpathSync(directory));
  return relativePath === '..' || relativePath.startsWith('..' + sep) ||
    isAbsolute(relativePath);
}

export function writeDisposableRealm(realm, { temporaryDirectory = tmpdir() } = {}) {
  if (!outsideCheckout(temporaryDirectory)) {
    throw new Error('Refusing to write Keycloak credentials inside the repository');
  }
  const dir = mkdtempSync(join(temporaryDirectory, 'jury-realm-'), { mode: 0o700 });
  // Re-check the actual private directory before writing secrets.
  if (!outsideCheckout(dir)) {
    rmdirSync(dir);
    throw new Error('Refusing redirected temporary directory inside repository');
  }
  const output = join(dir, 'keycloak-realm.json');
  writeFileSync(output, JSON.stringify(realm, null, 2) + '\n', {
    flag: 'wx', mode: 0o600,
  });
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.JURY_ENVIRONMENT_CONFIRMED !== 'isolated' ||
        process.argv.length !== 2) {
      throw new Error('Disposable sandbox confirmation required; no other arguments accepted');
    }
    const base = JSON.parse(readFileSync(REALM, 'utf8'));
    const realm = prepareJuryRealm(base, process.env.JURY_REQUESTER_PASSWORD);
    const output = writeDisposableRealm(realm);
    console.log('Disposable Keycloak realm import prepared: ' + output);
    console.log('NOT IMPORTED. Provision into a NEW isolated realm only; no live user changed.');
    console.log('Requester role: USER. Verify 4/4 actors with jury:keycloak:check after import.');
  } catch {
    console.error('Jury realm preparation blocked. Verify sandbox and password requirements.');
    process.exitCode = 1;
  }
}
