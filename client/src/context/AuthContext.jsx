import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client, { getToken, setToken } from '../api/client.js';
import { signInWithGoogle } from '../utils/google.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await client.get('/auth/me');
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const handleAuthResponse = (data) => {
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    handleAuthResponse(data);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await client.post('/auth/register', payload);
    handleAuthResponse(data);
    return data.user;
  };

  /** Called with an id_token obtained from the Google button/one-tap. */
  const googleLoginWithToken = async (idToken, role = 'student') => {
    const { data } = await client.post('/auth/google', { idToken, role });
    handleAuthResponse(data);
    return data.user;
  };

  /** Full Google popup flow (used where no button is rendered). */
  const googleLogin = async (role) => {
    const idToken = await signInWithGoogle();
    return googleLoginWithToken(idToken, role);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, googleLogin, googleLoginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
