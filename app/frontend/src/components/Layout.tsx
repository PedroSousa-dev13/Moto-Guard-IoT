import { ReactNode, FC } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import OfflineBanner from './OfflineBanner';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isDemoMode } = useDemoContext();

  if (!isAuthenticated && !isDemoMode) {
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
