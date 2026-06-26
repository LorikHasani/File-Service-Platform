import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Plus, X, Pencil, Trash2, ImagePlus, Trash, ExternalLink } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Spinner } from '@/components/ui';
import {
  usePromoBanners,
  createPromoBanner,
  updatePromoBanner,
  deletePromoBanner,
} from '@/hooks/useSupabase';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { PromoBanner } from '@/types/database';

// Common internal destinations the admin can point a banner at.
const LINK_PRESETS: { label: string; value: string }[] = [
  { label: 'Top Up Balance', value: '/credits' },
  { label: 'Upload File (new job)', value: '/jobs/new' },
  { label: 'Prices', value: '/prices' },
  { label: 'My Jobs', value: '/jobs' },
];

export const AdminBannersPage: React.FC = () => {
  const { banners, loading, refetch } = usePromoBanners(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoBanner | null>(null);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setLinkUrl('');
    setImageUrl(null);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (b: PromoBanner) => {
    setEditing(b);
    setTitle(b.title || '');
    setLinkUrl(b.link_url || '');
    setImageUrl(b.image_url);
    setImageFile(null);
    setImagePreview(b.image_url);
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl; // Keep existing URL if no new file

    setUploading(true);
    try {
      const ext = imageFile.name.split('.').pop();
      const path = `banners/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('ecu-files')
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signError } = await supabase.storage
        .from('ecu-files')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

      if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to get signed URL');

      return signedData.signedUrl;
    } catch (err: any) {
      toast.error('Failed to upload image');
      console.error('Banner image upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    // A banner needs an image.
    let finalImageUrl = imageUrl;
    if (imageFile) {
      finalImageUrl = await uploadImage();
    }
    if (!finalImageUrl) {
      toast.error('Please upload a banner image');
      setSaving(false);
      return;
    }

    const trimmedLink = linkUrl.trim();

    if (editing) {
      const { error } = await updatePromoBanner(editing.id, {
        title: title.trim() || null,
        image_url: finalImageUrl,
        link_url: trimmedLink || null,
      });
      if (error) toast.error('Failed to update');
      else {
        toast.success('Banner updated');
        setShowModal(false);
        refetch();
      }
    } else {
      const { error } = await createPromoBanner({
        imageUrl: finalImageUrl,
        title: title.trim() || null,
        linkUrl: trimmedLink || null,
      });
      if (error) toast.error('Failed to create');
      else {
        toast.success('Banner created');
        setShowModal(false);
        refetch();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    setDeleting(id);
    const { error } = await deletePromoBanner(id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Banner deleted');
      refetch();
    }
    setDeleting(null);
  };

  const handleToggle = async (b: PromoBanner) => {
    const { error } = await updatePromoBanner(b.id, { is_active: !b.is_active });
    if (error) toast.error('Failed to update');
    else refetch();
  };

  const activeCount = banners.filter((b) => b.is_active).length;

  if (loading) {
    return (
      <Layout title="Dashboard Banners">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Banners">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-zinc-500">
          {activeCount} active · shown at the top of every client's dashboard
        </p>
        <Button onClick={openCreate}>
          <Plus size={16} />
          New Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No banners yet</h3>
            <p className="text-zinc-500 mb-4">
              Upload a banner image to promote offers (e.g. credit deals) on the client dashboard.
            </p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create Banner
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {banners.map((b) => (
            <Card key={b.id} padding="none" className={!b.is_active ? 'opacity-60 overflow-hidden' : 'overflow-hidden'}>
              <img src={b.image_url} alt={b.title || ''} className="w-full h-auto block" />
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{b.title || 'Untitled banner'}</h3>
                  {b.link_url ? (
                    <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                      <ExternalLink size={13} className="flex-shrink-0" />
                      <span className="truncate">{b.link_url}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400 mt-0.5">No link (display only)</p>
                  )}
                  <p className="text-xs text-zinc-500 mt-1">
                    Created {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(b)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      b.is_active ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                    title={b.is_active ? 'Active — click to hide' : 'Hidden — click to show'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        b.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(b)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deleting === b.id}
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editing ? 'Edit Banner' : 'New Banner'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Banner image
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-auto block rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg"
                      title="Remove image"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[16/5] border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors text-zinc-500"
                  >
                    <ImagePlus size={24} />
                    <span className="text-sm">Click to upload banner image</span>
                    <span className="text-xs text-zinc-400">Wide image works best · PNG, JPG up to 5MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Title <span className="text-zinc-400 font-normal">(optional, internal label)</span>
                </label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer credit offer" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Link <span className="text-zinc-400 font-normal">(optional — where the banner goes when clicked)</span>
                </label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/credits or https://..."
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {LINK_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setLinkUrl(preset.value)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        linkUrl === preset.value
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {linkUrl && (
                    <button
                      type="button"
                      onClick={() => setLinkUrl('')}
                      className="px-2.5 py-1 text-xs rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-zinc-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSave} disabled={saving || uploading} isLoading={saving || uploading} className="flex-1">
                {uploading ? 'Uploading...' : editing ? 'Update' : 'Create'}
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
