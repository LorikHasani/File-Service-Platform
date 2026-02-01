import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, MessageSquare, Send, FileText, Clock, User, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Textarea, statusLabels } from '@/components/ui';
import { useJob, useJobMessages, downloadFile, requestRevision } from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';

export const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { job, loading, refetch: refetchJob } = useJob(id);
  const { messages, sendMessage } = useJobMessages(id);
  const [newMessage, setNewMessage] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await sendMessage(newMessage);
    if (error) toast.error('Failed to send message');
    else setNewMessage('');
    setSending(false);
  };

  const handleRequestRevision = async () => {
    if (!revisionReason.trim() || !id) return;
    const { error } = await requestRevision(id, revisionReason);
    if (error) toast.error(error.message);
    else {
      toast.success('Revision requested');
      setShowRevisionForm(false);
      setRevisionReason('');
      await refetchJob();
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

  if (!job) {
    return (
      <Layout>
        <Card>
          <div className="text-center py-8">
            <p className="text-zinc-500">Job not found</p>
            <Link to="/jobs" className="text-red-600 hover:underline mt-2 inline-block">Back to jobs</Link>
          </div>
        </Card>
      </Layout>
    );
  }

  const originalFile = job.files?.find((f) => f.file_type === 'original');
  const modifiedFile = job.files?.find((f) => f.file_type === 'modified');

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={16} />
          Back to jobs
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{job.reference_number}</h1>
              <Badge variant={job.status}>{statusLabels[job.status]}</Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </p>
          </div>
          {job.status === 'completed' && !showRevisionForm && (
            <Button variant="outline" onClick={() => setShowRevisionForm(true)}>
              Request Revision
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Info */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <Car className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold">Vehicle Information</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-zinc-500">Brand</p>
                <p className="font-medium">{job.vehicle_brand}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Model</p>
                <p className="font-medium">{job.vehicle_model}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Year</p>
                <p className="font-medium">{job.vehicle_year}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Engine</p>
                <p className="font-medium">{job.engine_type}</p>
              </div>
              {job.engine_power_hp && (
                <div>
                  <p className="text-sm text-zinc-500">Power</p>
                  <p className="font-medium">{job.engine_power_hp} HP</p>
                </div>
              )}
              {job.ecu_type && (
                <div>
                  <p className="text-sm text-zinc-500">ECU</p>
                  <p className="font-medium">{job.ecu_type}</p>
                </div>
              )}
            </div>
            {job.client_notes && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 mb-1">Notes</p>
                <p className="text-sm">{job.client_notes}</p>
              </div>
            )}
          </Card>

          {/* Services */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Selected Services</h2>
            <div className="space-y-2">
              {job.services?.map((service) => (
                <div key={service.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <span className="font-medium">{service.service_name}</span>
                  <span className="text-zinc-500">{service.price} Credits</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{job.credits_used} Credits</span>
              </div>
            </div>
          </Card>

          {/* Revision Form */}
          {showRevisionForm && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Request Revision</h2>
              <Textarea
                placeholder="Describe why you need a revision..."
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2 mt-4">
                <Button onClick={handleRequestRevision} disabled={!revisionReason.trim()}>
                  Submit Request
                </Button>
                <Button variant="ghost" onClick={() => setShowRevisionForm(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Messages */}
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} />
                <h2 className="text-lg font-semibold">Messages</h2>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-4 space-y-4">
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
                      <p className="text-sm">{msg.message}</p>
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
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={1}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} isLoading={sending}>
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Files */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} />
              <h2 className="text-lg font-semibold">Files</h2>
            </div>
            <div className="space-y-3">
              {originalFile && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Original File</p>
                      <p className="text-xs text-zinc-500">{originalFile.original_name}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(originalFile.storage_path, originalFile.original_name)}>
                      <Download size={16} />
                    </Button>
                  </div>
                </div>
              )}
              {modifiedFile ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-green-700 dark:text-green-400">Modified File</p>
                      <p className="text-xs text-green-600 dark:text-green-500">{modifiedFile.original_name}</p>
                    </div>
                    <Button size="sm" onClick={() => handleDownload(modifiedFile.storage_path, modifiedFile.original_name)}>
                      <Download size={16} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-center">
                  <p className="text-sm text-zinc-500">Modified file not available yet</p>
                </div>
              )}
            </div>
          </Card>

          {/* Status Timeline */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} />
              <h2 className="text-lg font-semibold">Timeline</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm">Job Created</p>
                  <p className="text-xs text-zinc-500">{new Date(job.created_at).toLocaleString()}</p>
                </div>
              </div>
              {job.started_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Processing Started</p>
                    <p className="text-xs text-zinc-500">{new Date(job.started_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {job.completed_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium text-sm">Completed</p>
                    <p className="text-xs text-zinc-500">{new Date(job.completed_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
