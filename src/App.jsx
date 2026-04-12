import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { TripProvider } from './context/TripContext';
import InAppNotification from './components/shared/InAppNotification';
import StatusBarBackground from './components/shared/StatusBarBackground';

// Eagerly-loaded shell (tiny, needed at startup)
import Layout from './components/layout/Layout';

// Lazily-loaded route pages — each gets its own chunk
const LoginPage     = lazy(() => import('./components/auth/LoginPage'));
const ProfileSetup  = lazy(() => import('./components/auth/ProfileSetup'));
const RiderHome     = lazy(() => import('./components/rider/RiderHome'));
const DriverHome    = lazy(() => import('./components/driver/DriverHome'));
const Profile       = lazy(() => import('./components/shared/Profile'));
const TripsHistory  = lazy(() => import('./components/shared/TripsHistory'));

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!currentUser) return <Navigate to="/login" />;

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
    if (Capacitor.isNativePlatform()) {
      const configStatus = async () => {
        try {
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setStyle({ style: Style.Dark });
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
          <StatusBarBackground />
          <InAppNotification />

          <BrowserRouter>
            <Suspense fallback={<Spinner />}>
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
            </Suspense>
          </BrowserRouter>
        </TripProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
