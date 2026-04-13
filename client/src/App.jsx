import { Suspense, lazy, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { AdminRoute, KitchenRoute, CashierRoute, WaiterRoute } from './PrivateRoutes';
import Layout from './components/Layout';
import DynamicTheme from './components/DynamicTheme';
import NotificationToast from './components/NotificationToast'; // Added


// ── Components ───────────────────────────────────────────────────
import Login from './pages/Login';

// ── Lazy Loaded Pages ─────────────────────────────────────────────
// This improves initial bundle size and load speed
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminMenu = lazy(() => import('./pages/Admin/Menu'));
const AdminTables = lazy(() => import('./pages/Admin/Tables'));
const AdminCategories = lazy(() => import('./pages/Admin/Categories'));
const AdminOrders = lazy(() => import('./pages/Admin/Orders'));
const AdminSettings = lazy(() => import('./pages/Admin/Settings'));
const AdminAnalytics = lazy(() => import('./pages/Admin/Analytics'));
const AdminNotifications = lazy(() => import('./pages/Admin/Notifications'));
const KitchenDashboard = lazy(() => import('./pages/Kitchen/Dashboard'));
const CashierDashboard = lazy(() => import('./pages/Cashier/Dashboard'));
const WorkingProcess = lazy(() => import('./pages/Cashier/WorkingProcess'));
const WaiterDashboard = lazy(() => import('./pages/Waiter/Dashboard'));
const DineIn = lazy(() => import('./pages/Waiter/DineIn'));
const TakeAway = lazy(() => import('./pages/Waiter/TakeAway'));
const LogoutConfirm = lazy(() => import('./pages/LogoutConfirm'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const ConnectionPage = lazy(() => import('./pages/ConnectionPage'));

/** Smart redirect for lost live link */
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const LiveGuard = ({ children }) => {
    const { socketConnected, user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // Redirection logic to /connection page disabled per user request to hide connection UI.
        // The application will now remain on the target page regardless of socket connectivity status.
        /*
        if (user && !socketConnected && 
            !['/connection', '/login', '/unauthorized'].includes(location.pathname)) {
            const timer = setTimeout(() => {
                if (!socketConnected) navigate('/connection');
            }, 5000);
            return () => clearTimeout(timer);
        }
        */
    }, [socketConnected, user, location.pathname, navigate]);

    return children;
};

/** Suspense fallback — shown when lazy chunks are loading */
const PageLoader = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--theme-bg-dark,#0f172a)] z-[9999]">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
    </div>
    <p className="mt-4 text-gray-500 text-sm font-bold uppercase tracking-widest animate-pulse">Loading…</p>
  </div>
);

/** Global overlay — shown whenever AuthContext.loading is true (login, etc.) */
const GlobalLoader = () => {
  const { loading } = useContext(AuthContext);
  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--theme-bg-card)] rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl border border-[var(--theme-border)]">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
        </div>
        <p className="text-[var(--theme-text-muted)] text-xs font-bold uppercase tracking-widest animate-pulse">
          Please wait…
        </p>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <NotificationProvider>
          {/* Global Toast Alerts */}
          <NotificationToast />
          <GlobalLoader />

          <DynamicTheme />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/connection" element={<ConnectionPage />} />

            <Route element={<Layout />}>

              {/* Admin Routes - Tenant Specific Management */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/menu" element={<AdminMenu />} />
                <Route path="/admin/tables" element={<AdminTables />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
              </Route>

              {/* Kitchen Routes */}
              <Route element={<KitchenRoute />}>
                <Route path="/kitchen" element={<LiveGuard><KitchenDashboard /></LiveGuard>} />
              </Route>

              {/* Cashier Routes */}
              <Route element={<CashierRoute />}>
                <Route path="/cashier" element={<LiveGuard><CashierDashboard /></LiveGuard>} />
                <Route path="/cashier/working-process" element={<LiveGuard><WorkingProcess /></LiveGuard>} />
                <Route path="/cashier/history" element={<LiveGuard><CashierDashboard /></LiveGuard>} />
              </Route>

              {/* Waiter Routes */}
              <Route element={<WaiterRoute />}>
                <Route path="/waiter" element={<LiveGuard><WaiterDashboard /></LiveGuard>} />
                <Route path="/dine-in" element={<LiveGuard><DineIn /></LiveGuard>} />
                <Route path="/take-away" element={<LiveGuard><TakeAway /></LiveGuard>} />
                <Route path="/waiter/working-process" element={<LiveGuard><WorkingProcess /></LiveGuard>} />
                <Route path="/waiter/history" element={<LiveGuard><WaiterDashboard /></LiveGuard>} />
              </Route>

              {/* Shared Mobile-Specific Routes */}
              <Route path="/logout" element={<LogoutConfirm />} />

            </Route>

            {/* Root + catch-all: always go to login (Login.jsx redirects logged-in users to their dashboard) */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
