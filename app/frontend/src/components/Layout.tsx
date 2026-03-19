import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import OfflineBanner from './OfflineBanner';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

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

  return (
    <div className="layout layout-app">
      <Sidebar />
      <div className="layout-main">
        <Navbar />
        <OfflineBanner />
        <main className="main-content">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default Layout;
