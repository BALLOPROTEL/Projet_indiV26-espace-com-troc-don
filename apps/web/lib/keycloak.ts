import Keycloak from 'keycloak-js';

let keycloak: Keycloak | null = null;
let initPromise: Promise<boolean> | null = null;

export function getKeycloak(): Keycloak {
  if (!keycloak) {
    keycloak = new Keycloak({
      url:
        process.env.NEXT_PUBLIC_KEYCLOAK_URL ??
        'http://localhost:8081',
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
