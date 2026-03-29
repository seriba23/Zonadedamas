'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api';
import {
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  getMe,
} from '../auth';
import type { AuthUser, RegisterParams } from '../auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (params: RegisterParams) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')
        : null;

    if (refreshToken) {
      api
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          '/api/auth/refresh',
          { refreshToken },
        )
        .then((res) => {
          api.setAccessToken(res.data.accessToken);
          localStorage.setItem('refreshToken', res.data.refreshToken);
          return getMe();
        })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    await authLogin(email, password);
    const me = await getMe();
    setUser(me.data);
    return me.data;
  }, []);

  const register = useCallback(async (params: RegisterParams): Promise<AuthUser> => {
    await authRegister(params);
    const me = await getMe();
    setUser(me.data);
    return me.data;
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
