import { ReactNode, FC } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import OfflineBanner from './OfflineBanner';
import SOSCountdown from './SOSCountdown';
import { useSocket } from '../hooks/useSocket';

interface LayoutProps {
  children?: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isDemoMode } = useDemoContext();
  const { crashAlert, cancelEmergency } = useSocket();

  if (!isAuthenticated && !isDemoMode) {
    return (
      <div className="min-h-screen flex flex-col bg-bg transition-colors duration-500">
        <Navbar />
        <main className="flex-1">
          {children || <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg transition-colors duration-500 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {crashAlert && (
          <SOSCountdown 
            deviceId={crashAlert.deviceId} 
            initialSeconds={crashAlert.countdownSec} 
            onCancel={cancelEmergency} 
          />
        )}
        <Navbar />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-12 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
