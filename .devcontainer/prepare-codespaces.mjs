import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

if (process.env.CODESPACES !== 'true') {
  console.error('[ProjetIndiv26] This preparation script is intended for GitHub Codespaces.');
  process.exit(1);
}

const name = process.env.CODESPACE_NAME;
const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

if (!name || !domain) {
  throw new Error('Missing Codespaces environment variables.');
}

const webUrl = `https://${name}-3001.${domain}`;
const keycloakUrl = `https://${name}-8081.${domain}`;
const keycloakIssuer = `${keycloakUrl}/realms/projet-indiv26`;

await mkdir('.codespaces', { recursive: true });

const realmPath = path.join('infra', 'keycloak', 'projet-indiv26-realm.json');
const realm = JSON.parse(await readFile(realmPath, 'utf8'));
const webClient = realm.clients?.find((client) => client.clientId === 'web');

if (!webClient) {
  throw new Error('Keycloak web client not found in realm export.');
}

webClient.rootUrl = webUrl;
webClient.baseUrl = webUrl;
webClient.redirectUris = [`${webUrl}/*`];
webClient.webOrigins = [webUrl];
webClient.attributes = {
  ...(webClient.attributes ?? {}),
  'pkce.code.challenge.method': 'S256',
  'post.logout.redirect.uris': `${webUrl}/*`,
};

await writeFile(
  path.join('.codespaces', 'keycloak-realm.json'),
  `${JSON.stringify(realm, null, 2)}\n`,
);

await writeFile(
  path.join('.codespaces', 'codespace.env'),
  `CODESPACE_KEYCLOAK_URL=${keycloakUrl}\n`,
);

await writeFile(
  '.env',
  [
    'PORT=3000',
    'DATABASE_URL=postgresql://app:app_local_change_me@localhost:5433/projet_indiv26?schema=public',
    `KEYCLOAK_ISSUER=${keycloakIssuer}`,
    'KEYCLOAK_JWKS_URL=http://127.0.0.1:8081/realms/projet-indiv26/protocol/openid-connect/certs',
    'KEYCLOAK_AUDIENCE=api',
    `WEB_ORIGIN=${webUrl}`,
    'METRICS_TOKEN=local_optional_metrics_token',
    'SWAGGER_ENABLED=true',
    'S3_ENDPOINT=http://127.0.0.1:9000',
    'S3_REGION=us-east-1',
    'S3_BUCKET=listing-images',
    'S3_ACCESS_KEY=marketplace-api',
    'S3_SECRET_KEY=marketplace_storage_local_change_me_2026',
    'S3_FORCE_PATH_STYLE=true',
    '',
  ].join('\n'),
);

await writeFile(
  path.join('apps', 'web', '.env.local'),
  [
    `NEXT_PUBLIC_KEYCLOAK_URL=${keycloakUrl}`,
    'NEXT_PUBLIC_KEYCLOAK_REALM=projet-indiv26',
    'NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=web',
    'NEXT_PUBLIC_API_URL=/api',
    'API_INTERNAL_URL=http://127.0.0.1:3000',
    '',
  ].join('\n'),
);

console.log(`[ProjetIndiv26] Web: ${webUrl}`);
console.log(`[ProjetIndiv26] Keycloak: ${keycloakUrl}`);
