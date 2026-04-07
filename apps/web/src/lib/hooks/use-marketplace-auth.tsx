'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { marketplaceApi } from '../marketplace-api';
import { portalApi } from '../portal-api';

interface MarketplaceUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  allergies?: string | null;
  address?: string | null;
  socialProvider?: string | null;
}

/** Returns gendered suffix: "o" (male), "a" (female), "@" (neutral/unknown) */
export function genderSuffix(gender?: string | null): string {
  if (gender === 'MALE') return 'o';
  if (gender === 'FEMALE') return 'a';
  return '@';
}

interface MarketplaceAuthContextType {
  user: MarketplaceUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<MarketplaceUser & { reactivated?: boolean }>;
  register: (params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<MarketplaceUser>;
  socialLogin: (provider: 'google' | 'facebook', token: string) => Promise<MarketplaceUser & { isNewUser?: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  enterBusiness: (tenantSlug: string) => Promise<{
    clientAccessToken: string;
    clientRefreshToken: string;
    tenant: { id: string; slug: string; name: string };
  }>;
}

const MarketplaceAuthContext = createContext<MarketplaceAuthContextType | null>(null);

export function MarketplaceAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MarketplaceUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (marketplaceApi.isLoggedIn()) {
      marketplaceApi
        .get<{ data: MarketplaceUser }>('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => setUser(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch full user data after login (login responses don't include all fields)
  const fetchFullUser = useCallback(async () => {
    try {
      const res = await marketplaceApi.get<{ data: MarketplaceUser }>('/auth/me');
      setUser(res.data);
    } catch {
      // keep partial data
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await marketplaceApi.loginAndStore(identifier, password);
    const { reactivated, ...userData } = result;
    setUser(userData);
    fetchFullUser();
    return result;
  }, [fetchFullUser]);

  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const u = await marketplaceApi.registerAndStore(params);
      setUser(u);
      fetchFullUser();
      return u;
    },
    [fetchFullUser],
  );

  const socialLogin = useCallback(
    async (provider: 'google' | 'facebook', token: string) => {
      const result = await marketplaceApi.socialLoginAndStore(provider, token);
      const { isNewUser, ...userData } = result;
      setUser(userData);
      fetchFullUser();
      return result;
    },
    [fetchFullUser],
  );

  const logout = useCallback(() => {
    marketplaceApi.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await marketplaceApi.get<{ data: MarketplaceUser }>('/auth/me');
      setUser(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const enterBusiness = useCallback(
    async (tenantSlug: string) => {
      const res: any = await marketplaceApi.post(`/enter/${tenantSlug}`);
      const data = res.data;

      // Store client tokens so portal auth works seamlessly
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          `client_refresh_token_${tenantSlug}`,
          data.clientRefreshToken,
        );
      }
      portalApi.setTenantSlug(tenantSlug);
      portalApi.setAccessToken(data.clientAccessToken);

      return data;
    },
    [],
  );

  return (
    <MarketplaceAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        socialLogin,
        logout,
        refreshUser,
        enterBusiness,
      }}
    >
      {children}
    </MarketplaceAuthContext.Provider>
  );
}

export function useMarketplaceAuth() {
  const ctx = useContext(MarketplaceAuthContext);
  if (!ctx) {
    throw new Error('useMarketplaceAuth must be used within MarketplaceAuthProvider');
  }
  return ctx;
}
