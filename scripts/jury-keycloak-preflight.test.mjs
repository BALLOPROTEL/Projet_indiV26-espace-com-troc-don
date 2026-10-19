import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkJuryKeycloakActors, validateAdminEndpoint } from './jury-keycloak-preflight.mjs';

const plan = () => ({ actors: {
  memberOwner: 'demo-user', memberRequester: 'demo-requester',
  moderator: 'demo-moderator', admin: 'demo-admin',
} });
const roles = {
  'demo-user': ['USER'],
  'demo-requester': ['USER'],
  'demo-moderator': ['MODERATOR'],
  'demo-admin': ['ADMIN'],
};
function fakeKeycloak({ assigned = roles, absent = null, disabled = null,
  responseStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, config) => {
    calls.push({ url, config });
    if (responseStatus !== 200) return { ok: false, status: responseStatus };
    const parsed = new URL(url);
    const user = parsed.searchParams.get('username');
    const mapping = /\/users\/([^/]+)\/role-mappings\/realm\/composite$/.exec(parsed.pathname);
    if (mapping) {
      const name = decodeURIComponent(mapping[1]);
      return { ok: true, json: async () =>
        (assigned[name] || []).map(role => ({ name: role })) };
    }
    if (user) {
      return { ok: true, json: async () =>
        absent === user ? [] : [{
          username: user, id: user, enabled: disabled !== user,
        }] };
    }
    throw new Error('Unexpected Keycloak URL');
  };
  return { fetchImpl, calls };
}

test('read-only real-user check verifies four distinct effective realm roles', async () => {
  const f = fakeKeycloak();
  const result = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'http://127.0.0.1:8081',
    token: 'temporary-test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(result, { errors: [], checked: 4 });
  assert.equal(f.calls.length, 8);
  assert.ok(f.calls.every(c => c.config.method === 'GET' &&
    c.config.redirect === 'error' &&
    c.config.headers.Authorization === 'Bearer temporary-test-token'));
  assert.ok(f.calls.every(c => c.url.startsWith('http://127.0.0.1:8081/admin/realms/projet-indiv26/')));
});

test('fail closed before network when requester is missing or identities duplicate', async () => {
  const f = fakeKeycloak();
  const m = plan(); m.actors.memberRequester = null;
  const a = await checkJuryKeycloakActors(m, {
    baseUrl: 'https://sandbox.example.invalid', token: 'test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.equal(a.checked, 0);
  assert.ok(a.errors.some(e => e.includes('memberRequester')));
  const dup = plan(); dup.actors.memberRequester = 'DEMO-USER';
  const b = await checkJuryKeycloakActors(dup, {
    baseUrl: 'https://sandbox.example.invalid', token: 'test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.equal(b.checked, 0);
  assert.ok(b.errors.some(e => e.includes('Duplicate')));
  assert.equal(f.calls.length, 0);
});

test('reports absent/disabled member and missing ADMIN without dumping credentials', async () => {
  for (const variant of [{ absent: 'demo-requester' },
    { disabled: 'demo-user' },
    { assigned: { ...roles, 'demo-admin': ['USER'] } }]) {
    const f = fakeKeycloak(variant);
    const result = await checkJuryKeycloakActors(plan(), {
      baseUrl: 'https://sandbox.example.invalid',
      token: 'do-not-log-token',
      fetchImpl: f.fetchImpl,
    });
    assert.ok(result.errors.length >= 1);
    assert.ok(result.checked < 4);
    assert.ok(!JSON.stringify(result).includes('do-not-log-token'));
  }
});

test('detects privilege escalation of supposed USER identities', async () => {
  const f = fakeKeycloak({ assigned: {
    ...roles, 'demo-requester': ['USER', 'MODERATOR'],
  } });
  const result = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'https://sandbox.example.invalid',
    token: 'test', fetchImpl: f.fetchImpl,
  });
  assert.ok(result.errors.some(e => e.includes('privileged roles')));
});

test('rejects remote plain HTTP and embedded credentials', () => {
  for (const value of [
    'http://sandbox.example.invalid:8081',
    'https://admin:secret@sandbox.example.invalid',
    'https://sandbox.example.invalid/?token=a',
    'javascript:alert(1)',
  ]) assert.throws(() => validateAdminEndpoint(value));
  assert.equal(validateAdminEndpoint('http://localhost:8081/'),
    'http://localhost:8081');
  assert.equal(validateAdminEndpoint('https://sandbox.example.invalid/auth/'),
    'https://sandbox.example.invalid/auth');
});

test('handles API and transport failure without logging server body or bearer token', async () => {
  const f = fakeKeycloak({ responseStatus: 401 });
  const result = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'https://sandbox.example.invalid',
    token: 'sensitive-test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.equal(result.checked, 0);
  assert.equal(result.errors.length, 4);
  assert.ok(!JSON.stringify(result).includes('sensitive-test-token'));
  const network = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'https://sandbox.example.invalid',
    token: 'secret',
    fetchImpl: async () => { throw new Error('secret failed'); },
  });
  assert.equal(network.errors.length, 4);
  assert.ok(!JSON.stringify(network).includes('secret failed'));
});
