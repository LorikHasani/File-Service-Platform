import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, Download, Upload, MessageSquare, Send, FileText, Clock, User, Car, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Textarea, Select, statusLabels } from '@/components/ui';
import { useJob, useJobMessages, downloadFile, uploadFile, updateJobStatus } from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import type { JobStatus } from '@/types/database';

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_info', label: 'Waiting for Info' },
  { value: 'completed', label: 'Completed' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'rejected', label: 'Rejected' },
];

export const AdminJobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { job, loading } = useJob(id);
  const { messages, sendMessage } = useJobMessages(id);
  
  const [newMessage, setNewMessage] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (files.length === 0 || !id) return;
      setUploading(true);
      const { error } = await uploadFile(id, files[0]!, 'modified');
      if (error) {
        toast.error('Failed to upload file');
      } else {
        toast.success('Modified file uploaded!');
      }
      setUploading(false);
    },
    accept: { 'application/octet-stream': ['.bin', '.ori', '.mod', '.ecu', '.tun'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!id) return;
    setUpdatingStatus(true);
    const { error } = await updateJobStatus(id, newStatus, adminNotes || undefined);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated!');
      if (newStatus === 'completed') {
        toast.success('Job marked as completed!');
      }
    }
    setUpdatingStatus(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await sendMessage(newMessage, false);
    if (error) toast.error('Failed to send message');
    else setNewMessage('');
    setSending(false);
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
            <Link to="/admin/jobs" className="text-red-600 hover:underline mt-2 inline-block">Back to jobs</Link>
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
        <Link to="/admin/jobs" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-4">
          <ArrowLeft size={16} />
          Back to all jobs
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold">Client Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500">Name</p>
                <p className="font-medium">{job.client?.contact_name}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Email</p>
                <p className="font-medium">{job.client?.email}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Company</p>
                <p className="font-medium">{job.client?.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Credit Balance</p>
                <p className="font-medium">{job.client?.credit_balance} Credits</p>
              </div>
            </div>
          </Card>

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
              {job.gearbox_type && (
                <div>
                  <p className="text-sm text-zinc-500">Gearbox</p>
                  <p className="font-medium">{job.gearbox_type}</p>
                </div>
              )}
              {job.fuel_type && (
                <div>
                  <p className="text-sm text-zinc-500">Fuel</p>
                  <p className="font-medium">{job.fuel_type}</p>
                </div>
              )}
            </div>
            {job.client_notes && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 mb-1">Client Notes</p>
                <p className="text-sm bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">{job.client_notes}</p>
              </div>
            )}
          </Card>

          {/* Services */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Requested Services</h2>
            <div className="space-y-2">
              {job.services?.map((service) => (
                <div key={service.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <span className="font-medium">{service.service_name}</span>
                  <span className="text-zinc-500">{service.price} Credits</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-lg">{job.credits_used} Credits</span>
              </div>
            </div>
          </Card>

          {/* Messages */}
          <Card padding="none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} />
                <h2 className="text-lg font-semibold">Messages with Client</h2>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-4">
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
                  placeholder="Type a message to client..."
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
          {/* Status Control */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Job Status</h2>
            <Select
              label="Update Status"
              options={statusOptions}
              value={job.status}
              onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
              disabled={updatingStatus}
            />
            <Textarea
              label="Admin Notes (internal)"
              placeholder="Add notes about this job..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              className="mt-4"
            />
            <Button 
              className="w-full mt-4" 
              onClick={() => handleStatusChange(job.status)}
              isLoading={updatingStatus}
            >
              Save Notes
            </Button>
          </Card>

          {/* Files */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} />
              <h2 className="text-lg font-semibold">Files</h2>
            </div>
            
            {/* Original File (from client) */}
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-500 mb-2">Original File (from client)</p>
              {originalFile ? (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{originalFile.original_name}</p>
                      <p className="text-xs text-zinc-500">{(originalFile.file_size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button size="sm" onClick={() => handleDownload(originalFile.storage_path, originalFile.original_name)}>
                      <Download size={16} />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No file uploaded by client</p>
              )}
            </div>

            {/* Modified File (upload) */}
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-2">Modified File (tuned)</p>
              {modifiedFile ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-green-700 dark:text-green-400 truncate">{modifiedFile.original_name}</p>
                      <p className="text-xs text-green-600">{(modifiedFile.file_size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check size={16} className="text-green-600" />
                    </div>
                  </div>
                </div>
              ) : null}
              
              <div
                {...getRootProps()}
                className={clsx(
                  'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all',
                  isDragActive ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-red-600'
                )}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">{modifiedFile ? 'Replace' : 'Upload'} modified file</p>
                    <p className="text-xs text-zinc-500">Drop or click</p>
                  </>
                )}
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
                onClick={() => handleStatusChange('in_progress')}
                disabled={job.status === 'in_progress'}
              >
                Start Working
              </Button>
              <Button 
                className="w-full" 
                onClick={() => handleStatusChange('completed')}
                disabled={job.status === 'completed' || !modifiedFile}
              >
                Mark Complete
              </Button>
            </div>
            {!modifiedFile && job.status !== 'completed' && (
              <p className="text-xs text-zinc-500 mt-2">Upload modified file to mark as complete</p>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} />
              <h2 className="text-lg font-semibold">Timeline</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm">Created</p>
                  <p className="text-xs text-zinc-500">{new Date(job.created_at).toLocaleString()}</p>
                </div>
              </div>
              {job.started_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Started</p>
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
