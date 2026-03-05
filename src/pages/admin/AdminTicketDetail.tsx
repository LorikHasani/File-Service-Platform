import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, User } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Textarea, Avatar } from '@/components/ui';
import { useTicket, useTicketMessages, updateTicketStatus } from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import type { TicketStatus } from '@/types/database';

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

export const AdminTicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { ticket, loading } = useTicket(id);
  const { messages, sendMessage } = useTicketMessages(id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await sendMessage(newMessage);
    if (error) toast.error('Failed to send message');
    else setNewMessage('');
    setSending(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    const { error } = await updateTicketStatus(id, newStatus as TicketStatus);
    if (error) toast.error('Failed to update status');
    else toast.success(`Ticket marked as ${statusLabels[newStatus]}`);
    setUpdatingStatus(false);
    // Reload page to reflect new status
    window.location.reload();
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

  if (!ticket) {
    return (
      <Layout>
        <Card>
          <div className="text-center py-8">
            <p className="text-zinc-500">Ticket not found</p>
            <Link to="/admin/tickets" className="text-red-600 hover:underline mt-2 inline-block">Back to tickets</Link>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin/tickets" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={16} />
          Back to tickets
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ticket.subject}</h1>
              <Badge variant={statusColors[ticket.status] as any}>
                {statusLabels[ticket.status]}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-500">Status:</label>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} />
                <h2 className="text-lg font-semibold">Conversation</h2>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No messages yet</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender_id === profile?.id
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <p className={`text-xs font-medium mb-1 ${
                        msg.sender_id === profile?.id ? 'text-red-200' : 'text-zinc-500'
                      }`}>
                        {msg.sender?.contact_name || 'Unknown'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender_id === profile?.id ? 'text-red-200' : 'text-zinc-500'}`}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type a reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!newMessage.trim() || sending} isLoading={sending}>
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Client Info Sidebar */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <User size={20} />
              <h2 className="text-lg font-semibold">Client Info</h2>
            </div>
            {ticket.client && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={ticket.client.contact_name} size="md" />
                  <div>
                    <p className="font-medium">{ticket.client.contact_name}</p>
                    <p className="text-sm text-zinc-500">{ticket.client.email}</p>
                  </div>
                </div>
                {ticket.client.company_name && (
                  <div>
                    <p className="text-sm text-zinc-500">Company</p>
                    <p className="font-medium">{ticket.client.company_name}</p>
                  </div>
                )}
                {ticket.client.phone && (
                  <div>
                    <p className="text-sm text-zinc-500">Phone</p>
                    <p className="font-medium">{ticket.client.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-500">Balance</p>
                  <p className="font-medium">€{ticket.client.credit_balance?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Joined</p>
                  <p className="font-medium">{format(new Date(ticket.client.created_at), 'dd MMM yyyy')}</p>
                </div>
                <Link
                  to={`/admin/users/${ticket.client.id}`}
                  className="block text-center text-sm text-red-600 hover:underline mt-4"
                >
                  View Full Profile
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};
