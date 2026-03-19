import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import OnboardingGuard from './components/auth/OnboardingGuard';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import Gpx from './pages/Gpx';
import Map from './pages/Map';
import SimulatorContexts from './pages/SimulatorContexts';
import Analytics from './pages/Analytics';
import Alertas from './pages/Alertas';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Garage from './pages/Garage';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';
import './App.css';
import './Layout.css';

function HomeOrDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Layout>
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
              {/* All other protected routes share a single OnboardingGuard instance */}
              <Route element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Outlet />
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
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
