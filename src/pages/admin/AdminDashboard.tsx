import React from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, DollarSign, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Badge, Spinner, statusLabels } from '@/components/ui';
import { useAdminStats, useAllJobs } from '@/hooks/useSupabase';

export const AdminDashboardPage: React.FC = () => {
  const { stats, loading: statsLoading } = useAdminStats();
  const { jobs, loading: jobsLoading } = useAllJobs();

  const recentJobs = jobs.slice(0, 10);
  const pendingJobs = jobs.filter((j) => j.status === 'pending');

  if (statsLoading || jobsLoading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Jobs</p>
              <p className="text-2xl font-bold mt-1">{stats.totalJobs}</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>{stats.completedToday} completed today</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Pending</p>
              <p className="text-2xl font-bold mt-1">{stats.pendingJobs}</p>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="text-sm text-zinc-500 mt-3">
            {stats.inProgressJobs} in progress
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Revenue</p>
              <p className="text-2xl font-bold mt-1">{stats.totalRevenue.toFixed(0)}</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-sm text-zinc-500 mt-3">Credits earned</div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Users</p>
              <p className="text-2xl font-bold mt-1">{stats.totalUsers}</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="text-sm text-zinc-500 mt-3">Registered clients</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Jobs Queue */}
        <Card padding="none">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Jobs</h2>
            <Link to="/admin/jobs?status=pending" className="text-sm text-red-600 font-medium hover:underline">
              View all
            </Link>
          </div>
          {pendingJobs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No pending jobs</div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingJobs.slice(0, 5).map((job) => (
                <Link key={job.id} to={`/admin/jobs/${job.id}`} className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold">{job.reference_number}</p>
                    <p className="text-sm text-zinc-500">{job.vehicle_brand} {job.vehicle_model}</p>
                    <p className="text-xs text-zinc-400">{job.client?.contact_name || job.client?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{job.credits_used} cr</p>
                    <p className="text-xs text-zinc-500">{new Date(job.created_at).toLocaleTimeString()}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Jobs */}
        <Card padding="none">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link to="/admin/jobs" className="text-sm text-red-600 font-medium hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentJobs.map((job) => (
              <Link key={job.id} to={`/admin/jobs/${job.id}`} className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm">{job.reference_number}</p>
                    <Badge variant={job.status}>{statusLabels[job.status]}</Badge>
                  </div>
                  <p className="text-sm text-zinc-500">{job.vehicle_brand} {job.vehicle_model}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
