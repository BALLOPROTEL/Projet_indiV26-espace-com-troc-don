import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJurySessionConfig, serializeEnv } from './jury-stack-prepare.mjs';

test('local session uses isolated project name and dedicated ports', () => {
  const config = buildJurySessionConfig({
    sessionId: 'a1b2c3d4',
    realmPath: '/tmp/jury-realm-a/keycloak-realm.json',
  });
  assert.equal(config.COMPOSE_PROJECT_NAME, 'projet-indiv26-jury-a1b2c3d4');
  assert.equal(config.KEYCLOAK_HOST_PORT, '18081');
  assert.equal(config.WEB_HOST_PORT, '13001');
  assert.equal(config.KEYCLOAK_PUBLIC_URL, 'http://localhost:18081');
  assert.equal(config.WEB_PUBLIC_URL, 'http://localhost:13001');
});

test('Codespaces session builds public forwarded URLs without credentials', () => {
  const config = buildJurySessionConfig({
    sessionId: 'deadbeef',
    realmPath: '/tmp/jury-realm-b/keycloak-realm.json',
    codespaces: true,
    codespaceName: 'demo-space',
    forwardingDomain: 'app.github.dev',
  });
  assert.equal(config.KEYCLOAK_PUBLIC_URL, 'https://demo-space-18081.app.github.dev');
  assert.equal(config.WEB_PUBLIC_URL, 'https://demo-space-13001.app.github.dev');
  const env = serializeEnv(config);
  assert.match(env, /COMPOSE_PROJECT_NAME=projet-indiv26-jury-deadbeef/);
  assert.doesNotMatch(env, /PASSWORD|TOKEN|SECRET/);
});

test('invalid session id or relative realm path is rejected', () => {
  assert.throws(() => buildJurySessionConfig({
    sessionId: 'oops',
    realmPath: '/tmp/x',
  }));
  assert.throws(() => buildJurySessionConfig({
    sessionId: '12345678',
    realmPath: 'relative.json',
  }));
});
