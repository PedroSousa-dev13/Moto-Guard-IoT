import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { motorcyclesAPI } from '../../services/api';
import { useDemoContext } from '../../demo/DemoContext';

type GuardStatus = 'loading' | 'ok' | 'redirect' | 'error';

interface OnboardingGuardProps {
  // When used as a layout route wrapper, children come via <Outlet>
  // When used directly, children can be passed as props
  children?: React.ReactNode;
}

const ADMIN_EMAIL = 'admin@admin.com';

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { isDemoMode } = useDemoContext();
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<GuardStatus>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Cache result — only re-check when coming back from /garage
  const checkedRef = useRef(false);
  const prevPathRef = useRef(location.pathname);

  const isAdmin = user?.email === ADMIN_EMAIL;

  async function check() {
    setStatus('loading');
    try {
      const res = await motorcyclesAPI.getAll();
      checkedRef.current = true;
      setStatus(res.data.length > 0 ? 'ok' : 'redirect');
    } catch {
      setErrorMsg('Não foi possível verificar as tuas motas.');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (isAdmin) return;
    if (isDemoMode) return;
    // Re-check after visiting /garage (user may have added a moto)
    if (prevPathRef.current === '/garage' && location.pathname !== '/garage') {
      checkedRef.current = false;
    }
    prevPathRef.current = location.pathname;
    if (checkedRef.current) return;
    void check();
  }, [isAdmin, isDemoMode, location.pathname]);

  if (isDemoMode) return <>{children ?? <Outlet />}</>;

  if (isAdmin) return <>{children ?? <Outlet />}</>;

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>A verificar garagem...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro de verificação</div>
          <div className="empty-state-text" style={{ marginBottom: 14 }}>{errorMsg}</div>
          <button className="btn btn-primary" onClick={() => void check()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (status === 'redirect') {
    return <Navigate to="/garage" replace />;
  }

  return <>{children ?? <Outlet />}</>;
};

export default OnboardingGuard;
