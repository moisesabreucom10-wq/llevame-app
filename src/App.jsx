import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { TripProvider } from './context/TripContext';
import LoginPage from './components/auth/LoginPage';
import ProfileSetup from './components/auth/ProfileSetup';
import Layout from './components/layout/Layout';
import RiderHome from './components/rider/RiderHome';
import DriverHome from './components/driver/DriverHome';
import InAppNotification from './components/shared/InAppNotification';
import StatusBarBackground from './components/shared/StatusBarBackground';

// Placeholder components for now
import Profile from './components/shared/Profile';
import TripsHistory from './components/shared/TripsHistory';

const ProtectedRoute = ({ children }) => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // If user is logged in but hasn't selected a type, redirect to setup
  if (!userProfile?.userType && window.location.pathname !== '/setup') {
    return <Navigate to="/setup" />;
  }

  return children;
};

const HomeRedirect = () => {
  const { userProfile } = useAuth();
  if (userProfile?.userType === 'driver') return <DriverHome />;
  return <RiderHome />;
};

function App() {
  useEffect(() => {
    // Configure Status Bar on Native launch
    if (Capacitor.isNativePlatform()) {
      const configStatus = async () => {
        try {
          // Disable overlay so webview starts BELOW status bar
          await StatusBar.setOverlaysWebView({ overlay: false });
          // Set DARK style (light icons for dark background)
          await StatusBar.setStyle({ style: Style.Dark });
          // Set solid BLACK background
          await StatusBar.setBackgroundColor({ color: '#000000' });
        } catch (e) {
          console.warn('Status Bar Config Error', e);
        }
      };
      configStatus();
    }
  }, []);

  return (
    <AuthProvider>
      <LocationProvider>
        <TripProvider>
          {/* Barra de estado negra visual (Android 15+ fix) */}
          <StatusBarBackground />

          {/* Notificaciones elegantes in-app */}
          <InAppNotification />

          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/setup" element={
                <ProtectedRoute>
                  <ProfileSetup />
                </ProtectedRoute>
              } />

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<HomeRedirect />} />
                <Route path="profile" element={<Profile />} />
                <Route path="trips" element={<TripsHistory />} />
                <Route path="history" element={<TripsHistory />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TripProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
