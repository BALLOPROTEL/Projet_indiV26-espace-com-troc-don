'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { KeycloakTokenParsed } from 'keycloak-js';
import {
  getKeycloak,
  initKeycloak,
} from '../lib/keycloak';

type AppRole = 'USER' | 'MODERATOR' | 'ADMIN';

type ParsedToken = KeycloakTokenParsed & {
  preferred_username?: string;
  name?: string;
  realm_access?: {
    roles?: string[];
  };
};

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  username: string | null;
  roles: AppRole[];
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string>;
  hasAnyRole: (...roles: AppRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readIdentity() {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed as ParsedToken | undefined;
  const roles = (token?.realm_access?.roles ?? []).filter(
    (role): role is AppRole =>
      role === 'USER' ||
      role === 'MODERATOR' ||
      role === 'ADMIN',
  );

  return {
    authenticated: Boolean(keycloak.authenticated),
    username:
      token?.name ??
      token?.preferred_username ??
      null,
    roles,
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState(() => ({
    authenticated: false,
    username: null as string | null,
    roles: [] as AppRole[],
  }));

  const syncIdentity = useCallback(() => {
    setIdentity(readIdentity());
  }, []);

  useEffect(() => {
    let active = true;
    const keycloak = getKeycloak();

    void initKeycloak()
      .then(() => {
        if (!active) {
          return;
        }

        syncIdentity();
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
        }
      });

    keycloak.onAuthSuccess = syncIdentity;
    keycloak.onAuthLogout = syncIdentity;
    keycloak.onTokenExpired = () => {
      void keycloak.updateToken(30).then(syncIdentity);
    };

    return () => {
      active = false;
    };
  }, [syncIdentity]);

  const login = useCallback(async () => {
    const keycloak = getKeycloak();

    await keycloak.login({
      redirectUri: window.location.href,
    });
  }, []);

  const logout = useCallback(async () => {
    const keycloak = getKeycloak();

    await keycloak.logout({
      redirectUri: window.location.origin,
    });
  }, []);

  const getToken = useCallback(async () => {
    const keycloak = getKeycloak();

    if (!keycloak.authenticated) {
      throw new Error('Authentification requise.');
    }

    await keycloak.updateToken(30);

    if (!keycloak.token) {
      throw new Error('Jeton de session indisponible.');
    }

    return keycloak.token;
  }, []);

  const hasAnyRole = useCallback(
    (...roles: AppRole[]) =>
      roles.some((role) => identity.roles.includes(role)),
    [identity.roles],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      ...identity,
      login,
      logout,
      getToken,
      hasAnyRole,
    }),
    [
      ready,
      identity,
      login,
      logout,
      getToken,
      hasAnyRole,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
