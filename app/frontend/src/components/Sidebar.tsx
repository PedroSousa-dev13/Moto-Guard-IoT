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
  MapPinned,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useI18n();
  const location = useLocation();

  const navGroups = [
    {
      label: t('sidebar.monitoring'),
      items: [
        { path: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={21} /> },
        { path: '/map', label: t('nav.map'), icon: <MapIcon size={21} /> },
        { path: '/analytics', label: t('nav.analytics'), icon: <BarChart3 size={21} /> },
        { path: '/alertas', label: t('nav.alerts'), icon: <Bell size={21} /> },
      ],
    },
    {
      label: t('sidebar.data'),
      items: [
        { path: '/garage', label: t('nav.garage'), icon: <Bike size={21} /> },
        { path: '/trips', label: t('nav.trips'), icon: <Route size={21} /> },
        { path: '/gpx', label: t('sidebar.gpx'), icon: <Compass size={21} /> },
      ],
    },
    {
      label: t('sidebar.system'),
      items: [
        { path: '/simulator-contexts', label: t('sidebar.simulator'), icon: <Cpu size={21} /> },
        { path: '/real-simulator', label: t('sidebar.realSimulator'), icon: <PlayCircle size={21} /> },
        { path: '/gpx-simulator', label: t('sidebar.gpxSimulator'), icon: <MapPinned size={21} /> },
        { path: '/about', label: t('sidebar.howItWorks'), icon: <Info size={21} /> },
      ],
    },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-0' : 'w-full md:w-72'
      } bg-surface/80 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-border-glass flex flex-col shrink-0 z-[100] transition-all duration-300 relative`}
    >
      {/* Wrapper to prevent content layout distortion during collapse transition */}
      <div
        className={`${
          collapsed ? 'w-0' : 'w-[100vw] md:w-72'
        } h-full flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* HEADER / LOGO */}
        <div className="p-4 md:p-6 border-b border-border-glass-subtle flex items-center justify-center shrink-0 h-20">
          <img src="/logo.svg" alt="MotoGuard Logo" className="h-10 w-auto object-contain transition-all duration-300 ease-in-out" />
        </div>

        {/* NAV */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-5 flex flex-row md:flex-col gap-2 md:gap-7 overflow-x-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label} className="flex flex-row md:flex-col gap-1 md:gap-3.5 min-w-max md:min-w-0">
              {!collapsed && (
                <div className="hidden md:block text-[0.68rem] font-black uppercase tracking-[0.2em] text-muted mb-2 ml-2.5 opacity-50">
                  {group.label}
                </div>
              )}
              <div className="flex flex-row md:flex-col gap-1.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all group relative shrink-0 md:shrink ${
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
                        <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>
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
      </div>

      {/* Appendix / Tab Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute top-2 left-full -ml-[1px] bg-surface/80 hover:bg-surface/90 border-y border-r border-border-glass flex items-center justify-center cursor-pointer shadow-xl transition-all duration-300 select-none z-[110]
          w-7 h-16 rounded-r-2xl text-muted hover:text-accent active:scale-[0.95] backdrop-blur-2xl"
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  );
};

export default Sidebar;
