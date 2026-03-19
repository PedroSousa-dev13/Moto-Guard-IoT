import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Bike, User, Settings, LogOut, LogIn, Bell } from 'lucide-react';
import { loadAlerts } from '../utils/alerts';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const unreadCount = useMemo(() => {
    if (!isAuthenticated) return 0;
    return loadAlerts().filter((a) => a.status === "unread").length;
  }, [isAuthenticated, location.pathname]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <Bike size={24} className="brand-icon" />
          <span className="brand-name">MotoGuard</span>
        </Link>
      </div>

      <div className="navbar-menu">
        {isAuthenticated ? (
          <>
            <Link to="/alertas" className="nav-icon-link nav-bell" title="Alertas">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </Link>
            <div className="navbar-user">
              <div className="user-avatar">
                <User size={16} />
              </div>
              <span className="user-name">{user?.name}</span>
            </div>
            <Link to="/settings" className="nav-icon-link" title="Definições">
              <Settings size={20} />
            </Link>
            <button
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="nav-icon-link logout-btn"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/login", { state: { from: location } })}
            className="btn btn-primary login-btn"
          >
            <LogIn size={18} />
            <span>Entrar</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
