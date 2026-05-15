import { useCallback } from 'react';
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
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 md:px-10 bg-bg/60 backdrop-blur-xl border-b border-border-glass-subtle shadow-xl shadow-black/10 transition-all duration-300">
      <div className="flex items-center gap-4">
        {location.pathname === '/dashboard' ? (
          <div className="hidden" />
        ) : (
          <Link to="/" className="flex items-center gap-3 no-underline group md:hidden">
            <div className="p-2 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
              <Bike size={22} />
            </div>
            <span className="text-lg font-black text-text tracking-tighter">MotoGuard</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <NotificationCenter />
            
            <div className="hidden sm:flex items-center gap-3 bg-panel border border-border-glass-subtle p-1.5 rounded-2xl group hover:bg-panel-hover transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-accent-gradient flex items-center justify-center text-[0.65rem] font-black text-white shadow-lg shadow-accent/20">
                {getInitials(user?.name)}
              </div>
              <span className="text-[0.7rem] font-black text-muted tracking-wide px-2 uppercase opacity-80 group-hover:text-text transition-colors">
                {user?.name}
              </span>
            </div>

            <Link 
              to="/settings" 
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-panel border border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover transition-all" 
              title="Definições"
            >
              <Settings size={18} />
            </Link>

            <button
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white hover:border-transparent transition-all shadow-lg shadow-red/5 active:scale-95"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={goToLogin}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white font-black text-[0.75rem] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
            aria-label={t('auth.login')}
          >
            <LogIn size={18} />
            <span>{t('auth.login')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
