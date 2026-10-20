import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, type TokenPair } from '../api/client';
import { clearReferenceCache } from '../api/reference';

export interface BranchInfo { id: number; code: string; nameEn?: string; nameAr?: string }
export interface UserProfile {
  id: number;
  email: string;
  nameEn?: string;
  nameAr?: string;
  phone?: string;
  companyId: number;
  company?: string;
  branchId?: number;
  roles: string[];
  permissions: string[];
  branches: BranchInfo[];
  isAdmin: boolean;
  lastLoginAt?: string;
}

interface LoginResponse extends TokenPair { user: UserProfile }

interface AuthState {
  user: UserProfile | null;
  /** true while the stored token is being checked on first load */
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** module.view / module.manage check (admins pass everything) */
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(tokenStore.hasSession());

  // Restore the session from the stored token.
  useEffect(() => {
    if (!tokenStore.hasSession()) return;
    // an expired access token is renewed with the refresh token inside api()
    api<UserProfile>('/auth/me')
      .then(setUser)
      .catch(() => { tokenStore.clear(); setUser(null); })
      .finally(() => setInitializing(false));
  }, []);

  // Any 401 from the API ends the session.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    // a refresh returns the profile with fresh roles / permissions
    const onRefreshed = () => { api<UserProfile>('/auth/me').then(u => setUser(prev => (prev && JSON.stringify(prev) === JSON.stringify(u) ? prev : u))).catch(() => undefined); };
    // signed out in another tab
    const onStorage = (e: StorageEvent) => { if (e.key === 'sedra.refresh' && !e.newValue && !tokenStore.get()) setUser(null); };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    window.addEventListener('auth:refreshed', onRefreshed);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('auth:refreshed', onRefreshed);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>('/auth/login', { body: { email, password }, skipAuthRedirect: true });
    tokenStore.setPair(res);
    clearReferenceCache();
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    // end the session on the server too (revokes the refresh token); don't wait for it
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) api('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuthRedirect: true }).catch(() => undefined);
    tokenStore.clear();
    clearReferenceCache();
    setUser(null);
  }, []);

  const can = useCallback((permission: string) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (user.permissions.includes(permission)) return true;
    // module.manage also grants module.view
    if (permission.endsWith('.view')) return user.permissions.includes(permission.replace(/\.view$/, '.manage'));
    return false;
  }, [user]);

  const value = useMemo(() => ({ user, initializing, login, logout, can }), [user, initializing, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
