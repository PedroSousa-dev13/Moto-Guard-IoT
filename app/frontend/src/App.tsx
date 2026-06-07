import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DemoProvider, useDemoContext } from './demo/DemoContext';
import { I18nProvider } from './i18n';
import { TranslatedApp } from './i18n/TranslatedApp';
import DemoBanner from './demo/DemoBanner';
import Layout from './components/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import OnboardingGuard from './components/auth/OnboardingGuard';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import LoadingSpinner from './components/ui/LoadingSpinner';
import HomePage from './pages/HomePage';
import { loadSettings, applyTheme } from './utils/settings';
import './App.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trips = lazy(() => import('./pages/Trips'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const Gpx = lazy(() => import('./pages/Gpx'));
const Map = lazy(() => import('./pages/Map'));
const SimulatorContexts = lazy(() => import('./pages/SimulatorContexts'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Garage = lazy(() => import('./pages/Garage'));
const Login = lazy(() => import('./pages/Login'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const About = lazy(() => import('./pages/About'));
const RealSimulator = lazy(() => import('./pages/RealSimulator'));
const GpxSimulator = lazy(() => import('./pages/GpxSimulator'));

function HomeOrDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDemoMode } = useDemoContext();
  if (isLoading) return null;
  if (isAuthenticated || isDemoMode) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}

function AppFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <LoadingSpinner size="large" />
    </div>
  );
}

function App() {
  useEffect(() => {
    const settings = loadSettings();
    applyTheme(settings.theme);

    // Dynamic sync if OS/PC color scheme changes when theme is set to 'auto'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      const currentSettings = loadSettings();
      if (currentSettings.theme === 'auto') {
        applyTheme('auto');
        window.dispatchEvent(new Event("motoguard_settings_changed"));
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, []);
  return (
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <TranslatedApp>
              <DemoProvider>
                <div className="App">
                  <Layout>
                    <ErrorBoundary>
                      <Suspense fallback={<AppFallback />}>
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/reset-password/:token" element={<ResetPassword />} />
                          <Route path="/" element={<HomeOrDashboard />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/garage" element={
                            <ProtectedRoute>
                              <Garage />
                            </ProtectedRoute>
                          } />
                          <Route path="/profile" element={
                            <ProtectedRoute>
                              <Profile />
                            </ProtectedRoute>
                          } />
                          <Route element={
                            <ProtectedRoute>
                              <OnboardingGuard>
                                <>
                                  <DemoBanner />
                                  <Outlet />
                                </>
                              </OnboardingGuard>
                            </ProtectedRoute>
                          }>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/trips" element={<Trips />} />
                            <Route path="/trips/:id" element={<TripDetail />} />
                            <Route path="/map" element={<Map />} />
                            <Route path="/gpx" element={<Gpx />} />
                            <Route path="/simulator-contexts" element={<SimulatorContexts />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/alertas" element={<Alertas />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/real-simulator" element={<RealSimulator />} />
                            <Route path="/gpx-simulator" element={<GpxSimulator />} />
                          </Route>
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </Suspense>
                    </ErrorBoundary>
                  </Layout>
                </div>
              </DemoProvider>
            </TranslatedApp>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
