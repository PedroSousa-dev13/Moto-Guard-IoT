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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storage key baseado em remember me
  const getStorageKey = (key: string) => {
    const useLocalStorage = localStorage.getItem('rememberMe') === 'true';
    return useLocalStorage ? key : `session_${key}`;
  };

  // Carregar token e user do storage
  useEffect(() => {
    const storageKey = getStorageKey('token');
    const userKey = getStorageKey('user');
    
    const storedToken = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    const storedUser = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        clearAuth();
      }
    }
  }, []);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    setError(null);
    
    // Limpar ambos os storages
    ['token', 'session_token', 'user', 'session_user', 'rememberMe'].forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  };

  const clearError = () => setError(null);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.login(email, password);
      const { user: userData, token: newToken } = response.data;

      // Guardar preferência remember me
      localStorage.setItem('rememberMe', rememberMe.toString());

      // Escolher storage baseado em remember me
      const storage = rememberMe ? localStorage : sessionStorage;
      const keyPrefix = rememberMe ? '' : 'session_';

      storage.setItem(`${keyPrefix}token`, newToken);
      storage.setItem(`${keyPrefix}user`, JSON.stringify(userData));

      setUser(userData);
      setToken(newToken);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao fazer login';
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

      // Por defeito, usar remember me = true para novos registos
      const storage = localStorage;
      storage.setItem('rememberMe', 'true');
      storage.setItem('token', newToken);
      storage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      setToken(newToken);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao criar conta';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  const isAuthenticated = !!token && !!user;

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
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};
