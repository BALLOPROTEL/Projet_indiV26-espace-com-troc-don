import Keycloak from 'keycloak-js';

let keycloak: Keycloak | null = null;
let initPromise: Promise<boolean> | null = null;

function resolveKeycloakUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_KEYCLOAK_URL ??
    'http://localhost:8081';

  if (typeof window === 'undefined') {
    return configured;
  }

  const hostname = window.location.hostname;
  const codespacesMatch = hostname.match(
    /^(?<name>.+)-3001\.(?<domain>app\.github\.dev)$/,
  );

  if (
    codespacesMatch?.groups &&
    /^https?:\/\/(localhost|127\.0\.0\.1):8081\/?$/.test(
      configured,
    )
  ) {
    return `https://${codespacesMatch.groups.name}-8081.${codespacesMatch.groups.domain}`;
  }

  return configured.replace(/\/$/, '');
}

export function getKeycloak(): Keycloak {
  if (!keycloak) {
    keycloak = new Keycloak({
      url: resolveKeycloakUrl(),
      realm:
        process.env.NEXT_PUBLIC_KEYCLOAK_REALM ??
        'projet-indiv26',
      clientId:
        process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'web',
    });
  }

  return keycloak;
}

export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    const silentRedirectUri =
      typeof window === 'undefined'
        ? undefined
        : `${window.location.origin}/silent-check-sso.html`;

    initPromise = getKeycloak().init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoRedirectUri: silentRedirectUri,
      silentCheckSsoFallback: false,
      messageReceiveTimeout: 3000,
    });
  }

  return initPromise;
}
