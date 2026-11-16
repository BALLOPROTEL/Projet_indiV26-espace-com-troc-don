import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJuryPublicUrls,
  buildJurySessionConfig,
  configureJuryWebClient,
  serializeEnv,
} from './jury-stack-prepare.mjs';

test('local session uses isolated project name and dedicated ports', () => {
  const config = buildJurySessionConfig({
    sessionId: 'a1b2c3d4',
    realmPath: '/tmp/jury-realm-a/keycloak-realm.json',
    realmGid: 1000,
  });
  assert.equal(config.COMPOSE_PROJECT_NAME, 'projet-indiv26-jury-a1b2c3d4');
  assert.equal(config.KEYCLOAK_HOST_PORT, '18081');
  assert.equal(config.WEB_HOST_PORT, '13001');
  assert.equal(config.KEYCLOAK_PUBLIC_URL, 'http://localhost:18081');
  assert.equal(config.WEB_PUBLIC_URL, 'http://localhost:13001');
  assert.equal(config.JURY_REALM_GID, '1000');
});

test('Codespaces session builds public forwarded URLs without credentials', () => {
  const config = buildJurySessionConfig({
    sessionId: 'deadbeef',
    realmPath: '/tmp/jury-realm-b/keycloak-realm.json',
    realmGid: 1001,
    codespaces: true,
    codespaceName: 'demo-space',
    forwardingDomain: 'app.github.dev',
  });
  assert.equal(config.KEYCLOAK_PUBLIC_URL, 'https://demo-space-18081.app.github.dev');
  assert.equal(config.WEB_PUBLIC_URL, 'https://demo-space-13001.app.github.dev');
  const env = serializeEnv(config);
  assert.match(env, /COMPOSE_PROJECT_NAME=projet-indiv26-jury-deadbeef/);
  assert.match(env, /JURY_REALM_GID=1001/);
  assert.doesNotMatch(env, /PASSWORD|TOKEN|SECRET/);
});

test('invalid session id, relative realm path or invalid gid is rejected', () => {
  assert.throws(() => buildJurySessionConfig({
    sessionId: 'oops',
    realmPath: '/tmp/x',
    realmGid: 1000,
  }));
  assert.throws(() => buildJurySessionConfig({
    sessionId: '12345678',
    realmPath: 'relative.json',
    realmGid: 1000,
  }));
  assert.throws(() => buildJurySessionConfig({
    sessionId: '12345678',
    realmPath: '/tmp/x',
    realmGid: -1,
  }));
});

test('jury web client is rewritten to the dedicated public URL', () => {
  const base = {
    clients: [{
      clientId: 'web',
      rootUrl: 'http://localhost:3001',
      baseUrl: 'http://localhost:3001',
      redirectUris: ['http://localhost:3001/*'],
      webOrigins: ['http://localhost:3001'],
      attributes: {
        'pkce.code.challenge.method': 'S256',
        'post.logout.redirect.uris': 'http://localhost:3001/*',
      },
    }],
  };
  const urls = buildJuryPublicUrls({
    codespaces: true,
    codespaceName: 'demo-space',
    forwardingDomain: 'app.github.dev',
  });
  const configured = configureJuryWebClient(base, urls.webPublicUrl);
  const web = configured.clients[0];
  assert.equal(web.rootUrl, 'https://demo-space-13001.app.github.dev');
  assert.deepEqual(web.redirectUris, ['https://demo-space-13001.app.github.dev/*']);
  assert.deepEqual(web.webOrigins, ['https://demo-space-13001.app.github.dev']);
  assert.equal(web.attributes['post.logout.redirect.uris'], 'https://demo-space-13001.app.github.dev/*');
  assert.equal(base.clients[0].rootUrl, 'http://localhost:3001');
});
