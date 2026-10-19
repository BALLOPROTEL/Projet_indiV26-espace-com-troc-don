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
  responseStatus = 200, discoveryIssuer = 'http://127.0.0.1:8081/realms/projet-indiv26' } = {}) {
  const calls = [];
  const fetchImpl = async (url, config) => {
    calls.push({ url, config });
    if (responseStatus !== 200) return { ok: false, status: responseStatus };
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/.well-known/openid-configuration')) {
      assert.equal(config.headers.Authorization, undefined,
        'Never attach Admin token to discovery');
      return { ok: true, json: async () => ({ issuer: discoveryIssuer }) };
    }
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
  assert.equal(f.calls.length, 9);
  assert.ok(f.calls.every(c => c.config.method === 'GET' && c.config.redirect === 'error'));
  assert.equal(f.calls[0].url,
    'http://127.0.0.1:8081/realms/projet-indiv26/.well-known/openid-configuration');
  assert.equal(f.calls[0].config.headers.Authorization, undefined);
  assert.ok(f.calls.slice(1).every(c =>
    c.config.headers.Authorization === 'Bearer temporary-test-token' &&
    c.url.startsWith('http://127.0.0.1:8081/admin/realms/projet-indiv26/')));
});

test('fail closed before network when requester is missing or identities duplicate', async () => {
  const f = fakeKeycloak();
  const m = plan(); m.actors.memberRequester = null;
  const a = await checkJuryKeycloakActors(m, {
    baseUrl: 'http://127.0.0.1:8081', token: 'test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.equal(a.checked, 0);
  assert.ok(a.errors.some(e => e.includes('memberRequester')));
  const dup = plan(); dup.actors.memberRequester = 'DEMO-USER';
  const b = await checkJuryKeycloakActors(dup, {
    baseUrl: 'http://127.0.0.1:8081', token: 'test-token',
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
      baseUrl: 'http://127.0.0.1:8081',
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
    baseUrl: 'http://127.0.0.1:8081',
    token: 'test', fetchImpl: f.fetchImpl,
  });
  assert.ok(result.errors.some(e => e.includes('privileged roles')));
});

test('rejects any non-loopback URL, wrong port, credentials, URL paths and HTTPS', () => {
  for (const value of [
    'http://sandbox.example.invalid:8081',
    'https://sandbox.example.invalid',
    'https://admin:secret@sandbox.example.invalid',
    'https://sandbox.example.invalid/?token=a',
    'http://localhost.evil.invalid:8081',
    'http://127.0.0.2:8081',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081/admin',
    'http://127.0.0.1:8081/?token=a',
    'http://127.0.0.1:8081/#fragment',
    'http://user:pass@127.0.0.1:8081',
    'javascript:alert(1)',
  ]) assert.throws(() => validateAdminEndpoint(value), value);
  assert.equal(validateAdminEndpoint('http://localhost:8081/'),
    'http://localhost:8081');
  assert.equal(validateAdminEndpoint('http://127.0.0.1:8081'),
    'http://127.0.0.1:8081');
});

test('refuses wrong URL and mismatched discovery without ever sending a token', async () => {
  const fake = fakeKeycloak();
  const remote = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'https://production.example.invalid',
    token: 'must-not-leak', fetchImpl: fake.fetchImpl,
  });
  assert.equal(remote.checked, 0);
  assert.equal(fake.calls.length, 0);
  const otherRealm = fakeKeycloak({
    discoveryIssuer: 'http://127.0.0.1:8081/realms/different-realm',
  });
  const mismatch = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'http://127.0.0.1:8081',
    token: 'must-not-leak', fetchImpl: otherRealm.fetchImpl,
  });
  assert.equal(mismatch.checked, 0);
  assert.equal(otherRealm.calls.length, 1);
  assert.equal(otherRealm.calls[0].config.headers.Authorization, undefined);
  assert.ok(mismatch.errors.some(e => e.includes('issuer mismatch')));
});

test('rejects ADMIN escalation for moderator even when MODERATOR is present', async () => {
  const fake = fakeKeycloak({ assigned: {
    ...roles, 'demo-moderator': ['MODERATOR', 'ADMIN'],
  } });
  const out = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'http://127.0.0.1:8081',
    token: 'temporary-test-token', fetchImpl: fake.fetchImpl,
  });
  assert.equal(out.checked, 3);
  assert.ok(out.errors.some(e => e.includes('MODERATOR must not hold ADMIN')));
});

test('handles API and transport failure without logging server body or bearer token', async () => {
  const f = fakeKeycloak({ responseStatus: 401 });
  const result = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'http://127.0.0.1:8081',
    token: 'sensitive-test-token',
    fetchImpl: f.fetchImpl,
  });
  assert.equal(result.checked, 0);
  assert.equal(result.errors.length, 1);
  assert.ok(!JSON.stringify(result).includes('sensitive-test-token'));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].config.headers.Authorization, undefined);
  const network = await checkJuryKeycloakActors(plan(), {
    baseUrl: 'http://127.0.0.1:8081',
    token: 'secret',
    fetchImpl: async () => { throw new Error('secret failed'); },
  });
  assert.equal(network.errors.length, 1);
  assert.ok(!JSON.stringify(network).includes('secret failed'));
});
