import { FC, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { Bike, Settings, LogOut, LogIn } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const Navbar: FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const goToLogin = useCallback(() => {
    if (location.pathname === '/login') return;
    navigate('/login', { state: { from: location } });
  }, [navigate, location]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <Bike size={24} className="brand-icon" />
          <span className="brand-name">MotoGuard</span>
        </Link>
      </div>

      <div className="navbar-menu">
        {isAuthenticated ? (
          <>
            <NotificationCenter />
            <div className="navbar-user">
              <div className="user-avatar">
                {getInitials(user?.name)}
              </div>
              <span className="user-name">{user?.name}</span>
            </div>
            <Link to="/settings" className="nav-icon-link" title="Definições">
              <Settings size={20} />
            </Link>
            <button
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="nav-icon-link logout-btn"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={goToLogin}
            className="btn btn-primary login-btn"
            aria-label={t('auth.login')}
          >
            <LogIn size={18} aria-hidden />
            <span>{t('auth.login')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
