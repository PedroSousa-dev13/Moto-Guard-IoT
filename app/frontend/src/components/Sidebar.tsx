import { FC } from 'react';
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
        { path: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={16} /> },
        { path: '/map', label: t('nav.map'), icon: <MapIcon size={16} /> },
        { path: '/analytics', label: t('nav.analytics'), icon: <BarChart3 size={16} /> },
        { path: '/alertas', label: t('nav.alerts'), icon: <Bell size={16} /> },
      ],
    },
    {
      label: t('sidebar.data'),
      items: [
        { path: '/garage', label: t('nav.garage'), icon: <Bike size={16} /> },
        { path: '/trips', label: t('nav.trips'), icon: <Route size={16} /> },
        { path: '/gpx', label: t('sidebar.gpx'), icon: <Compass size={16} /> },
      ],
    },
    {
      label: t('sidebar.system'),
      items: [
        { path: '/simulator-contexts', label: t('sidebar.simulator'), icon: <Cpu size={16} /> },
        { path: '/real-simulator', label: t('sidebar.realSimulator'), icon: <PlayCircle size={16} /> },
        { path: '/gpx-simulator', label: t('sidebar.gpxSimulator'), icon: <MapPinned size={16} /> },
        { path: '/settings', label: t('nav.settings'), icon: <SlidersHorizontal size={16} /> },
        { path: '/profile', label: t('nav.profile'), icon: <UserIcon size={16} /> },
        { path: '/about', label: t('sidebar.howItWorks'), icon: <Info size={16} /> },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="brand-logo-icon" style={{ background: 'var(--accent-gradient)', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}>
            <Bike size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 style={{ letterSpacing: '-0.04em' }}>MotoGuard</h2>
            <div className="brand-logo-tagline" style={{ color: 'var(--accent-blue)', opacity: 0.8 }}>IOT PLATFORM</div>
          </div>
        </div>
        {showUser && (
          <div className="user-info">
            <div className="user-avatar-sidebar">{getInitials(displayUser?.name)}</div>
            <div className="user-info-text">
              <span className="user-name">{displayUser?.name}</span>
              <span className="user-email">{displayUser?.email}</span>
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label} className="nav-group">
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon-wrap">
                  <span className="nav-icon">{item.icon}</span>
                </span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {showUser && (
        <div className="sidebar-footer">
          <button onClick={isDemoMode ? exitDemoMode : logout} className="sidebar-logout-btn">
            <LogOut size={15} />
            <span>{isDemoMode ? t('demo.exit') : t('nav.logout')}</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
