import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import { useI18n } from '../i18n';
import {
  LayoutDashboard,
  BarChart3,
  Bell,
  SlidersHorizontal,
  Map as MapIcon,
  Route,
  Compass,
  Cpu,
  User as UserIcon,
  LogOut,
  Bike,
  Info,
  PlayCircle,
  MapPinned,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { logout, isAuthenticated } = useAuth();
  const { isDemoMode, exitDemoMode } = useDemoContext();
  const { t } = useI18n();
  const location = useLocation();

  const showUser = isAuthenticated || isDemoMode;

  const navGroups = [
    {
      label: t('sidebar.monitoring'),
      items: [
        { path: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={18} /> },
        { path: '/map', label: t('nav.map'), icon: <MapIcon size={18} /> },
        { path: '/analytics', label: t('nav.analytics'), icon: <BarChart3 size={18} /> },
        { path: '/alertas', label: t('nav.alerts'), icon: <Bell size={18} /> },
      ],
    },
    {
      label: t('sidebar.data'),
      items: [
        { path: '/garage', label: t('nav.garage'), icon: <Bike size={18} /> },
        { path: '/trips', label: t('nav.trips'), icon: <Route size={18} /> },
        { path: '/gpx', label: t('sidebar.gpx'), icon: <Compass size={18} /> },
      ],
    },
    {
      label: t('sidebar.system'),
      items: [
        { path: '/simulator-contexts', label: t('sidebar.simulator'), icon: <Cpu size={18} /> },
        { path: '/real-simulator', label: t('sidebar.realSimulator'), icon: <PlayCircle size={18} /> },
        { path: '/gpx-simulator', label: t('sidebar.gpxSimulator'), icon: <MapPinned size={18} /> },
        { path: '/settings', label: t('nav.settings'), icon: <SlidersHorizontal size={18} /> },
        { path: '/profile', label: t('nav.profile'), icon: <UserIcon size={18} /> },
        { path: '/about', label: t('sidebar.howItWorks'), icon: <Info size={18} /> },
      ],
    },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-0 md:w-[72px]' : 'w-full md:w-72'
      } bg-surface/80 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-border-glass flex flex-col shrink-0 z-[100] transition-all duration-300 overflow-hidden`}
    >
      {/* NAV */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-6 overflow-x-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-row md:flex-col gap-1 md:gap-2 min-w-max md:min-w-0">
            {!collapsed && (
              <div className="hidden md:block text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted mb-1 ml-2 opacity-40">
                {group.label}
              </div>
            )}
            <div className="flex flex-row md:flex-col gap-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative shrink-0 md:shrink ${
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent/20 shadow-lg shadow-accent/5'
                        : 'text-muted hover:text-text hover:bg-panel border border-transparent'
                    } ${collapsed ? 'justify-center md:justify-center' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <div
                      className={`flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'text-accent'
                          : 'text-muted group-hover:text-text'
                      }`}
                    >
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <span className="font-bold text-xs tracking-tight whitespace-nowrap">{item.label}</span>
                    )}
                    {isActive && !collapsed && (
                      <div className="absolute left-[-1px] top-1/4 bottom-1/4 w-1 bg-accent rounded-full hidden md:block" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* FOOTER */}
      {showUser && (
        <div className="p-3 md:p-4 border-t border-border-glass-subtle hidden md:block">
          <button
            onClick={isDemoMode ? exitDemoMode : logout}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red/10 border border-red/20 text-red font-black text-xs uppercase tracking-widest hover:bg-red hover:text-white hover:border-transparent transition-all shadow-lg active:scale-[0.98] ${
              collapsed ? 'w-full' : 'w-full'
            }`}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut size={16} />
            {!collapsed && <span>{isDemoMode ? t('demo.exit') : t('nav.logout')}</span>}
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
