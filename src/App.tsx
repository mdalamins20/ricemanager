import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { auth } from './firebase';

// Components & Pages
import { Layout } from './components/Layout';
import { AppProviders } from './contexts';
import { AutoMonthEndScheduler } from './components/AutoMonthEndScheduler';

// Lazy loaded pages
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Members = React.lazy(() => import('./pages/Members').then(m => ({ default: m.Members })));
const MealEntry = React.lazy(() => import('./pages/MealEntry').then(m => ({ default: m.MealEntry })));
const Reports = React.lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Money = React.lazy(() => import('./pages/Money').then(m => ({ default: m.Money })));
const ViewReport = React.lazy(() => import('./pages/ViewReport').then(m => ({ default: m.ViewReport })));
const Accounting = React.lazy(() => import('./pages/Accounting').then(m => ({ default: m.Accounting })));

// Protected Route Wrapper (Redirects to /reports when not logged in)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/reports" replace />;

  return <>{children}</>;
};

const LoadingFallback = () => (
  <div className="flex h-full items-center justify-center">
    <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<firebase.User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AppProviders>
      <AutoMonthEndScheduler />
      <HashRouter>
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              {/* Public Route (Accessible by all, read-only restricted for visitors) */}
              <Route path="/reports" element={<Reports />} />
              
              {/* Protected Routes (Admin only - Logged-out users redirect to /reports) */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/members" element={
                <ProtectedRoute>
                  <Members />
                </ProtectedRoute>
              } />
              <Route path="/meals" element={
                <ProtectedRoute>
                  <MealEntry />
                </ProtectedRoute>
              } />
              <Route path="/money" element={
                <ProtectedRoute>
                  <Money />
                </ProtectedRoute>
              } />
              <Route path="/accounting" element={
                <ProtectedRoute>
                  <Accounting />
                </ProtectedRoute>
              } />
              <Route path="/view-report" element={<ViewReport />} />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />

              {/* Catch-all redirect to /reports */}
              <Route path="*" element={<Navigate to="/reports" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </AppProviders>
  );
};

export default App;
