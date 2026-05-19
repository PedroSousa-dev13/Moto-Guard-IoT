import { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { 
  LayoutDashboard, 
  BarChart3,
  Bell,
  Map as MapIcon, 
  Route, 
  Compass, 
  Cpu,
  Bike,
  Info,
  PlayCircle,
  MapPinned
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar: FC<SidebarProps> = ({ collapsed }) => {
  const { t } = useI18n();
  const location = useLocation();

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
        { path: '/about', label: t('sidebar.howItWorks'), icon: <Info size={18} /> },
      ],
    },
  ];

  return (
    <aside className={`w-full ${collapsed ? 'md:w-20' : 'md:w-60'} bg-surface/80 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-border-glass-subtle flex flex-col shrink-0 z-100 transition-all duration-300`}>
      {/* HEADER */}
      <div className={`px-4 py-3 ${collapsed ? 'justify-center' : 'justify-start'} flex items-center gap-3`}>
        <Link
          to="/"
          className="flex items-center no-underline bg-transparent hover:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
        >
          <img
            src={collapsed ? '/favicon.svg' : '/logo.svg'}
            alt="MotoGuard"
            className={`${collapsed ? 'h-10 w-10' : 'h-12 w-auto'} block`}
          />
        </Link>
      </div>

      {/* NAV */}
      <nav className={`${collapsed ? 'hidden' : 'flex-1'} overflow-y-auto custom-scrollbar p-2.5 md:p-3 flex flex-row md:flex-col gap-2.5 md:gap-3 overflow-x-auto no-scrollbar`}>
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all group relative shrink-0 md:shrink ${
                    location.pathname === item.path
                      ? 'bg-accent/10 text-accent border border-accent/20 shadow-lg shadow-accent/5'
                      : 'text-muted hover:text-text hover:bg-panel border border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    location.pathname === item.path
                      ? 'bg-accent text-white shadow-lg shadow-accent/20'
                      : 'bg-panel text-muted group-hover:bg-panel-hover group-hover:text-text'
                  }`}>
                    {item.icon}
                  </div>
                  <span className="font-bold text-[0.72rem] tracking-tight whitespace-nowrap">{item.label}</span>
                  {location.pathname === item.path && (
                    <div className="absolute -left-px top-1/4 bottom-1/4 w-1 bg-accent rounded-full hidden md:block" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
