
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { auth } from './firebase';

// Components & Pages
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { MealEntry } from './pages/MealEntry';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Money } from './pages/Money';
import { ViewReport } from './pages/ViewReport';
import { DataProvider } from './DataContext';

// Protected Route Wrapper (Only for Admin pages like Settings)
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
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App: React.FC = () => {
  // Global auth listener to handle layout updates
  const [user, setUser] = useState<firebase.User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <DataProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Public Routes (Read Access for Everyone) */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/meals" element={<MealEntry />} />
            <Route path="/money" element={<Money />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/view-report" element={<ViewReport />} />
            
            {/* Protected Routes (Admin Only) */}
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </HashRouter>
    </DataProvider>
  );
};

export default App;
