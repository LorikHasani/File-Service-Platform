import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Input, Badge, Spinner, Avatar, Pagination, usePagination } from '@/components/ui';
import { useTickets } from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import type { TicketWithClient } from '@/types/database';

const statusColors: Record<string, string> = {
  open: 'warning',
  in_progress: 'info',
  closed: 'success',
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};

export const AdminTicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const { tickets, loading } = useTickets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const typedTickets = tickets as TicketWithClient[];

  const filteredTickets = typedTickets.filter((ticket) => {
    const matchesSearch = search === '' ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client?.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    pagedItems: pageTickets,
  } = usePagination(filteredTickets, 25);

  const openCount = typedTickets.filter((t) => t.status === 'open').length;
  const inProgressCount = typedTickets.filter((t) => t.status === 'in_progress').length;
  const closedCount = typedTickets.filter((t) => t.status === 'closed').length;

  if (loading) {
    return (
      <Layout title="Support Tickets">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Support Tickets">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-2xl font-bold">{typedTickets.length}</p>
          <p className="text-sm text-zinc-500">Total</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">{openCount}</p>
          <p className="text-sm text-zinc-500">Open</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
          <p className="text-sm text-zinc-500">In Progress</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">{closedCount}</p>
          <p className="text-sm text-zinc-500">Closed</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <Input
            placeholder="Search by subject, client name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Tickets Table */}
      {filteredTickets.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500">No tickets found</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium">Created</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={ticket.client?.contact_name || 'Unknown'} size="sm" />
                        <div>
                          <p className="font-medium">{ticket.client?.contact_name || 'Unknown'}</p>
                          <p className="text-xs text-zinc-500">{ticket.client?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-white max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColors[ticket.status] as any}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      )}
    </Layout>
  );
};
