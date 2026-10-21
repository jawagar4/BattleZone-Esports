import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { unwrap } from '../services/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser(unwrap(await api.get('/auth/me')).user); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    user, loading, refresh, setUser,
    isAdmin: user?.role === 'admin',
    async login(email, password) { const d = unwrap(await api.post('/auth/login', { email, password })); setUser(d.user); return d.user; },
    async register(payload) { const d = unwrap(await api.post('/auth/register', payload)); if (!d.emailVerificationRequired) setUser(d.user); return d; },
    async logout() { try { await api.post('/auth/logout'); } finally { setUser(null); } },
  }), [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
