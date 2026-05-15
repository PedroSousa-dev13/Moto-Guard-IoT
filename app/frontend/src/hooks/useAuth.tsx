import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar user do token via /me
  useEffect(() => {
    authAPI
      .me()
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const handler = () => {
      clearAuth();
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    setError(null);
  };

  const clearError = () => setError(null);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.login(email, password);
      const { user: userData, token: newToken } = response.data;

      setUser(userData);
      setToken(newToken);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao fazer login';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.register(email, password, name);
      const { user: userData, token: newToken } = response.data;

      setUser(userData);
      setToken(newToken);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao criar conta';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  const isAuthenticated = !!user;
  const getToken = (): string | null => token;

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register,
      logout, 
      isAuthenticated, 
      isLoading,
      error,
      clearError,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};
