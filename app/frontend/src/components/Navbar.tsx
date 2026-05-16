import { FC, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { Settings, LogOut, LogIn, Sun, Moon, Maximize2, Minimize2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { loadSettings, saveSettings, applyTheme, getEffectiveTheme, type Theme } from '../utils/settings';

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

interface NavbarProps {
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

const Navbar: FC<NavbarProps> = ({ sidebarCollapsed = false, onSidebarToggle }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => loadSettings().theme);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  const goToLogin = useCallback(() => {
    if (location.pathname === '/login') return;
    navigate('/login', { state: { from: location } });
  }, [navigate, location]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
    };
  }, []);

  useEffect(() => {
    setTheme(loadSettings().theme);
  }, [location.pathname]);

  const toggleTheme = useCallback(() => {
    const currentTheme = loadSettings().theme;
    const newTheme: Theme = getEffectiveTheme(currentTheme) === 'dark' ? 'light' : 'dark';
    const settings = loadSettings();
    const updatedSettings = { ...settings, theme: newTheme };
    saveSettings(updatedSettings);
    applyTheme(newTheme);
    setTheme(newTheme);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      return;
    }

    document.documentElement.requestFullscreen?.();
    if (!(document.fullscreenElement) && (document.documentElement as any).webkitRequestFullscreen) {
      (document.documentElement as any).webkitRequestFullscreen();
    }
  }, []);

  const showLogo = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register';

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 md:px-10 bg-bg/60 backdrop-blur-xl border-b border-border-glass-subtle shadow-xl shadow-black/10 transition-all duration-300">
      <div className="flex items-center gap-3">
        {onSidebarToggle && isAuthenticated && (
          <button
            type="button"
            onClick={onSidebarToggle}
            className="btn-icon w-10 h-10 text-muted hover:text-text"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        )}

        {showLogo && (
          <Link
            to="/"
            className="flex items-center no-underline bg-transparent hover:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
          >
            <img src="/logo.svg" alt="MotoGuard" className="h-10 w-auto block" />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <NotificationCenter />

            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-3 bg-panel border border-border-glass-subtle p-1.5 rounded-2xl group hover:bg-panel-hover transition-all cursor-pointer"
              title="Ver perfil"
            >
              <div className="w-8 h-8 rounded-xl bg-accent-gradient flex items-center justify-center text-[0.65rem] font-black text-white shadow-lg shadow-accent/20">
                {getInitials(user?.name)}
              </div>
              <span className="text-[0.7rem] font-black text-muted tracking-wide px-2 uppercase opacity-80 group-hover:text-text transition-colors">
                {user?.name}
              </span>
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-icon w-10 h-10 text-muted hover:text-text"
              title="Alternar modo claro/escuro"
              aria-label="Alternar modo claro/escuro"
            >
              {getEffectiveTheme(theme) === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-icon w-10 h-10 text-muted hover:text-text"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

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
