'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

type AuthContextType = {
  token: string | null;
  username: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  username: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored) setToken(stored);
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  const username = token
    ? (() => {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.username ?? null;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
