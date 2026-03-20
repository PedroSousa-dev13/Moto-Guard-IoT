import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
  Info
} from 'lucide-react';

const navGroups = [
  {
    label: 'Monitorização',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { path: '/map', label: 'Mapa', icon: <MapIcon size={16} /> },
      { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
      { path: '/alertas', label: 'Alertas', icon: <Bell size={16} /> },
    ],
  },
  {
    label: 'Dados',
    items: [
      { path: '/garage', label: 'Garagem', icon: <Bike size={16} /> },
      { path: '/trips', label: 'Viagens', icon: <Route size={16} /> },
      { path: '/gpx', label: 'GPX', icon: <Compass size={16} /> },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/simulator-contexts', label: 'Simulador', icon: <Cpu size={16} /> },
      { path: '/settings', label: 'Settings', icon: <SlidersHorizontal size={16} /> },
      { path: '/profile', label: 'Perfil', icon: <UserIcon size={16} /> },
      { path: '/about', label: 'Como Funciona', icon: <Info size={16} /> },
    ],
  },
];

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const Sidebar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="brand-logo-icon">
            <Bike size={18} />
          </div>
          <div>
            <h2>MotoGuard</h2>
            <div className="brand-logo-tagline">IoT Platform</div>
          </div>
        </div>
        {isAuthenticated && (
          <div className="user-info">
            <div className="user-avatar-sidebar">{getInitials(user?.name)}</div>
            <div className="user-info-text">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
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

      {isAuthenticated && (
        <div className="sidebar-footer">
          <button onClick={logout} className="sidebar-logout-btn">
            <LogOut size={15} />
            <span>Terminar sessão</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
