import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, DollarSign, Clock, ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { Layout } from '@/components/Layout';
import { Badge, Card, Input, Pagination, Spinner, usePagination } from '@/components/ui';
import {
  useAdminStats,
  useAllJobsWithServices,
  useAllUsers,
  useTransactionsInRange,
} from '@/hooks/useSupabase';
import { transactionTypeBadge, transactionTypeLabels } from './AdminTransactions';

const toDay = (d: Date) => format(d, 'yyyy-MM-dd');
const parseDay = (day: string) => new Date(`${day}T00:00:00`);

const dateInputClass =
  'h-10 px-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 dark:[color-scheme:dark]';

// Each preset resolves to an inclusive [from, to] pair of 'yyyy-MM-dd' days ('' = open)
const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: 'all', label: 'All time', range: () => ['', ''] },
  { key: 'today', label: 'Today', range: () => [toDay(new Date()), toDay(new Date())] },
  { key: '7d', label: 'Last 7 days', range: () => [toDay(subDays(new Date(), 6)), toDay(new Date())] },
  { key: '30d', label: 'Last 30 days', range: () => [toDay(subDays(new Date(), 29)), toDay(new Date())] },
  { key: 'month', label: 'This month', range: () => [toDay(startOfMonth(new Date())), toDay(new Date())] },
  {
    key: 'lastMonth',
    label: 'Last month',
    range: () => {
      const last = subMonths(new Date(), 1);
      return [toDay(startOfMonth(last)), toDay(endOfMonth(last))];
    },
  },
  { key: 'year', label: 'This year', range: () => [toDay(startOfYear(new Date())), toDay(new Date())] },
];

export const AdminStatsPage: React.FC = () => {
  const { stats, loading: statsLoading } = useAdminStats();
  const { jobs: allJobs, loading: jobsLoading } = useAllJobsWithServices();
  const { users, loading: usersLoading } = useAllUsers();
  const [fromDay, setFromDay] = useState('');
  const [toDayValue, setToDayValue] = useState('');
  // Single-day mode keeps from and to on the same day; range mode lets them differ
  const [rangeMode, setRangeMode] = useState(false);
  const [signFilter, setSignFilter] = useState<'all' | 'positive' | 'negative'>('all');

  // Range bounds as timestamps: from is inclusive, to is the start of the day after
  const rangeStart = fromDay ? parseDay(fromDay) : null;
  const rangeEnd = toDayValue ? addDays(parseDay(toDayValue), 1) : null;
  const { transactions: rangeTxs, loading: txLoading } = useTransactionsInRange(
    rangeStart?.toISOString() ?? null,
    rangeEnd?.toISOString() ?? null,
  );
  const filteredTxs = rangeTxs.filter((tx) => {
    const amount = Number(tx.amount) || 0;
    if (signFilter === 'positive') return amount > 0;
    if (signFilter === 'negative') return amount < 0;
    return true;
  });
  const txPager = usePagination(filteredTxs, 10);

  const setRange = (from: string, to: string) => {
    setFromDay(from);
    setToDayValue(to);
    txPager.setPage(1);
  };

  // Arrows jump a whole calendar month; from "All time" they land on the current month
  const shiftMonth = (direction: 1 | -1) => {
    const base = fromDay || toDayValue;
    const month = base ? addMonths(startOfMonth(parseDay(base)), direction) : startOfMonth(new Date());
    setRange(toDay(month), toDay(endOfMonth(month)));
    setRangeMode(true);
  };

  if (statsLoading || jobsLoading || usersLoading) {
    return (
      <Layout title="Statistics">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const isAllTime = !fromDay && !toDayValue;
  const inPeriod = (date?: string | null) => {
    if (isAllTime) return true;
    if (!date) return false;
    const d = new Date(date);
    return (!rangeStart || d >= rangeStart) && (!rangeEnd || d < rangeEnd);
  };

  const activePreset = PRESETS.find(p => {
    const [f, t] = p.range();
    return f === fromDay && t === toDayValue;
  });
  const periodLabel = activePreset?.label
    ?? (fromDay && fromDay === toDayValue ? format(parseDay(fromDay), 'd MMM yyyy') : null)
    ?? (fromDay && fromDay === toDay(startOfMonth(parseDay(fromDay)))
        && toDayValue === toDay(endOfMonth(parseDay(fromDay)))
      ? format(parseDay(fromDay), 'MMMM yyyy')
      : null)
    ?? [fromDay && format(parseDay(fromDay), 'd MMM yyyy'), toDayValue && format(parseDay(toDayValue), 'd MMM yyyy')]
      .map(v => v || '…')
      .join(' – ');

  const jobs = allJobs.filter(j => inPeriod(j.created_at));

  let grossRevenue = 0;
  let totalRefunds = 0;
  for (const tx of stats.revenueTxs) {
    if (!inPeriod(tx.created_at)) continue;
    if (tx.type === 'credit_purchase' && tx.amount > 0) grossRevenue += tx.amount;
    else if (tx.type === 'refund') totalRefunds += Math.abs(tx.amount);
  }
  const netRevenue = grossRevenue - totalRefunds;

  let positiveTotal = 0;
  let negativeTotal = 0;
  for (const tx of rangeTxs) {
    const amount = Number(tx.amount) || 0;
    if (amount > 0) positiveTotal += amount;
    else negativeTotal += amount;
  }

  const newClients = users.filter(u => u.role === 'client' && inPeriod(u.created_at)).length;

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

  const monthStart = startOfMonth(new Date());
  const jobsThisMonth = allJobs.filter(j => new Date(j.created_at) >= monthStart).length;
  const creditsUsed = jobs.reduce((sum, j) => sum + (j.credits_used || 0), 0);

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
      {/* Date filter */}
      <Card className="mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex flex-wrap gap-2 flex-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  const [f, t] = p.range();
                  setRange(f, t);
                  setRangeMode(f !== t);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  activePreset?.key === p.key
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              aria-label={rangeMode ? 'Start date' : 'Date'}
              value={fromDay}
              max={rangeMode ? toDayValue || undefined : undefined}
              onChange={(e) => setRange(e.target.value, rangeMode ? toDayValue : e.target.value)}
              className={dateInputClass}
            />
            {rangeMode && (
              <>
                <span className="text-zinc-400">–</span>
                <input
                  type="date"
                  aria-label="End date"
                  value={toDayValue}
                  min={fromDay || undefined}
                  onChange={(e) => setRange(fromDay, e.target.value)}
                  className={dateInputClass}
                />
              </>
            )}
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ChevronRight size={16} />
            </button>
            {rangeMode ? (
              <button
                onClick={() => {
                  setRangeMode(false);
                  const day = fromDay || toDayValue;
                  setRange(day, day);
                }}
                className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600 px-1"
              >
                <X size={14} />
                Single day
              </button>
            ) : (
              <button
                onClick={() => {
                  setRangeMode(true);
                  if (!fromDay) setRange(toDay(new Date()), toDay(new Date()));
                }}
                className="text-sm text-red-600 hover:underline px-1"
              >
                Start &amp; end date
              </button>
            )}
          </div>
        </div>
        {!activePreset && (
          <p className="text-xs text-zinc-500 mt-3">Showing {periodLabel}</p>
        )}
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Net Revenue</p>
              <p className="text-2xl font-bold mt-1">€{netRevenue.toFixed(0)}</p>
              <p className="text-xs text-zinc-500">
                €{grossRevenue.toFixed(0)} − €{totalRefunds.toFixed(0)} refunds
              </p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">{isAllTime ? 'Total Jobs' : 'Jobs'}</p>
              <p className="text-2xl font-bold mt-1">{isAllTime ? stats.totalJobs : jobs.length}</p>
              {isAllTime ? (
                <p className="text-xs text-green-600">+{jobsThisMonth} this month</p>
              ) : (
                <p className="text-xs text-zinc-500">{periodLabel}</p>
              )}
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">{isAllTime ? 'Total Users' : 'New Clients'}</p>
              <p className="text-2xl font-bold mt-1">{isAllTime ? stats.totalUsers : newClients}</p>
              <p className="text-xs text-zinc-500">{isAllTime ? 'registered clients' : `signed up · ${periodLabel}`}</p>
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
                <span className="text-sm text-zinc-500">Balance in System</span>
                <span className="font-semibold">€{totalCreditsInSystem.toFixed(0)}</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Credits Used on Jobs</span>
                <span className="font-semibold text-green-600">€{creditsUsed.toFixed(0)}</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Total Refunds</span>
                <span className="font-semibold text-red-600">
                  -€{totalRefunds.toFixed(0)}
                </span>
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
                  <span className="font-semibold text-green-600">€{client.spent.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Transactions in range */}
      <Card padding="none" className="mt-6">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <p className="text-xs text-zinc-500">{periodLabel}</p>
          </div>
          <Badge variant="default">{filteredTxs.length}</Badge>
        </div>
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
          {([
            { value: 'all', label: 'All', total: null },
            { value: 'positive', label: 'Positive', total: positiveTotal },
            { value: 'negative', label: 'Negative', total: negativeTotal },
          ] as const).map((f) => (
            <button
              key={f.value}
              onClick={() => { setSignFilter(f.value); txPager.setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                signFilter === f.value
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {f.label}
              {f.total !== null && (
                <span
                  className={`ml-1.5 font-semibold ${
                    signFilter === f.value ? '' : f.total > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {f.total > 0 ? '+' : f.total < 0 ? '−' : ''}€{Math.abs(f.total).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No transactions in this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Client</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {txPager.pagedItems.map((tx) => {
                  const amount = Number(tx.amount) || 0;
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500">
                        {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        {tx.client ? (
                          <Link to={`/admin/users/${tx.client.id}`} className="group block min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-red-600 inline-flex items-center gap-1">
                              {tx.client.contact_name}
                              <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100" />
                            </p>
                            <p className="text-xs text-zinc-500 truncate">{tx.client.email}</p>
                          </Link>
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
                        <span className={`font-semibold text-sm ${amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {amount > 0 ? '+' : ''}€{amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="block text-sm text-zinc-500 truncate" title={tx.description || ''}>
                          {tx.description || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!txLoading && txPager.totalPages > 1 && (
          <Pagination
            page={txPager.page}
            totalPages={txPager.totalPages}
            totalItems={txPager.totalItems}
            rangeStart={txPager.rangeStart}
            rangeEnd={txPager.rangeEnd}
            onPageChange={txPager.setPage}
          />
        )}
      </Card>
    </Layout>
  );
};
