import { ReactNode, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import OfflineBanner from './OfflineBanner';
import SOSCountdown from './SOSCountdown';
import { useSocket } from '../hooks/useSocket';

const STORAGE_KEY = 'motoguard_sidebar_collapsed';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isDemoMode } = useDemoContext();
  const { crashAlert, cancelEmergency } = useSocket();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isMap = location.pathname === '/map';
  const isNoScroll = isDashboard || isMap;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.dispatchEvent(new CustomEvent('motoguard_sidebar_toggle', { detail: { collapsed: next } }));
      return next;
    });
  };

  if (!isAuthenticated && !isDemoMode) {
    return (
      <div className="min-h-screen flex flex-col bg-bg transition-colors duration-500">
        <Navbar onToggleSidebar={toggleSidebar} sidebarCollapsed={false} />
        <main className="flex-1">
          {children || <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-bg transition-colors duration-500 overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {crashAlert && (
          <SOSCountdown
            deviceId={crashAlert.deviceId}
            initialSeconds={crashAlert.countdownSec}
            onCancel={cancelEmergency}
          />
        )}
        <Navbar onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        <OfflineBanner />
        <main className={`flex-1 ${isNoScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'} px-4 py-6 md:px-10 md:py-12`}>
          <div className={`max-w-[1600px] mx-auto w-full ${isNoScroll ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
