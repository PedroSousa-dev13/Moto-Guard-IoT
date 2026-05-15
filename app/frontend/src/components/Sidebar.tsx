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
  MapPinned
} from 'lucide-react';

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const Sidebar: FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { isDemoMode, demoUser, exitDemoMode } = useDemoContext();
  const { t } = useI18n();
  const location = useLocation();

  const displayUser = isDemoMode ? demoUser : user;
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
    <aside className="w-full md:w-72 bg-surface/80 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-border-glass flex flex-col shrink-0 z-[100] transition-all duration-300">
      {/* HEADER */}
      <div className="p-6 pb-4 border-b border-border-glass-subtle hidden md:block">
        <Link to="/" className="flex items-center gap-4 group mb-6 no-underline">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform duration-500">
            <Bike size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-text tracking-tighter m-0 leading-none">MotoGuard</h2>
            <span className="text-[0.6rem] font-black text-accent tracking-[0.2em] uppercase mt-1 opacity-80">IoT Platform</span>
          </div>
        </Link>

        {showUser && (
          <div className="flex items-center gap-4 bg-panel border border-border-glass-subtle p-4 rounded-[1.25rem] group hover:bg-panel-hover transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center text-sm font-black text-white shadow-lg shadow-accent/20 shrink-0">
              {getInitials(displayUser?.name)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[0.8rem] font-bold text-text truncate leading-tight">{displayUser?.name}</span>
              <span className="text-[0.65rem] font-medium text-muted truncate">{displayUser?.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 flex flex-row md:flex-col gap-4 md:gap-8 overflow-x-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-row md:flex-col gap-2 min-w-max md:min-w-0">
            <div className="hidden md:block text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted mb-4 opacity-40 ml-2">
              {group.label}
            </div>
            <div className="flex flex-row md:flex-col gap-1.5">
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative shrink-0 md:shrink-1 ${
                    location.pathname === item.path
                      ? 'bg-accent/10 text-accent border border-accent/20 shadow-lg shadow-accent/5'
                      : 'text-muted hover:text-text hover:bg-panel border border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    location.pathname === item.path
                      ? 'bg-accent text-white shadow-lg shadow-accent/20'
                      : 'bg-panel text-muted group-hover:bg-panel-hover group-hover:text-text'
                  }`}>
                    {item.icon}
                  </div>
                  <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>
                  {location.pathname === item.path && (
                    <div className="absolute left-[-1px] top-1/4 bottom-1/4 w-1 bg-accent rounded-full hidden md:block" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* FOOTER */}
      {showUser && (
        <div className="p-6 border-t border-border-glass-subtle hidden md:block">
          <button
            onClick={isDemoMode ? exitDemoMode : logout}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-red/10 border border-red/20 text-red font-black text-sm uppercase tracking-widest hover:bg-red hover:text-white hover:border-transparent transition-all shadow-lg active:scale-[0.98]"
          >
            <LogOut size={18} />
            <span>{isDemoMode ? t('demo.exit') : t('nav.logout')}</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
