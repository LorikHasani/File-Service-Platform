import React from 'react';
import { Users, FileText, DollarSign, Clock } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Spinner } from '@/components/ui';
import { useAdminStats, useAllJobsWithServices, useAllUsers } from '@/hooks/useSupabase';

export const AdminStatsPage: React.FC = () => {
  const { stats, loading: statsLoading } = useAdminStats();
  const { jobs, loading: jobsLoading } = useAllJobsWithServices();
  const { users, loading: usersLoading } = useAllUsers();

  if (statsLoading || jobsLoading || usersLoading) {
    return (
      <Layout title="Statistics">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  // Calculate additional stats
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const avgTurnaround = completedJobs.length > 0
    ? completedJobs.reduce((sum, j) => {
        if (j.completed_at && j.created_at) {
          return sum + (new Date(j.completed_at).getTime() - new Date(j.created_at).getTime());
        }
        return sum;
      }, 0) / completedJobs.length / (1000 * 60 * 60) // Convert to hours
    : 0;

  const revisionRate = jobs.length > 0
    ? (jobs.filter(j => j.revision_count > 0).length / jobs.length) * 100
    : 0;

  const totalCreditsInSystem = users.reduce((sum, u) => sum + (u.credit_balance || 0), 0);
  
  // Jobs by status
  const jobsByStatus = {
    pending: jobs.filter(j => j.status === 'pending').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    waiting_for_info: jobs.filter(j => j.status === 'waiting_for_info').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    revision_requested: jobs.filter(j => j.status === 'revision_requested').length,
    rejected: jobs.filter(j => j.status === 'rejected').length,
  };

  // Jobs this month
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const jobsThisMonth = jobs.filter(j => new Date(j.created_at) >= thisMonth).length;
  const revenueThisMonth = jobs
    .filter(j => new Date(j.created_at) >= thisMonth)
    .reduce((sum, j) => sum + (j.credits_used || 0), 0);

  // Top services - now properly using job.services from useAllJobsWithServices
  const serviceCount: Record<string, number> = {};
  jobs.forEach(job => {
    if (job.services) {
      job.services.forEach(service => {
        serviceCount[service.service_name] = (serviceCount[service.service_name] || 0) + 1;
      });
    }
  });
  const topServices = Object.entries(serviceCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Top clients
  const clientJobCount: Record<string, { name: string; email: string; jobs: number; spent: number }> = {};
  jobs.forEach(job => {
    const clientId = job.client?.id || job.client_id;
    if (clientId) {
      if (!clientJobCount[clientId]) {
        clientJobCount[clientId] = {
          name: job.client?.contact_name || 'Unknown',
          email: job.client?.email || '',
          jobs: 0,
          spent: 0,
        };
      }
      clientJobCount[clientId].jobs++;
      clientJobCount[clientId].spent += job.credits_used || 0;
    }
  });
  const topClients = Object.values(clientJobCount)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  return (
    <Layout title="Statistics">
      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Revenue</p>
              <p className="text-2xl font-bold mt-1">{stats.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-zinc-500">credits earned</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Jobs</p>
              <p className="text-2xl font-bold mt-1">{stats.totalJobs}</p>
              <p className="text-xs text-green-600">+{jobsThisMonth} this month</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Users</p>
              <p className="text-2xl font-bold mt-1">{stats.totalUsers}</p>
              <p className="text-xs text-zinc-500">registered clients</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Avg Turnaround</p>
              <p className="text-2xl font-bold mt-1">{avgTurnaround.toFixed(1)}h</p>
              <p className="text-xs text-zinc-500">completion time</p>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Jobs by Status */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Jobs by Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm">Pending</span>
              </div>
              <span className="font-semibold">{jobsByStatus.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">In Progress</span>
              </div>
              <span className="font-semibold">{jobsByStatus.in_progress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm">Waiting for Info</span>
              </div>
              <span className="font-semibold">{jobsByStatus.waiting_for_info}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Completed</span>
              </div>
              <span className="font-semibold">{jobsByStatus.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm">Revision Requested</span>
              </div>
              <span className="font-semibold">{jobsByStatus.revision_requested}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Rejected</span>
              </div>
              <span className="font-semibold">{jobsByStatus.rejected}</span>
            </div>
          </div>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Completion Rate</span>
                <span className="font-semibold text-green-600">
                  {jobs.length > 0 ? ((completedJobs.length / jobs.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Revision Rate</span>
                <span className="font-semibold text-orange-600">{revisionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full" 
                  style={{ width: `${revisionRate}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Credits in System</span>
                <span className="font-semibold">{totalCreditsInSystem.toFixed(0)}</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Revenue This Month</span>
                <span className="font-semibold text-green-600">{revenueThisMonth.toFixed(0)} credits</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Top Services</h2>
          {topServices.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, count], index) => (
                <div key={name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <span className="text-zinc-500">{count} jobs</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Clients */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Top Clients</h2>
          {topClients.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((client, index) => (
                <div key={client.email || index} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-zinc-500">{client.jobs} jobs</p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">{client.spent.toFixed(0)} cr</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};
