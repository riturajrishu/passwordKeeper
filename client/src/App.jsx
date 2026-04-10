import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import { verifySession } from './lib/api';
import Toast from './components/Toast';

import { lazy, Suspense } from 'react';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import MasterPasswordPrompt from './pages/MasterPasswordPrompt';

// Lazy loaded routes for bundle optimization
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SecurityAudit = lazy(() => import('./pages/SecurityAudit'));
const Settings = lazy(() => import('./pages/Settings'));
const BreachScanner = lazy(() => import('./pages/BreachScanner'));
const PhishingAnalyzer = lazy(() => import('./pages/PhishingAnalyzer'));
const Trash = lazy(() => import('./pages/Trash'));
const SupportCenter = lazy(() => import('./pages/SupportCenter'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SharedView = lazy(() => import('./pages/SharedView'));
const EmergencyInvite = lazy(() => import('./pages/EmergencyInvite'));
const EmergencyVaultView = lazy(() => import('./pages/EmergencyVaultView'));
const EmergencyAccess = lazy(() => import('./pages/EmergencyAccess'));
const DocumentLocker = lazy(() => import('./pages/DocumentLocker'));

// Custom Full-Page Suspense Loader
const VaultSuspenseLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
                <div className="w-6 h-6 border-b-2 border-r-2 border-primary rounded-full animate-spin" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Loading Secure Environment...</p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }) => {
  const user = useAuthStore(s => s.user);
    const isLoading = useAuthStore(s => s.isLoading);
    const isVaultUnlocked = useAuthStore(s => s.isVaultUnlocked);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isVaultUnlocked) return <MasterPasswordPrompt />;
  return children;
};

const AdminRoute = ({ children }) => {
  const user = useAuthStore(s => s.user);
    const isLoading = useAuthStore(s => s.isLoading);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await verifySession();
        if (data.authenticated) {
            setUser({ uid: data.uid, email: data.email, name: data.name, phoneNumber: data.phoneNumber, role: data.role });
        } else {
            setUser(null);
        }
      } catch {
        setUser(null);
      }
    };
    checkSession();
  }, [setUser]);

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 antialiased font-sans">
        <Suspense fallback={<VaultSuspenseLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Public share view — no auth required */}
            <Route path="/share/:token" element={<SharedView />} />
            {/* Public emergency access routes — no auth required */}
            <Route path="/emergency/invite/:token" element={<EmergencyInvite />} />
            <Route path="/emergency/view/:contactId" element={<EmergencyVaultView />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/audit" element={<SecurityAudit />} />
              <Route path="/scanner" element={<BreachScanner />} />
              <Route path="/phishing" element={<PhishingAnalyzer />} />
              <Route path="/trash" element={<Trash />} />
              <Route path="/support" element={<SupportCenter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/locker" element={<DocumentLocker />} />
              <Route path="/emergency" element={<EmergencyAccess />} />
              <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            </Route>
          </Routes>
        </Suspense>
      </div>
      {/* Global Toast Notifications */}
      <Toast />
    </Router>
  );
}

export default App;
