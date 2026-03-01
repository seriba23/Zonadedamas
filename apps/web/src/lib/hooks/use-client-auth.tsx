'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { portalApi } from '../portal-api';

export interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface ClientAuthContextType {
  client: ClientUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  tenantSlug: string;
  login: (identifier: string, password: string) => Promise<ClientUser>;
  register: (params: {
    identifier: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  }) => Promise<ClientUser>;
  logout: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({
  children,
  tenantSlug,
}: {
  children: ReactNode;
  tenantSlug: string;
}) {
  const [client, setClient] = useState<ClientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `client_refresh_token_${tenantSlug}`;

  useEffect(() => {
    portalApi.setTenantSlug(tenantSlug);

    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

    if (refreshToken) {
      portalApi
        .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          refreshToken,
        })
        .then((res) => {
          portalApi.setAccessToken(res.accessToken);
          localStorage.setItem(storageKey, res.refreshToken);
          return portalApi.get<ClientUser>('/auth/me');
        })
        .then((me) => setClient(me))
        .catch(() => {
          localStorage.removeItem(storageKey);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tenantSlug, storageKey]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<ClientUser> => {
      const res = await portalApi.post<{
        accessToken: string;
        refreshToken: string;
        client: ClientUser;
      }>('/auth/login', { identifier, password });

      portalApi.setAccessToken(res.accessToken);
      localStorage.setItem(storageKey, res.refreshToken);

      const me = await portalApi.get<ClientUser>('/auth/me');
      setClient(me);
      return me;
    },
    [storageKey],
  );

  const register = useCallback(
    async (params: {
      identifier: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
    }): Promise<ClientUser> => {
      const res = await portalApi.post<{
        accessToken: string;
        refreshToken: string;
        client: ClientUser;
      }>('/auth/register', params);

      portalApi.setAccessToken(res.accessToken);
      localStorage.setItem(storageKey, res.refreshToken);

      const me = await portalApi.get<ClientUser>('/auth/me');
      setClient(me);
      return me;
    },
    [storageKey],
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(storageKey);
    if (refreshToken) {
      await portalApi.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    portalApi.setAccessToken(null);
    localStorage.removeItem(storageKey);
    setClient(null);
  }, [storageKey]);

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        isLoading,
        isAuthenticated: !!client,
        tenantSlug,
        login,
        register,
        logout,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth(): ClientAuthContextType {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
