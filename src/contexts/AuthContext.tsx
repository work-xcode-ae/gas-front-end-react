import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { login as frappeLogin, logout as frappeLogout, getCurrentUser } from '../api/auth';
import type { FrappeUser } from '../api/auth';

interface AuthContextType {
  user: FrappeUser | null;
  loading: boolean;
  login: (usr: string, pwd: string) => Promise<void>;
  logout: () => Promise<void>;
  isGasManager: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FrappeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('frappe:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('frappe:unauthorized', handleUnauthorized);
  }, []);

  const login = async (usr: string, pwd: string) => {
    await frappeLogin(usr, pwd);
    const u = await getCurrentUser();
    setUser(u);
  };

  const logout = async () => {
    await frappeLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isGasManager: user?.roles?.includes('Gas Manager') ?? false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
