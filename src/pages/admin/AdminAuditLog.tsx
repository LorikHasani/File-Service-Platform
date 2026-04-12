import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, Shield } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Badge, Spinner, Input, Pagination, usePagination } from '@/components/ui';
import { useAdminAuditLog } from '@/hooks/useSupabase';
import { formatDistanceToNow, format } from 'date-fns';

// Human-readable labels for action codes
const ACTION_LABELS: Record<string, string> = {
  update_job_status: 'Changed job status',
  upload_modified_file: 'Uploaded modified file',
  upload_revision: 'Uploaded revision',
  refund_credits: 'Issued refund',
  adjust_credits: 'Adjusted balance',
  delete_user: 'Deleted user',
  toggle_services_active: 'Toggled service active',
  toggle_service_categories_active: 'Toggled category active',
  delete_service: 'Deleted service',
  delete_service_category: 'Deleted category',
  toggle_package_active: 'Toggled package active',
  delete_package: 'Deleted package',
};

const ACTION_BADGE_VARIANT: Record<string, 'success' | 'error' | 'pending' | 'in_progress' | 'default'> = {
  update_job_status: 'in_progress',
  upload_modified_file: 'success',
  upload_revision: 'success',
  refund_credits: 'error',
  adjust_credits: 'pending',
  delete_user: 'error',
  delete_service: 'error',
  delete_service_category: 'error',
  delete_package: 'error',
};

export const AdminAuditLogPage: React.FC = () => {
  const { entries, loading } = useAdminAuditLog(500);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const action = (ACTION_LABELS[e.action] || e.action).toLowerCase();
      const admin = e.admin?.contact_name?.toLowerCase() || '';
      const meta = JSON.stringify(e.metadata || {}).toLowerCase();
      return action.includes(q) || admin.includes(q) || meta.includes(q);
    });
  }, [entries, search]);

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    pagedItems,
  } = usePagination(filtered, 25);

  if (loading) {
    return (
      <Layout title="Audit Log">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Audit Log">
      {/* Filter bar */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              leftIcon={<Search size={16} />}
              placeholder="Search actions, admins, metadata..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="default">{filtered.length} entries</Badge>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Shield size={20} />
          <h2 className="text-lg font-semibold">Admin Activity Log</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No audit entries found</div>
        ) : (
          <div>
            <table className="w-full table-fixed">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold w-[160px]">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold w-[160px]">Admin</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold w-[180px]">Action</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold w-[120px]">Target</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pagedItems.map((entry) => {
                  const meta = entry.metadata as Record<string, unknown> | null;
                  // Build a short detail string from metadata
                  const details = meta
                    ? Object.entries(meta)
                        .filter(([, v]) => v != null && v !== '')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : '';
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-zinc-500" title={format(new Date(entry.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.admin ? (
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" title={entry.admin.contact_name}>
                              {entry.admin.contact_name}
                            </p>
                            <p className="text-xs text-zinc-500 truncate" title={entry.admin.email}>
                              {entry.admin.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ACTION_BADGE_VARIANT[entry.action] || 'default'}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {entry.target_type && entry.target_id ? (
                          entry.target_type === 'user' ? (
                            <Link
                              to={`/admin/users/${entry.target_id}`}
                              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                            >
                              {entry.target_type}
                              <ArrowUpRight size={10} />
                            </Link>
                          ) : entry.target_type === 'job' ? (
                            <Link
                              to={`/admin/jobs/${entry.target_id}`}
                              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                            >
                              {entry.target_type}
                              <ArrowUpRight size={10} />
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-500">{entry.target_type}</span>
                          )
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-sm text-zinc-500 truncate" title={details}>
                          {details || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
          />
        )}
      </Card>
    </Layout>
  );
};
