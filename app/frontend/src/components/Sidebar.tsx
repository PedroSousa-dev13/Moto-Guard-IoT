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

const Sidebar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/garage', label: 'Garagem', icon: <Bike size={20} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
    { path: '/alertas', label: 'Alertas', icon: <Bell size={20} /> },
    { path: '/trips', label: 'Viagens', icon: <Route size={20} /> },
    { path: '/gpx', label: 'GPX', icon: <Compass size={20} /> },
    { path: '/map', label: 'Mapa', icon: <MapIcon size={20} /> },
    { path: '/simulator-contexts', label: 'Simulador', icon: <Cpu size={20} /> },
    { path: '/settings', label: 'Settings', icon: <SlidersHorizontal size={20} /> },
    { path: '/profile', label: 'Perfil', icon: <UserIcon size={20} /> },
    { path: '/about', label: 'Como Funciona', icon: <Info size={20} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <Bike size={28} />
          <h2>MotoGuard</h2>
        </div>
        {isAuthenticated && (
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {isAuthenticated && (
        <div className="sidebar-footer">
          <button onClick={logout} className="sidebar-logout-btn">
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
