import React, { useState } from 'react';
import { Search, Mail, Send, CheckSquare, Square, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Spinner, Avatar, Badge } from '@/components/ui';
import { useAllUsers } from '@/hooks/useSupabase';
import { sendAdminEmail } from '@/lib/emails';
import toast from 'react-hot-toast';

export const AdminEmailsPage: React.FC = () => {
  const { users, loading } = useAllUsers();
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [emailColor, setEmailColor] = useState<'blue' | 'red'>('blue');

  const clients = users.filter((u) => u.role === 'client');
  const filteredClients = clients.filter((user) =>
    search === '' ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEmail = (email: string) => {
    const next = new Set(selectedEmails);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setSelectedEmails(next);
  };

  const toggleAll = () => {
    if (selectedEmails.size === filteredClients.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredClients.map((c) => c.email)));
    }
  };

  const handleSend = async () => {
    if (selectedEmails.size === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }

    setSending(true);
    try {
      const result = await sendAdminEmail(
        Array.from(selectedEmails),
        subject.trim(),
        body.trim(),
        emailColor
      );
      toast.success(`Email sent to ${result.sent} client(s)`);
      if (result.failed && result.failed > 0) {
        toast.error(`Failed for ${result.failed} recipient(s)`);
      }
      setSubject('');
      setBody('');
      setSelectedEmails(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Send Email">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Send Email">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Client Selection */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={20} />
                <h2 className="text-lg font-semibold">Select Recipients</h2>
              </div>
              {selectedEmails.size > 0 && (
                <Badge variant="error">{selectedEmails.size} selected</Badge>
              )}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="mb-3">
              <button
                onClick={toggleAll}
                className="text-sm text-red-600 hover:underline flex items-center gap-1"
              >
                {selectedEmails.size === filteredClients.length ? (
                  <>
                    <CheckSquare size={14} />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square size={14} />
                    Select All ({filteredClients.length})
                  </>
                )}
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => toggleEmail(client.email)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedEmails.has(client.email)
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedEmails.has(client.email)
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {selectedEmails.has(client.email) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <Avatar name={client.contact_name} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.contact_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{client.email}</p>
                  </div>
                  {client.company_name && (
                    <span className="text-xs text-zinc-400 ml-auto hidden sm:block">{client.company_name}</span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Compose Email */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Mail size={20} />
              <h2 className="text-lg font-semibold">Compose Email</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  To
                </label>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                  {selectedEmails.size === 0 ? (
                    <span className="text-zinc-400">No recipients selected</span>
                  ) : (
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {selectedEmails.size} recipient{selectedEmails.size > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Message
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message here..."
                  rows={10}
                />
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Email Color Theme
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEmailColor('blue')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      emailColor === 'blue'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-blue-600" />
                    <span className="text-sm font-medium">Blue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailColor('red')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      emailColor === 'red'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-red-600" />
                    <span className="text-sm font-medium">Red</span>
                  </button>
                </div>
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || selectedEmails.size === 0 || !subject.trim() || !body.trim()}
                isLoading={sending}
                className="w-full"
              >
                <Send size={16} />
                Send to {selectedEmails.size} Client{selectedEmails.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
