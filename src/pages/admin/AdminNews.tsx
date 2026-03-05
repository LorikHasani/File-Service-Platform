import React, { useState } from 'react';
import { Megaphone, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Badge, Spinner } from '@/components/ui';
import {
  useAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { Announcement } from '@/types/database';

const typeColors: Record<string, string> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
};

export const AdminNewsPage: React.FC = () => {
  const { announcements, loading, refetch } = useAnnouncements(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success'>('info');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setMessage('');
    setType('info');
    setIsActive(true);
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title);
    setMessage(a.message);
    setType(a.type);
    setIsActive(a.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await updateAnnouncement(editing.id, {
        title: title.trim(),
        message: message.trim(),
        type,
        is_active: isActive,
      });
      if (error) toast.error('Failed to update');
      else {
        toast.success('Announcement updated');
        setShowModal(false);
        refetch();
      }
    } else {
      const { error } = await createAnnouncement(title.trim(), message.trim(), type);
      if (error) toast.error('Failed to create');
      else {
        toast.success('Announcement created');
        setShowModal(false);
        refetch();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    setDeleting(id);
    const { error } = await deleteAnnouncement(id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Announcement deleted');
      refetch();
    }
    setDeleting(null);
  };

  const handleToggle = async (a: Announcement) => {
    const { error } = await updateAnnouncement(a.id, { is_active: !a.is_active });
    if (error) toast.error('Failed to update');
    else refetch();
  };

  const activeCount = announcements.filter((a) => a.is_active).length;

  if (loading) {
    return (
      <Layout title="News & Announcements">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="News & Announcements">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Badge variant="success">{activeCount} Active</Badge>
          <Badge variant="default">{announcements.length - activeCount} Inactive</Badge>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          New Announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No announcements</h3>
            <p className="text-zinc-500 mb-4">Create announcements that clients will see on their dashboard</p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create Announcement
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{a.title}</h3>
                    <Badge variant={typeColors[a.type] as any}>{a.type}</Badge>
                    {!a.is_active && <Badge variant="default">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{a.message}</p>
                  <p className="text-xs text-zinc-500 mt-2">
                    Created {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggle(a)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      a.is_active ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                    title={a.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        a.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deleting === a.id}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editing ? 'Edit Announcement' : 'New Announcement'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement message..." rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>
              {editing && (
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <span className="text-sm font-medium">Active</span>
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isActive ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSave} disabled={saving} isLoading={saving} className="flex-1">
                {editing ? 'Update' : 'Create'}
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
