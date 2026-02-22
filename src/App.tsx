import React, { useEffect } from 'react';
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

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboard';
import { AdminJobsPage } from '@/pages/admin/AdminJobs';
import { AdminJobDetailPage } from '@/pages/admin/AdminJobDetail';
import { AdminUsersPage } from '@/pages/admin/AdminUsers';
import { AdminStatsPage } from '@/pages/admin/AdminStats';
import { AdminServicesPage } from '@/pages/admin/AdminServices';

// Protected Route
// CRITICAL: Use boolean selectors (!!user, not user) so this component
// only re-renders when auth STATUS changes (logged in → logged out),
// NOT when the user object reference changes (which happens on every
// token refresh). Re-rendering ProtectedRoute re-renders Outlet which
// can cause child components to lose state or cancel in-flight fetches.
const ProtectedRoute: React.FC<{ adminOnly?: boolean }> = ({ adminOnly = false }) => {
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

  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/jobs" element={<AdminJobsPage />} />
          <Route path="/admin/jobs/:id" element={<AdminJobDetailPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
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
