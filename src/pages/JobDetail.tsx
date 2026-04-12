import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, MessageSquare, Send, FileText, Clock, Car, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Textarea, statusLabels } from '@/components/ui';
import {
  useJob,
  useJobMessages,
  downloadFile,
  requestRevision,
  notifyAdmins,
  useJobRating,
  submitJobRating,
} from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';

// Inline star-picker used for submitting a new rating
const StarPicker: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-1 transition-transform hover:scale-110"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={28}
            className={clsx(
              'transition-colors',
              n <= active ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'
            )}
          />
        </button>
      ))}
    </div>
  );
};

// Read-only star row for a submitted rating
const StarRow: React.FC<{ value: number; size?: number }> = ({ value, size = 16 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}
      />
    ))}
  </div>
);

export const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const { job, loading } = useJob(id);
  const { messages, sendMessage } = useJobMessages(id);
  const { rating: existingRating, refetch: refetchRating } = useJobRating(id);
  const [newMessage, setNewMessage] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleSubmitRating = async () => {
    if (!id || ratingValue < 1) return;
    setSubmittingRating(true);
    const { error } = await submitJobRating({
      jobId: id,
      rating: ratingValue,
      comment: ratingComment.trim() || undefined,
    });
    if (error) {
      toast.error(error.message || 'Failed to submit rating');
    } else {
      toast.success('Thanks for your feedback!');
      setRatingValue(0);
      setRatingComment('');
      await refetchRating();
    }
    setSubmittingRating(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await sendMessage(newMessage);
    if (error) {
      toast.error('Failed to send message');
    } else {
      if (job) {
        notifyAdmins(
          'New Message',
          `${profile?.contact_name || 'Client'} sent a message on job ${job.reference_number}.`,
          'job',
          job.id
        );
      }
      setNewMessage('');
    }
    setSending(false);
  };

  const handleRequestRevision = async () => {
    if (!revisionReason.trim() || !id) return;
    const { error } = await requestRevision(id, revisionReason);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Revision requested');
      if (job) {
        notifyAdmins(
          'Revision Requested',
          `${profile?.contact_name || 'Client'} requested a revision for job ${job.reference_number}.`,
          'job',
          job.id
        );
      }
      setShowRevisionForm(false);
      setRevisionReason('');
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

  // Sort all files by version desc so the latest is always first.
  const allFiles = (job.files || []).slice().sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
  const originalFiles = allFiles.filter((f) => f.file_type === 'original');
  const modifiedFiles = allFiles.filter((f) => f.file_type === 'modified');
  const latestOriginal = originalFiles[0];
  const latestModified = modifiedFiles[0];

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
                  <span className="text-zinc-500">€{service.price}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">€{job.credits_used}</span>
              </div>
            </div>
          </Card>

          {/* Rating — only on completed jobs */}
          {job.status === 'completed' && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Star size={20} className="text-yellow-500" />
                <h2 className="text-lg font-semibold">
                  {existingRating ? 'Your Rating' : 'Rate this job'}
                </h2>
              </div>
              {existingRating ? (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StarRow value={existingRating.rating} size={22} />
                    <span className="text-sm text-zinc-500">
                      Submitted {formatDistanceToNow(new Date(existingRating.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {existingRating.comment && (
                    <p className="text-sm bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                      {existingRating.comment}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-zinc-500 mb-3">
                    How did we do? Your feedback helps us improve and future clients pick with confidence.
                  </p>
                  <StarPicker value={ratingValue} onChange={setRatingValue} />
                  <Textarea
                    placeholder="Share a few words about your experience (optional)"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    rows={3}
                    className="mt-3"
                  />
                  <div className="mt-3">
                    <Button
                      onClick={handleSubmitRating}
                      disabled={ratingValue < 1 || submittingRating}
                      isLoading={submittingRating}
                    >
                      Submit Rating
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

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
            <div className="space-y-4">
              {/* Original uploads (versioned) */}
              {originalFiles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Original {originalFiles.length > 1 ? `(${originalFiles.length} versions)` : ''}
                  </p>
                  <div className="space-y-2">
                    {originalFiles.map((f) => (
                      <div
                        key={f.id}
                        className={clsx(
                          'p-3 rounded-lg',
                          f.id === latestOriginal?.id
                            ? 'bg-zinc-100 dark:bg-zinc-800'
                            : 'bg-zinc-50 dark:bg-zinc-800/40 opacity-80'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                                v{f.version ?? 1}
                              </span>
                              <p className="font-medium text-sm truncate">{f.original_name}</p>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {format(new Date(f.created_at), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(f.storage_path, f.original_name)}
                          >
                            <Download size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modified files (versioned — latest highlighted in green) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Modified {modifiedFiles.length > 1 ? `(${modifiedFiles.length} versions)` : ''}
                </p>
                {modifiedFiles.length === 0 ? (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-center">
                    <p className="text-sm text-zinc-500">Modified file not available yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modifiedFiles.map((f) => {
                      const isLatest = f.id === latestModified?.id;
                      return (
                        <div
                          key={f.id}
                          className={clsx(
                            'p-3 rounded-lg border',
                            isLatest
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 border-transparent opacity-85'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    'text-xs font-semibold px-1.5 py-0.5 rounded',
                                    isLatest
                                      ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100'
                                      : 'bg-zinc-200 dark:bg-zinc-700'
                                  )}
                                >
                                  v{f.version ?? 1}
                                </span>
                                {isLatest && (
                                  <span className="text-[10px] uppercase tracking-wider font-semibold text-green-700 dark:text-green-400">
                                    Latest
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-sm truncate mt-1">{f.original_name}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {format(new Date(f.created_at), 'MMM d, yyyy HH:mm')}
                              </p>
                              {f.revision_note && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 italic">
                                  &ldquo;{f.revision_note}&rdquo;
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isLatest ? 'primary' : 'ghost'}
                              onClick={() => handleDownload(f.storage_path, f.original_name)}
                            >
                              <Download size={16} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Status Timeline — merged with revision upload history */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} />
              <h2 className="text-lg font-semibold">Timeline</h2>
            </div>
            <div className="space-y-4">
              {(() => {
                type TimelineItem = { at: string; color: string; title: string; detail?: string };
                const items: TimelineItem[] = [
                  { at: job.created_at, color: 'bg-green-500', title: 'Job Created' },
                ];
                if (job.started_at) {
                  items.push({ at: job.started_at, color: 'bg-blue-500', title: 'Processing Started' });
                }
                // Add an entry for every modified file upload (revision track)
                for (const f of modifiedFiles) {
                  const v = f.version ?? 1;
                  items.push({
                    at: f.created_at,
                    color: v === 1 ? 'bg-emerald-500' : 'bg-amber-500',
                    title: v === 1 ? 'Modified File Delivered' : `Revision v${v} Delivered`,
                    detail: f.revision_note || undefined,
                  });
                }
                if (job.completed_at) {
                  items.push({ at: job.completed_at, color: 'bg-green-500', title: 'Completed' });
                }
                items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
                return items.map((it, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className={clsx('w-2 h-2 mt-2 rounded-full flex-shrink-0', it.color)} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{it.title}</p>
                      <p className="text-xs text-zinc-500">{new Date(it.at).toLocaleString()}</p>
                      {it.detail && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 italic mt-0.5">&ldquo;{it.detail}&rdquo;</p>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
