import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Textarea } from '@/components/ui';
import { useTicket, useTicketMessages, notifyAdmins } from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
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

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { ticket, loading } = useTicket(id);
  const { messages, sendMessage } = useTicketMessages(id);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await sendMessage(newMessage);
    if (error) {
      toast.error('Failed to send message');
    } else {
      if (ticket && id) {
        notifyAdmins(
          'New Ticket Message',
          `${profile?.contact_name || 'Client'} replied to ticket "${ticket.subject}".`,
          'ticket',
          id
        );
      }
      setNewMessage('');
    }
    setSending(false);
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
            <Link to="/tickets" className="text-red-600 hover:underline mt-2 inline-block">Back to tickets</Link>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link to="/tickets" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={16} />
          Back to tickets
        </Link>
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

      {/* Messages */}
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
                  {msg.sender_id !== profile?.id && msg.sender && (
                    <p className={`text-xs font-medium mb-1 ${
                      msg.sender_id === profile?.id ? 'text-red-200' : 'text-zinc-500'
                    }`}>
                      {msg.sender.contact_name} (Support)
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-xs mt-1 ${msg.sender_id === profile?.id ? 'text-red-200' : 'text-zinc-500'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {ticket.status !== 'closed' && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={1}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!newMessage.trim() || sending} isLoading={sending}>
                <Send size={16} />
              </Button>
            </div>
          </div>
        )}
        {ticket.status === 'closed' && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">This ticket is closed. Create a new ticket if you need further help.</p>
          </div>
        )}
      </Card>
    </Layout>
  );
};
