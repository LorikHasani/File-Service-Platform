import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui';

// Client Pages
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { DashboardPage } from '@/pages/Dashboard';
import { NewJobPage } from '@/pages/NewJob';
import { JobsListPage } from '@/pages/JobsList';
import { JobDetailPage } from '@/pages/JobDetail';
import { CreditsPage } from '@/pages/Credits';
import { PerformanceCalculatorPage } from '@/pages/PerformanceCalculator';
import { LandingPage } from '@/pages/Landing';
import { PricesPage } from '@/pages/Prices';
import { TermsPage } from '@/pages/legal/Terms';
import { PrivacyPage } from '@/pages/legal/Privacy';
import { RefundPolicyPage } from '@/pages/legal/RefundPolicy';

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboard';
import { AdminJobsPage } from '@/pages/admin/AdminJobs';
import { AdminJobDetailPage } from '@/pages/admin/AdminJobDetail';
import { AdminUsersPage } from '@/pages/admin/AdminUsers';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetail';
import { AdminStatsPage } from '@/pages/admin/AdminStats';
import { AdminServicesPage } from '@/pages/admin/AdminServices';

// Protected Route
// CRITICAL: Use boolean selectors (!!user, not user) so this component
// only re-renders when auth STATUS changes (logged in → logged out),
// NOT when the user object reference changes (which happens on every
// token refresh). Re-rendering ProtectedRoute re-renders Outlet which
// can cause child components to lose state or cancel in-flight fetches.
//
// GRACE PERIOD: When the user was previously authenticated, don't
// redirect immediately on auth drop. Supabase Realtime WebSocket
// reconnection, token refresh, and background tab recovery can all
// cause transient SIGNED_OUT events. Redirecting unmounts pages,
// destroying all React state and refs — the root cause of the
// "blank page / loading forever" bug on tab switch. Instead, keep
// rendering the current page for up to 5 s. If auth recovers
// (which it almost always does), the user never notices.
// Genuine sign-outs use window.location (hard nav) so they bypass
// this entirely.
const ProtectedRoute: React.FC<{ adminOnly?: boolean }> = ({ adminOnly = false }) => {
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const wasAuthenticated = useRef(false);
  const [graceExpired, setGraceExpired] = useState(false);

  // Track that user has been authenticated at least once
  useEffect(() => {
    if (isAuthenticated) {
      wasAuthenticated.current = true;
      setGraceExpired(false);
    }
  }, [isAuthenticated]);

  // Grace period: when auth drops after being authenticated,
  // wait 5 s before redirecting to login
  useEffect(() => {
    if (!isAuthenticated && wasAuthenticated.current && !graceExpired) {
      const timer = setTimeout(() => setGraceExpired(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, graceExpired]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // User was previously authenticated — keep showing the page
    // during the grace period so components don't unmount
    if (wasAuthenticated.current && !graceExpired) {
      return <Outlet />;
    }
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

// Public Route
const PublicRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => !!s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;

  return <Outlet />;
};

// Placeholder for pages not yet built
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-zinc-500">Coming soon</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    
    // Dark mode from localStorage
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page — always accessible */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />

        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Client Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsListPage />} />
          <Route path="/jobs/new" element={<NewJobPage />} />
          <Route path="/tcu/new" element={<Navigate to="/jobs/new" replace />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/calculator" element={<PerformanceCalculatorPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/prices" element={<PricesPage />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/jobs" element={<AdminJobsPage />} />
          <Route path="/admin/jobs/:id" element={<AdminJobDetailPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/stats" element={<AdminStatsPage />} />
          <Route path="/admin/services" element={<AdminServicesPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<LandingPage />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#18181b', color: '#fff', borderRadius: '8px' },
        }}
      />
    </BrowserRouter>
  );
};

export default App;
