import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupDemoInterceptor } from './demoAPIInterceptor';

const DEMO_SESSION_KEY = 'demo_mode';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

export interface DemoContextValue {
  isDemoMode: boolean;
  activateDemo: () => void;
  exitDemoMode: () => void;
  demoUser: DemoUser;
  registerEmitter: (emitter: { stop: () => void }) => void;
}

const DEMO_USER: DemoUser = {
  id: 'demo-user-001',
  name: 'Demo User',
  email: 'demo@motoguard.demo',
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';
  });

  const emitterRef = useRef<{ stop: () => void } | null>(null);
  const navigate = useNavigate();

  const activateDemo = () => {
    sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
    setIsDemoMode(true);
    navigate('/dashboard');
  };

  const exitDemoMode = () => {
    if (!isDemoMode) return;
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    if (emitterRef.current) {
      emitterRef.current.stop();
      emitterRef.current = null;
    }
    setIsDemoMode(false);
    navigate('/');
  };

  const registerEmitter = (emitter: { stop: () => void }) => {
    emitterRef.current = emitter;
  };

  // Task 3.10 — register/unregister the API interceptor when demo mode changes
  useEffect(() => {
    if (isDemoMode) {
      const cleanup = setupDemoInterceptor(() => isDemoMode);
      return cleanup;
    }
  }, [isDemoMode]);

  return (
    <DemoContext.Provider value={{ isDemoMode, activateDemo, exitDemoMode, demoUser: DEMO_USER, registerEmitter }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemoContext must be used within DemoProvider');
  }
  return ctx;
}
