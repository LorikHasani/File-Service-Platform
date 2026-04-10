import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CreditCard, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Badge, Spinner, Input } from '@/components/ui';
import { useAllTransactions } from '@/hooks/useSupabase';
import { format } from 'date-fns';
import type { TransactionType } from '@/types/database';

const transactionTypeLabels: Record<TransactionType, string> = {
  credit_purchase: 'Purchase',
  job_payment: 'Job Payment',
  refund: 'Refund',
  admin_adjustment: 'Admin Adjustment',
};

const transactionTypeBadge: Record<
  TransactionType,
  'success' | 'error' | 'pending' | 'in_progress'
> = {
  credit_purchase: 'success',
  job_payment: 'pending',
  refund: 'error',
  admin_adjustment: 'in_progress',
};

const TYPE_FILTERS: { value: 'all' | TransactionType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'credit_purchase', label: 'Purchases' },
  { value: 'job_payment', label: 'Job Payments' },
  { value: 'refund', label: 'Refunds' },
  { value: 'admin_adjustment', label: 'Admin Adjustments' },
];

export const AdminTransactionsPage: React.FC = () => {
  const { transactions, loading } = useAllTransactions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!q) return true;
      const name = tx.client?.contact_name?.toLowerCase() || '';
      const email = tx.client?.email?.toLowerCase() || '';
      const desc = tx.description?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || desc.includes(q);
    });
  }, [transactions, search, typeFilter]);

  const totals = useMemo(() => {
    let purchases = 0;
    let refunds = 0;
    let jobPayments = 0;
    let adjustments = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'credit_purchase' && amount > 0) {
        purchases += amount;
      } else if (tx.type === 'refund') {
        refunds += Math.abs(amount);
      } else if (tx.type === 'job_payment') {
        jobPayments += Math.abs(amount);
      } else if (tx.type === 'admin_adjustment') {
        adjustments += amount;
      }
    }
    return {
      purchases,
      refunds,
      jobPayments,
      adjustments,
      net: purchases - refunds,
    };
  }, [transactions]);

  if (loading) {
    return (
      <Layout title="Transactions">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Transactions">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Purchases</p>
              <p className="text-2xl font-bold mt-1">€{totals.purchases.toFixed(2)}</p>
              <p className="text-xs text-zinc-500">credits sold</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Refunds</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                -€{totals.refunds.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500">refunded to clients</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Net Revenue</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                €{totals.net.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500">purchases − refunds</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Job Payments</p>
              <p className="text-2xl font-bold mt-1">€{totals.jobPayments.toFixed(2)}</p>
              <p className="text-xs text-zinc-500">credits spent on jobs</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1">
            <Input
              leftIcon={<Search size={16} />}
              placeholder="Search by client, email or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  typeFilter === f.value
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card padding="none">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Transactions</h2>
          <Badge variant="default">{filtered.length}</Badge>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Client</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Balance</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((tx) => {
                  const amount = Number(tx.amount) || 0;
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-zinc-500">
                          {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tx.client ? (
                          <div>
                            <p className="font-medium text-sm">{tx.client.contact_name}</p>
                            <p className="text-xs text-zinc-500">{tx.client.email}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">Unknown user</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={transactionTypeBadge[tx.type]}>
                          {transactionTypeLabels[tx.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-semibold text-sm ${
                            amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {amount > 0 ? '+' : ''}€{amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-zinc-500">
                          €{Number(tx.balance_before).toFixed(2)} → €
                          {Number(tx.balance_after).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-500 line-clamp-1">
                          {tx.description || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tx.client && (
                          <Link
                            to={`/admin/users/${tx.client.id}`}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                          >
                            View user
                            <ArrowUpRight size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
};
