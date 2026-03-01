import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Building2,
  Phone,
  Globe,
  Calendar,
  CreditCard,
  Briefcase,
  FileText,
  Trash2,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Input, Avatar, statusLabels } from '@/components/ui';
import { useUserDetail, downloadFile } from '@/hooks/useSupabase';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow, format } from 'date-fns';
import type { TransactionType } from '@/types/database';

const transactionTypeLabels: Record<TransactionType, string> = {
  credit_purchase: 'Purchase',
  job_payment: 'Job Payment',
  refund: 'Refund',
  admin_adjustment: 'Admin Adjustment',
};

const transactionTypeBadge: Record<TransactionType, 'success' | 'error' | 'pending' | 'in_progress'> = {
  credit_purchase: 'success',
  job_payment: 'pending',
  refund: 'in_progress',
  admin_adjustment: 'in_progress',
};

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, jobs, transactions, files, loading, refetch } = useUserDetail(id);

  // Credit modal state
  const [creditModal, setCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleAddCredits = async () => {
    if (!user || !creditAmount || !creditDescription) return;

    setProcessing(true);
    const amount = parseFloat(creditAmount);

    if (isNaN(amount)) {
      toast.error('Invalid amount');
      setProcessing(false);
      return;
    }

    const { error } = await supabase.rpc('admin_add_credits', {
      p_user_id: user.id,
      p_amount: amount,
      p_description: creditDescription,
    });

    if (error) {
      toast.error('Failed to adjust balance');
    } else {
      toast.success(`${amount > 0 ? 'Added' : 'Removed'} €${Math.abs(amount)}`);
      setCreditModal(false);
      setCreditAmount('');
      setCreditDescription('');
      refetch();
    }
    setProcessing(false);
  };

  const handleDeleteUser = async () => {
    if (!user || deleteConfirmEmail !== user.email) return;

    setDeleting(true);
    try {
      const session = useAuthStore.getState().session;
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      navigate('/admin/users');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      await downloadFile(path, name);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <Card>
          <div className="text-center py-8">
            <p className="text-zinc-500">User not found</p>
            <Link to="/admin/users" className="text-red-600 hover:underline mt-2 inline-block">
              Back to users
            </Link>
          </div>
        </Card>
      </Layout>
    );
  }

  const totalSpent = transactions
    .filter((t) => t.type === 'job_payment')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={16} />
          Back to users
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.contact_name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold">{user.contact_name}</h1>
              <p className="text-zinc-500">{user.email}</p>
            </div>
          </div>
          <Badge variant={user.role === 'client' ? 'pending' : 'completed'}>{user.role}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Information */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold">User Information</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <Mail size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Email</p>
                  <p className="font-medium text-sm">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Company</p>
                  <p className="font-medium text-sm">{user.company_name || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Phone</p>
                  <p className="font-medium text-sm">{user.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Country</p>
                  <p className="font-medium text-sm">{user.country || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Joined</p>
                  <p className="font-medium text-sm">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-500">Balance</p>
                  <p className="font-medium text-sm">€{user.credit_balance?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Jobs History */}
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Briefcase size={20} />
                <h2 className="text-lg font-semibold">Jobs History</h2>
                <Badge variant="default">{jobs.length}</Badge>
              </div>
            </div>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No jobs yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Reference</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Services</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Credits</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{job.reference_number}</p>
                          <p className="text-xs text-zinc-500">
                            {job.vehicle_brand} {job.vehicle_model}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={job.status}>{statusLabels[job.status]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {job.services.slice(0, 2).map((s) => (
                              <span
                                key={s.id}
                                className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded"
                              >
                                {s.service_name}
                              </span>
                            ))}
                            {job.services.length > 2 && (
                              <span className="text-xs text-zinc-500">
                                +{job.services.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-sm">€{job.credits_used}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-500">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/jobs/${job.id}`}>
                            <Button size="sm" variant="ghost">
                              <ArrowUpRight size={14} />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Files */}
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText size={20} />
                <h2 className="text-lg font-semibold">Files</h2>
                <Badge variant="default">{files.length}</Badge>
              </div>
            </div>
            {files.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No files uploaded</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded ${
                          file.file_type === 'original'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}
                      >
                        <FileText
                          size={14}
                          className={
                            file.file_type === 'original'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-green-600 dark:text-green-400'
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{file.original_name}</p>
                        <p className="text-xs text-zinc-500">
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB &middot;{' '}
                          <span className="capitalize">{file.file_type}</span> &middot;{' '}
                          {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(file.storage_path, file.original_name)}
                    >
                      <Download size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Transaction History */}
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard size={20} />
                <h2 className="text-lg font-semibold">Transaction History</h2>
                <Badge variant="default">{transactions.length}</Badge>
              </div>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Balance</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <Badge variant={transactionTypeBadge[tx.type]}>
                            {transactionTypeLabels[tx.type]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold text-sm ${
                              tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {tx.amount > 0 ? '+' : ''}€{tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-500">
                            €{tx.balance_before.toFixed(2)} → €{tx.balance_after.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-500">{tx.description || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-500">
                            {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Summary */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Account Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Credit Balance</span>
                <span className="text-xl font-bold text-green-600">
                  €{user.credit_balance?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Total Jobs</span>
                <span className="text-xl font-bold">{jobs.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Total Spent</span>
                <span className="text-xl font-bold">€{totalSpent.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Files Uploaded</span>
                <span className="text-xl font-bold">{files.filter((f) => f.file_type === 'original').length}</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => setCreditModal(true)}
              >
                <CreditCard size={16} />
                Adjust Credits
              </Button>
              <Button
                className="w-full"
                variant="danger"
                onClick={() => setDeleteModal(true)}
              >
                <Trash2 size={16} />
                Delete User
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Adjust Balance</h2>
            <p className="text-zinc-500 mb-4">
              User:{' '}
              <span className="font-medium text-zinc-900 dark:text-white">
                {user.contact_name}
              </span>
            </p>

            <div className="space-y-4">
              <Input
                label="Amount"
                type="number"
                placeholder="Enter amount (negative to remove)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <Input
                label="Description"
                placeholder="Reason for adjustment"
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
              />

              <div className="flex gap-2">
                {[100, 250, 500, 1000].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setCreditAmount(String(amt))}
                  >
                    +{amt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setCreditModal(false);
                  setCreditAmount('');
                  setCreditDescription('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddCredits}
                disabled={!creditAmount || !creditDescription || processing}
                isLoading={processing}
              >
                {parseFloat(creditAmount || '0') >= 0 ? 'Add' : 'Remove'} €
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold">Delete User</h2>
            </div>

            <p className="text-zinc-500 mb-2">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-900 dark:text-white">
                {user.contact_name}
              </span>
              ? This action cannot be undone.
            </p>
            <p className="text-sm text-zinc-500 mb-4">
              All their jobs, files, and transaction history will be permanently deleted.
            </p>

            <Input
              label={`Type "${user.email}" to confirm`}
              placeholder={user.email}
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            />

            <div className="flex gap-2 mt-6">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteConfirmEmail('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDeleteUser}
                disabled={deleteConfirmEmail !== user.email || deleting}
                isLoading={deleting}
              >
                Delete User
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};
