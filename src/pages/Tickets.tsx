import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, X } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Input, Textarea } from '@/components/ui';
import { useTickets, createTicket } from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

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

export const TicketsPage: React.FC = () => {
  const { tickets, loading, refetch } = useTickets();
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }
    setCreating(true);
    const { error } = await createTicket(subject.trim(), message.trim());
    if (error) {
      toast.error('Failed to create ticket');
    } else {
      toast.success('Ticket created');
      setShowModal(false);
      setSubject('');
      setMessage('');
      refetch();
    }
    setCreating(false);
  };

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
      <div className="flex items-center justify-between mb-6">
        <p className="text-zinc-500">Get help or report an issue</p>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
            <p className="text-zinc-500 mb-4">Create a ticket to get help from our team</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Create Ticket
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} to={`/tickets/${ticket.id}`}>
              <Card className="hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare size={20} className="text-zinc-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{ticket.subject}</h3>
                      <p className="text-sm text-zinc-500">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusColors[ticket.status] as any}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Support Ticket</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Message
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  rows={5}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleCreate} disabled={creating} isLoading={creating} className="flex-1">
                Create Ticket
              </Button>
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
