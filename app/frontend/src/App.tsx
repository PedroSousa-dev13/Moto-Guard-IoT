import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginSidebar from './components/auth/LoginSidebar';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import Map from './pages/Map';
import Profile from './pages/Profile';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import './App.css';
import './Layout.css';

function App() {
  const [isLoginSidebarOpen, setIsLoginSidebarOpen] = useState(false);

  useEffect(() => {
    // Listener para abrir login sidebar da HomePage
    const handleOpenLoginSidebar = () => {
      setIsLoginSidebarOpen(true);
    };

    window.addEventListener('openLoginSidebar', handleOpenLoginSidebar);

    return () => {
      window.removeEventListener('openLoginSidebar', handleOpenLoginSidebar);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/trips" element={
                <ProtectedRoute>
                  <Trips />
                </ProtectedRoute>
              } />
              <Route path="/map" element={
                <ProtectedRoute>
                  <Map />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
            </Routes>
          </Layout>
          
          {/* Login Sidebar Modal */}
          <LoginSidebar 
            isOpen={isLoginSidebarOpen} 
            onClose={() => setIsLoginSidebarOpen(false)} 
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
