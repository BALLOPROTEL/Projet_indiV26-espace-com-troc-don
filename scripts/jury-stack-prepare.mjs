#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareJuryRealm, writeDisposableRealm } from './jury-realm-prepare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const realmFile = join(root, 'infra/keycloak/projet-indiv26-realm.json');

export function buildJurySessionConfig({
  sessionId,
  codespaces = false,
  codespaceName,
  forwardingDomain,
  realmPath,
} = {}) {
  if (!/^[a-f0-9]{8}$/.test(sessionId || '')) {
    throw new Error('Session id must be 8 lowercase hex characters');
  }
  if (!realmPath || !resolve(realmPath).startsWith('/')) {
    throw new Error('Realm path must be absolute');
  }
  const ports = {
    POSTGRES_HOST_PORT: '15433',
    RABBITMQ_AMQP_HOST_PORT: '15673',
    RABBITMQ_MANAGEMENT_HOST_PORT: '25672',
    KEYCLOAK_HOST_PORT: '18081',
    MINIO_API_HOST_PORT: '19000',
    MINIO_CONSOLE_HOST_PORT: '19001',
    LEGACY_API_HOST_PORT: '13099',
    CATALOG_HOST_PORT: '13101',
    MARKETPLACE_HOST_PORT: '13102',
    NOTIFICATION_HOST_PORT: '13103',
    GATEWAY_HOST_PORT: '13000',
    WEB_HOST_PORT: '13001',
  };

  let webPublicUrl = 'http://localhost:' + ports.WEB_HOST_PORT;
  let keycloakPublicUrl = 'http://localhost:' + ports.KEYCLOAK_HOST_PORT;
  if (codespaces) {
    if (!codespaceName || !forwardingDomain) {
      throw new Error('Codespaces public URL variables are required');
    }
    webPublicUrl = `https://${codespaceName}-${ports.WEB_HOST_PORT}.${forwardingDomain}`;
    keycloakPublicUrl = `https://${codespaceName}-${ports.KEYCLOAK_HOST_PORT}.${forwardingDomain}`;
  }

  return {
    COMPOSE_PROJECT_NAME: 'projet-indiv26-jury-' + sessionId,
    JURY_SESSION_ID: sessionId,
    KEYCLOAK_REALM_FILE: realmPath,
    ...ports,
    WEB_PUBLIC_URL: webPublicUrl,
    KEYCLOAK_PUBLIC_URL: keycloakPublicUrl,
  };
}

export function serializeEnv(config) {
  return Object.entries(config)
    .map(([key, value]) => key + '=' + String(value))
    .join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.JURY_ENVIRONMENT_CONFIRMED !== 'isolated' || process.argv.length !== 2) {
      throw new Error('Isolated jury environment confirmation required');
    }
    const password = process.env.JURY_REQUESTER_PASSWORD;
    const base = JSON.parse(readFileSync(realmFile, 'utf8'));
    const realm = prepareJuryRealm(base, password);
    const outputRealm = writeDisposableRealm(realm);
    const sessionId = randomBytes(4).toString('hex');
    const config = buildJurySessionConfig({
      sessionId,
      codespaces: process.env.CODESPACES === 'true',
      codespaceName: process.env.CODESPACE_NAME,
      forwardingDomain: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
      realmPath: outputRealm,
    });
    const envFile = join(dirname(outputRealm), 'jury-stack.env');
    writeFileSync(envFile, serializeEnv(config), { flag: 'wx', mode: 0o600 });
    chmodSync(envFile, 0o600);

    console.log('Isolated jury session prepared.');
    console.log('Session: ' + config.COMPOSE_PROJECT_NAME);
    console.log('Environment file: ' + envFile);
    console.log('Web: ' + config.WEB_PUBLIC_URL);
    console.log('Keycloak: ' + config.KEYCLOAK_PUBLIC_URL);
    console.log('NOT STARTED. Keep JURY_REQUESTER_PASSWORD private and run jury:stack:up explicitly.');
  } catch {
    console.error('Jury isolated stack preparation blocked. Verify isolation and password requirements.');
    process.exitCode = 1;
  }
}
