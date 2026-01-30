import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, FileText, Clock } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Badge, EmptyState, Spinner, statusLabels } from '@/components/ui';
import { useJobs } from '@/hooks/useSupabase';
import { clsx } from 'clsx';
import type { JobStatus } from '@/types/database';

const statusFilters: Array<{ value: JobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'revision_requested', label: 'Revision' },
];

export const JobsListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const { jobs, loading } = useJobs();

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = search === '' ||
      job.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      job.vehicle_brand.toLowerCase().includes(search.toLowerCase()) ||
      job.vehicle_model.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Layout title="My Jobs">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Jobs">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by reference, brand, model..."
            leftIcon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                statusFilter === filter.value
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={32} />}
            title="No jobs found"
            description={search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first tuning job'}
            action={<Link to="/jobs/new"><Button>Create New Job</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`}>
              <Card hover padding="none" className="overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center">
                  <div className={clsx(
                    'w-full lg:w-1.5 h-1.5 lg:h-auto lg:self-stretch',
                    job.status === 'completed' && 'bg-green-500',
                    job.status === 'in_progress' && 'bg-blue-500',
                    job.status === 'pending' && 'bg-yellow-500',
                    job.status === 'waiting_for_info' && 'bg-orange-500',
                    job.status === 'revision_requested' && 'bg-purple-500',
                    job.status === 'rejected' && 'bg-red-500'
                  )} />

                  <div className="flex-1 p-4 lg:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm font-semibold">{job.reference_number}</span>
                          <Badge variant={job.status}>{statusLabels[job.status]}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold">{job.vehicle_brand} {job.vehicle_model}</h3>
                        <p className="text-sm text-zinc-500">
                          {job.vehicle_year} • {job.engine_type} {job.engine_power_hp && `• ${job.engine_power_hp} HP`}
                        </p>
                      </div>

                      <div className="flex items-center gap-6 lg:flex-col lg:items-end lg:gap-1">
                        <div className="flex items-center gap-1 text-sm text-zinc-500">
                          <Clock size={14} />
                          <span>{new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className="font-semibold">{job.credits_used} cr</span>
                      </div>

                      <ArrowRight className="hidden lg:block w-5 h-5 text-zinc-400" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
};
