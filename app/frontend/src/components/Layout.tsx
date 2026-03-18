import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // Se não estiver autenticado, mostrar apenas o conteúdo sem sidebar
  if (!isAuthenticated) {
    return (
      <div className="layout layout-auth">
        <Navbar />
        <main className="main-content">
          {children || <Outlet />}
        </main>
      </div>
    );
  }

  // Layout com sidebar para utilizadores autenticados
  return (
    <div className="layout layout-app">
      <Sidebar />
      <div className="layout-main">
        <Navbar />
        <main className="main-content">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default Layout;
