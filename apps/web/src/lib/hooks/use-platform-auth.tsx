'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  platformLogin,
  platformLogout,
  platformGetMe,
  platformApi,
  hasPlatformRefreshToken,
  type PlatformUser,
} from '../platform-auth';

interface PlatformAuthContextType {
  user: PlatformUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<PlatformUser>;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasPlatformRefreshToken()) {
      setIsLoading(false);
      return;
    }

    const refreshToken = localStorage.getItem('platformRefreshToken');
    if (refreshToken) {
      platformApi
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          '/api/platform/auth/refresh',
          { refreshToken },
        )
        .then((res) => {
          platformApi.setAccessToken(res.data.accessToken);
          localStorage.setItem('platformRefreshToken', res.data.refreshToken);
          return platformGetMe();
        })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('platformRefreshToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<PlatformUser> => {
    const data = await platformLogin(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await platformLogout();
    setUser(null);
  }, []);

  return (
    <PlatformAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextType {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  return ctx;
}
