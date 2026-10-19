import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { prepareJuryRealm, writeDisposableRealm } from './jury-realm-prepare.mjs';

const base = () => ({
  realm: 'projet-indiv26',
  clients: [{ clientId: 'web', redirectUris: ['http://localhost/*'] }],
  users: [
    { username: 'demo-user', id: 'owner-id', realmRoles: ['USER'],
      credentials: [{ type: 'password', value: 'test-existing-password' }] },
    { username: 'demo-moderator', id: 'mod-id', realmRoles: ['MODERATOR'] },
    { username: 'demo-admin', id: 'admin-id', realmRoles: ['ADMIN'] },
  ],
});

test('adds only a second isolated USER; leaves source objects unmodified', () => {
  const source = base();
  const before = structuredClone(source);
  const generated = prepareJuryRealm(source, 'only-for-disposable-test', 'requester-id');
  assert.deepEqual(source, before);
  assert.equal(generated.users.length, 4);
  assert.deepEqual(generated.clients, source.clients);
  const user = generated.users.find(x => x.username === 'demo-requester');
  assert.deepEqual(user.realmRoles, ['USER']);
  assert.equal(user.id, 'requester-id');
  assert.equal(user.credentials[0].value, 'only-for-disposable-test');
  assert.ok(user.email.endsWith('.invalid'));
  assert.deepEqual(generated.users.slice(0, 3), source.users);
});

test('fails closed on duplicate requester, bad source realm and duplicate ID', () => {
  const source = base();
  assert.throws(() => prepareJuryRealm({
    ...source, users: [...source.users, { username: 'DEMO-REQUESTER' }],
  }, 'only-for-disposable-test'), /already exists/);
  assert.throws(() => prepareJuryRealm({
    ...source, realm: 'production',
  }, 'only-for-disposable-test'), /disposable/);
  assert.throws(() => prepareJuryRealm(source, 'only-for-disposable-test', 'owner-id'),
    /Duplicate user ID/);
  assert.throws(() => prepareJuryRealm({
    ...source, users: source.users.filter(x => x.username !== 'demo-user'),
  }, 'only-for-disposable-test'), /owner/);
});

test('never accepts a blank, weak or multiline requester password', () => {
  for (const password of [undefined, '', 'short', 'bad\npassphrase-long', 'bad\rpassphrase-long',
    'x'.repeat(257)]) {
    assert.throws(() => prepareJuryRealm(base(), password), /password/);
  }
});

test('writes a new protected temp import, never a tracked project file', () => {
  const output = writeDisposableRealm(prepareJuryRealm(base(), 'only-for-disposable-test'));
  try {
    assert.ok(output.includes('jury-realm-'));
    assert.ok(output.startsWith('/tmp/') || output.includes('Temp'));
    const loaded = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(loaded.users.length, 4);
    if (process.platform !== 'win32') {
      assert.equal(statSync(output).mode & 0o777, 0o600);
      assert.equal(statSync(dirname(output)).mode & 0o777, 0o700);
    }
  } finally {
    // Delete ONLY the temp import this test created, never user data or volumes.
    rmSync(dirname(output), { recursive: true, force: true });
  }
});
