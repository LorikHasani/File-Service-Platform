import React from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Clock, CheckCircle, CreditCard, ArrowRight, Activity, Zap, Cpu, Gauge } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, statusLabels } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useJobs } from '@/hooks/useSupabase';

export const DashboardPage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const { jobs, loading } = useJobs();

  const activeJobs = jobs.filter((j) => ['pending', 'in_progress', 'waiting_for_info'].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const recentJobs = jobs.slice(0, 5);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Welcome back, {profile?.contact_name?.split(' ')[0]}!
        </h2>
        <p className="text-zinc-500 mt-1">Here's what's happening with your tuning jobs today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Balance</p>
              <p className="text-2xl font-bold mt-1">€{profile?.credit_balance.toFixed(2)}</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <Link to="/credits" className="text-sm text-red-600 font-medium hover:underline mt-3 inline-block">
            Top up balance →
          </Link>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Active Jobs</p>
              <p className="text-2xl font-bold mt-1">{activeJobs.length}</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm text-zinc-500">
            <Clock className="w-4 h-4" />
            <span>{jobs.filter((j) => j.status === 'pending').length} pending</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Completed</p>
              <p className="text-2xl font-bold mt-1">{completedJobs.length}</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Jobs</p>
              <p className="text-2xl font-bold mt-1">{jobs.length}</p>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card padding="none" className="lg:col-span-1">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-3">
            <Link to="/jobs/new">
              <Button variant="primary" className="w-full justify-start" size="lg">
                <Gauge className="w-5 h-5" />
                <span>ECU Stage</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/tcu/new">
              <Button variant="secondary" className="w-full justify-start" size="lg">
                <Cpu className="w-5 h-5" />
                <span>TCU Stage</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/jobs">
              <Button variant="secondary" className="w-full justify-start" size="lg">
                <Activity className="w-5 h-5" />
                <span>View All Jobs</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/credits">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <CreditCard className="w-5 h-5" />
                <span>Top Up Balance</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent Jobs */}
        <Card padding="none" className="lg:col-span-2">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Jobs</h3>
            <Link to="/jobs" className="text-sm text-red-600 font-medium hover:underline">View all</Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <p>No jobs yet. Create your first tuning job!</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentJobs.map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">{job.reference_number}</p>
                      <Badge variant={job.status}>{statusLabels[job.status]}</Badge>
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5">{job.vehicle_brand} {job.vehicle_model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">{new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};
