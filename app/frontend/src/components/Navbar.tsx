import { useCallback, useState, useEffect, FC } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import { useI18n } from '../i18n';
import { Bike, Settings, LogOut, LogIn, Maximize2, Minimize2, Sun, Moon, Monitor } from 'lucide-react';
import { loadSettings, saveSettings, applyTheme, getEffectiveTheme } from '../utils/settings';
import NotificationCenter from './NotificationCenter';

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

interface NavbarProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

const Navbar: FC<NavbarProps> = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { isDemoMode, demoUser, exitDemoMode } = useDemoContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const showAuthenticatedUI = isAuthenticated || isDemoMode;
  const displayUser = isDemoMode ? { name: demoUser.name, email: demoUser.email } : user;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState(() => loadSettings().theme);

  const effectiveTheme = getEffectiveTheme(theme);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      setTheme(loadSettings().theme);
    };
    window.addEventListener('motoguard_settings_changed', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('motoguard_settings_changed', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const settings = loadSettings();
    let nextTheme: 'light' | 'dark' | 'auto';
    if (settings.theme === 'light') {
      nextTheme = 'dark';
    } else if (settings.theme === 'dark') {
      nextTheme = 'auto';
    } else {
      nextTheme = 'light';
    }
    settings.theme = nextTheme;
    saveSettings(settings);
    applyTheme(nextTheme, true);
    setTheme(nextTheme);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Erro ao ativar Fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const goToLogin = useCallback(() => {
    if (location.pathname === '/login') return;
    navigate('/login', { state: { from: location } });
  }, [navigate, location]);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 md:px-8 md:h-20 bg-bg/60 backdrop-blur-xl border-b border-border-glass-subtle shadow-xl shadow-black/10 transition-all duration-300">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 no-underline group md:hidden">
          <div className="p-2 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
            <Bike size={22} />
          </div>
          <span className="text-lg font-black text-text tracking-tighter">MotoGuard</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {showAuthenticatedUI ? (
          <>
            <NotificationCenter />

            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-panel border border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover transition-all"
              title={isFullscreen ? 'Sair de Ecrã Inteiro' : 'Ecrã Inteiro'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>

            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-panel border border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover transition-all"
              title={
                theme === 'light'
                  ? 'Mudar para Modo Escuro (Atual: Claro)'
                  : theme === 'dark'
                  ? 'Mudar para Modo Automático (Atual: Escuro)'
                  : 'Mudar para Modo Claro (Atual: Automático)'
              }
            >
              {theme === 'light' && <Sun size={17} />}
              {theme === 'dark' && <Moon size={17} />}
              {theme === 'auto' && <Monitor size={17} />}
            </button>

            <Link
              to="/settings"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-panel border border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover transition-all"
              title="Definições"
            >
              <Settings size={17} />
            </Link>

            {!isDemoMode && (
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 bg-panel border border-border-glass-subtle p-1 rounded-xl group hover:bg-panel-hover transition-all no-underline cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center text-[0.6rem] font-black text-white shadow-lg shadow-accent/20">
                  {getInitials(displayUser?.name)}
                </div>
                <span className="text-[0.65rem] font-black text-muted tracking-wide px-1.5 uppercase opacity-80 group-hover:text-text transition-colors">
                  {displayUser?.name}
                </span>
              </Link>
            )}

            {isDemoMode ? (
              <button
                onClick={exitDemoMode}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white hover:border-transparent transition-all shadow-lg shadow-amber-500/5 active:scale-95 text-[0.7rem] font-black uppercase tracking-wider"
                title="Sair do modo demo"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Demo</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  logout();
                  navigate('/', { replace: true });
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white hover:border-transparent transition-all shadow-lg shadow-red/5 active:scale-95"
                title="Sair"
              >
                <LogOut size={17} />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={goToLogin}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white font-black text-[0.7rem] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
            aria-label={t('auth.login')}
          >
            <LogIn size={17} />
            <span>{t('auth.login')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
