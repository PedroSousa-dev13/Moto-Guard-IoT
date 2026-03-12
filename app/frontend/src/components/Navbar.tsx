import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginSidebar from './auth/LoginSidebar';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [isLoginSidebarOpen, setIsLoginSidebarOpen] = useState(false);

  return (
    <>
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
              <button onClick={logout} className="nav-link logout-btn">
                🚪 Sair
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsLoginSidebarOpen(true)} 
              className="nav-link login-btn"
            >
              Entrar
            </button>
          )}
        </div>
      </nav>

      {/* Login Sidebar Modal */}
      <LoginSidebar 
        isOpen={isLoginSidebarOpen} 
        onClose={() => setIsLoginSidebarOpen(false)} 
      />
    </>
  );
};

export default Navbar;
