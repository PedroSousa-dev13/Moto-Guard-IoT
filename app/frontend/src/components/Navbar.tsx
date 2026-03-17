import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <span className="brand-icon">🏍️</span>
          <span className="brand-name">MotoGuard</span>
        </Link>
      </div>

      <div className="navbar-menu">
        {isAuthenticated ? (
          <>
            <div className="navbar-user">
              <span className="user-avatar">👤</span>
              <span className="user-name">{user?.name}</span>
            </div>
            <Link to="/profile" className="nav-link">
              ⚙️
            </Link>
            <button
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="nav-link logout-btn"
            >
              🚪 Sair
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/login", { state: { from: location } })}
            className="nav-link login-btn"
          >
            Entrar
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
