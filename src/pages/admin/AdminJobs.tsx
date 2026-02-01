import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, Clock, Download, Filter } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Badge, Spinner, Select, statusLabels } from '@/components/ui';
import { useAllJobs, updateJobStatus } from '@/hooks/useSupabase';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import type { JobStatus } from '@/types/database';

const statusFilters: Array<{ value: JobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Jobs' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_info', label: 'Waiting for Info' },
  { value: 'completed', label: 'Completed' },
  { value: 'revision_requested', label: 'Revision' },
  { value: 'rejected', label: 'Rejected' },
];

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_info', label: 'Waiting for Info' },
  { value: 'completed', label: 'Completed' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'rejected', label: 'Rejected' },
];

export const AdminJobsPage: React.FC = () => {
  const { jobs, loading, error } = useAllJobs();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [updatingJob, setUpdatingJob] = useState<string | null>(null);

  // Debug log
  console.log('AdminJobsPage render:', { jobs: jobs.length, loading, error });

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = search === '' ||
      job.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      job.vehicle_brand.toLowerCase().includes(search.toLowerCase()) ||
      job.vehicle_model.toLowerCase().includes(search.toLowerCase()) ||
      job.client?.email?.toLowerCase().includes(search.toLowerCase()) ||
      job.client?.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    setUpdatingJob(jobId);
    const { error } = await updateJobStatus(jobId, newStatus);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
    }
    setUpdatingJob(null);
  };

  if (loading) {
    return (
      <Layout title="All Jobs">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="All Jobs">
        <Card>
          <div className="text-center py-8">
            <p className="text-red-500 font-semibold">Error loading jobs</p>
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
            <p className="text-xs text-zinc-400 mt-4">Check browser console (F12) for details</p>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="All Jobs">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">{jobs.filter(j => j.status === 'pending').length}</p>
          <p className="text-sm text-zinc-500">Pending</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.status === 'in_progress').length}</p>
          <p className="text-sm text-zinc-500">In Progress</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">{jobs.filter(j => j.status === 'revision_requested').length}</p>
          <p className="text-sm text-zinc-500">Revisions</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">{jobs.filter(j => j.status === 'completed').length}</p>
          <p className="text-sm text-zinc-500">Completed</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by ref, vehicle, client..."
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

      {/* Jobs Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold">Reference</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Client</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Vehicle</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Credits</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/jobs/${job.id}`} className="font-mono text-sm font-semibold text-red-600 hover:underline">
                      {job.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{job.client?.contact_name}</p>
                      <p className="text-xs text-zinc-500">{job.client?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{job.vehicle_brand} {job.vehicle_model}</p>
                    <p className="text-xs text-zinc-500">{job.vehicle_year} • {job.engine_type}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{job.credits_used}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                      disabled={updatingJob === job.id}
                      className={clsx(
                        'text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer',
                        job.status === 'pending' && 'bg-yellow-100 text-yellow-800',
                        job.status === 'in_progress' && 'bg-blue-100 text-blue-800',
                        job.status === 'completed' && 'bg-green-100 text-green-800',
                        job.status === 'waiting_for_info' && 'bg-orange-100 text-orange-800',
                        job.status === 'revision_requested' && 'bg-purple-100 text-purple-800',
                        job.status === 'rejected' && 'bg-red-100 text-red-800',
                      )}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-zinc-500">
                      <Clock size={14} />
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/jobs/${job.id}`}>
                      <Button size="sm" variant="ghost">
                        View <ArrowRight size={14} />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredJobs.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No jobs found
          </div>
        )}
      </Card>
    </Layout>
  );
};
