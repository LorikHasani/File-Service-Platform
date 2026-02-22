import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, GripVertical, Tag,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  selection_type: string;
  created_at: string;
}

interface Service {
  id: string;
  category_id: string | null;
  code: string;
  name: string;
  description: string | null;
  base_price: number;
  estimated_hours: number;
  sort_order: number;
  is_active: boolean;
  icon: string | null;
  created_at: string;
}

type CategoryWithServices = ServiceCategory & { services: Service[] };

// ─── Main Page ───────────────────────────────────────────────────────────────

export const AdminServicesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Modal states
  const [showCatModal, setShowCatModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [preselectedCatId, setPreselectedCatId] = useState<string>('');

  const fetchAll = async () => {
    try {
      const [{ data: cats }, { data: svcs }] = await Promise.all([
        supabase.from('service_categories').select('*').order('sort_order'),
        supabase.from('services').select('*').order('sort_order'),
      ]);

      const merged: CategoryWithServices[] = (cats || []).map((cat) => ({
        ...cat,
        services: (svcs || []).filter((s) => s.category_id === cat.id),
      }));

      // Also add "Uncategorized" for services without category
      const uncategorized = (svcs || []).filter((s) => !s.category_id);
      if (uncategorized.length > 0) {
        merged.push({
          id: '__uncategorized__',
          name: 'Uncategorized',
          description: null,
          sort_order: 9999,
          is_active: true,
          created_at: '',
          services: uncategorized,
        });
      }

      setCategories(merged);
      // Expand all by default
      setExpandedCats(new Set(merged.map((c) => c.id)));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleActive = async (table: 'service_categories' | 'services', id: string, current: boolean) => {
    const { error } = await supabase.from(table).update({ is_active: !current }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(!current ? 'Enabled' : 'Disabled');
    fetchAll();
  };

  const deleteService = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) { toast.error('Failed to delete service'); return; }
    toast.success('Service deleted');
    fetchAll();
  };

  const deleteCategory = async (id: string, name: string, serviceCount: number) => {
    if (serviceCount > 0) {
      toast.error(`Can't delete "${name}" — it has ${serviceCount} services. Delete or move them first.`);
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    const { error } = await supabase.from('service_categories').delete().eq('id', id);
    if (error) { toast.error('Failed to delete category'); return; }
    toast.success('Category deleted');
    fetchAll();
  };

  // Stats
  const totalServices = categories.reduce((sum, c) => sum + c.services.length, 0);
  const activeServices = categories.reduce((sum, c) => sum + c.services.filter((s) => s.is_active).length, 0);

  if (loading) {
    return (
      <Layout title="Services Management">
        <div className="flex justify-center py-20"><Spinner /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Services Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Services & Pricing</h1>
            <p className="text-zinc-500 mt-1">
              {totalServices} services ({activeServices} active) across {categories.filter((c) => c.id !== '__uncategorized__').length} categories
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setEditingCat(null); setShowCatModal(true); }}
            >
              <Plus size={16} className="mr-2" />
              Add Category
            </Button>
            <Button
              onClick={() => { setEditingService(null); setPreselectedCatId(''); setShowServiceModal(true); }}
            >
              <Plus size={16} className="mr-2" />
              Add Service
            </Button>
          </div>
        </div>

        {/* Categories & Services */}
        {categories.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-zinc-500">
              <Tag size={48} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No services yet</p>
              <p className="mt-1">Create a category first, then add services with pricing.</p>
            </div>
          </Card>
        ) : (
          categories.map((cat) => (
            <Card key={cat.id} className={clsx(!cat.is_active && cat.id !== '__uncategorized__' && 'opacity-60')}>
              {/* Category Header */}
              <div className="flex items-center gap-3">
                <button onClick={() => toggleCat(cat.id)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                  {expandedCats.has(cat.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{cat.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {cat.services.length} services
                    </span>
                    {!cat.is_active && cat.id !== '__uncategorized__' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
                        Disabled
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-sm text-zinc-500 mt-0.5">{cat.description}</p>
                  )}
                </div>

                {cat.id !== '__uncategorized__' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive('service_categories', cat.id, cat.is_active)}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                      title={cat.is_active ? 'Disable category' : 'Enable category'}
                    >
                      {cat.is_active
                        ? <ToggleRight size={20} className="text-green-500" />
                        : <ToggleLeft size={20} className="text-zinc-400" />}
                    </button>
                    <button
                      onClick={() => { setEditingCat(cat); setShowCatModal(true); }}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id, cat.name, cat.services.length)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => { setEditingService(null); setPreselectedCatId(cat.id); setShowServiceModal(true); }}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-blue-500"
                      title="Add service to this category"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Services List */}
              {expandedCats.has(cat.id) && (
                <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  {cat.services.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-4">No services in this category</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Table header */}
                      <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-medium text-zinc-500 uppercase px-3 pb-2">
                        <div className="col-span-3">Service</div>
                        <div className="col-span-3">Description</div>
                        <div className="col-span-1">Code</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Hours</div>
                        <div className="col-span-1 text-center">Active</div>
                        <div className="col-span-2 text-right">Actions</div>
                      </div>

                      {cat.services.map((svc) => (
                        <div
                          key={svc.id}
                          className={clsx(
                            'grid grid-cols-1 sm:grid-cols-12 gap-3 items-center px-3 py-3 rounded-lg',
                            'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
                            !svc.is_active && 'opacity-50'
                          )}
                        >
                          <div className="col-span-3 font-medium">{svc.name}</div>
                          <div className="col-span-3 text-sm text-zinc-500 truncate">{svc.description || '—'}</div>
                          <div className="col-span-1">
                            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{svc.code}</code>
                          </div>
                          <div className="col-span-1 text-right font-semibold text-green-600">
                            {svc.base_price} cr
                          </div>
                          <div className="col-span-1 text-right text-sm text-zinc-500">
                            {svc.estimated_hours}h
                          </div>
                          <div className="col-span-1 text-center">
                            <button onClick={() => toggleActive('services', svc.id, svc.is_active)}>
                              {svc.is_active
                                ? <ToggleRight size={18} className="text-green-500" />
                                : <ToggleLeft size={18} className="text-zinc-400" />}
                            </button>
                          </div>
                          <div className="col-span-2 flex justify-end gap-1">
                            <button
                              onClick={() => { setEditingService(svc); setShowServiceModal(true); }}
                              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteService(svc.id, svc.name)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Category Modal */}
      {showCatModal && (
        <CategoryModal
          category={editingCat}
          onClose={() => setShowCatModal(false)}
          onSaved={() => { setShowCatModal(false); fetchAll(); }}
        />
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <ServiceModal
          service={editingService}
          categories={categories.filter((c) => c.id !== '__uncategorized__')}
          preselectedCatId={preselectedCatId}
          onClose={() => setShowServiceModal(false)}
          onSaved={() => { setShowServiceModal(false); fetchAll(); }}
        />
      )}
    </Layout>
  );
};

// ─── Category Modal ──────────────────────────────────────────────────────────

const CategoryModal: React.FC<{
  category: ServiceCategory | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ category, onClose, onSaved }) => {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [selectionType, setSelectionType] = useState(category?.selection_type || 'multi');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sort_order: sortOrder,
        selection_type: selectionType,
      };
      if (category) {
        const { error } = await supabase.from('service_categories').update(payload).eq('id', category.id);
        if (error) throw error;
        toast.success('Category updated');
      } else {
        const { error } = await supabase.from('service_categories').insert(payload);
        if (error) throw error;
        toast.success('Category created');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={category ? 'Edit Category' : 'New Category'}>
      <div className="space-y-4">
        <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuning Stage" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        <div>
          <label className="block text-sm font-medium mb-1.5">Selection Type *</label>
          <select
            value={selectionType}
            onChange={(e) => setSelectionType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="single">Single Select (pick one — e.g. Tuning Stage)</option>
            <option value="multi">Multi Select (pick many — e.g. Additional Options)</option>
          </select>
          <p className="text-xs text-zinc-500 mt-1">Single = large cards, client picks one. Multi = grid cards, client picks many.</p>
        </div>
        <Input label="Sort Order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : category ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
};

// ─── Service Modal ───────────────────────────────────────────────────────────

const ServiceModal: React.FC<{
  service: Service | null;
  categories: ServiceCategory[];
  preselectedCatId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ service, categories, preselectedCatId, onClose, onSaved }) => {
  const [name, setName] = useState(service?.name || '');
  const [code, setCode] = useState(service?.code || '');
  const [description, setDescription] = useState(service?.description || '');
  const [basePrice, setBasePrice] = useState(service?.base_price ?? 100);
  const [estimatedHours, setEstimatedHours] = useState(service?.estimated_hours ?? 1);
  const [categoryId, setCategoryId] = useState(service?.category_id || preselectedCatId || '');
  const [sortOrder, setSortOrder] = useState(service?.sort_order ?? 0);
  const [icon, setIcon] = useState(service?.icon || '');
  const [saving, setSaving] = useState(false);

  // Auto-generate code from name
  useEffect(() => {
    if (!service && name) {
      setCode(name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }, [name, service]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!code.trim()) { toast.error('Code is required'); return; }
    if (!categoryId) { toast.error('Category is required'); return; }
    if (basePrice < 0) { toast.error('Price must be >= 0'); return; }

    setSaving(true);

    const payload = {
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || null,
      base_price: basePrice,
      estimated_hours: estimatedHours,
      category_id: categoryId,
      sort_order: sortOrder,
      icon: icon.trim() || null,
    };

    try {
      if (service) {
        const { error } = await supabase.from('services').update(payload).eq('id', service.id);
        if (error) throw error;
        toast.success('Service updated');
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
        toast.success('Service created');
      }
      onSaved();
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        toast.error('Service code already exists');
      } else {
        toast.error(err.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={service ? 'Edit Service' : 'New Service'} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Service Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stage 1 Tune" />
        <Input label="Code *" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. stage1" />

        <div className="md:col-span-2">
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this service include?" rows={2} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <Input
          label="Price (credits) *"
          type="number"
          value={basePrice}
          onChange={(e) => setBasePrice(Number(e.target.value))}
          placeholder="e.g. 150"
        />

        <Input
          label="Estimated Hours"
          type="number"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(Number(e.target.value))}
          step="0.5"
        />

        <Input
          label="Sort Order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />

        <Input
          label="Icon (optional)"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="e.g. zap, rocket, settings"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </ModalWrapper>
  );
};

// ─── Modal Wrapper ───────────────────────────────────────────────────────────

const ModalWrapper: React.FC<{
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ onClose, title, wide, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-black/50" onClick={onClose} />
    <div className={clsx(
      'relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full',
      wide ? 'max-w-2xl' : 'max-w-md'
    )}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);
