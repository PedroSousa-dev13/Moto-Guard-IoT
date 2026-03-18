import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import Gpx from './pages/Gpx';
import Map from './pages/Map';
import SimulatorContexts from './pages/SimulatorContexts';
import Profile from './pages/Profile';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import './App.css';
import './Layout.css';

function App() {
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
              <Route path="/trips/:id" element={
                <ProtectedRoute>
                  <TripDetail />
                </ProtectedRoute>
              } />
              <Route path="/map" element={
                <ProtectedRoute>
                  <Map />
                </ProtectedRoute>
              } />
              <Route path="/gpx" element={
                <ProtectedRoute>
                  <Gpx />
                </ProtectedRoute>
              } />
              <Route path="/simulator-contexts" element={
                <ProtectedRoute>
                  <SimulatorContexts />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
