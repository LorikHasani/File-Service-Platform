import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Package,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus_credits: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export const AdminPackagesPage: React.FC = () => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CreditPackage | null>(null);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPackages(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('credit_packages')
      .update({ is_active: !current })
      .eq('id', id);

    if (error) { toast.error('Failed to update'); return; }
    toast.success(!current ? 'Package enabled' : 'Package disabled');
    fetchPackages();
  };

  const deletePackage = async (id: string, name: string) => {
    if (!confirm(`Delete package "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('credit_packages').delete().eq('id', id);
    if (error) { toast.error('Failed to delete package'); return; }
    toast.success('Package deleted');
    fetchPackages();
  };

  const activeCount = packages.filter((p) => p.is_active).length;

  if (loading) {
    return (
      <Layout title="Credit Packages">
        <div className="flex justify-center py-20"><Spinner /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Credit Packages">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Credit Packages</h1>
            <p className="text-zinc-500 mt-1">
              {packages.length} packages ({activeCount} active)
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={16} className="mr-2" />
            Add Package
          </Button>
        </div>

        {/* Packages List */}
        {packages.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-zinc-500">
              <Package size={48} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No packages yet</p>
              <p className="mt-1">Create your first credit package for customers to purchase.</p>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Name</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Credits</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Price</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Per Unit</th>
                    <th className="text-center px-4 py-3 text-zinc-500 font-medium">Order</th>
                    <th className="text-center px-4 py-3 text-zinc-500 font-medium">Active</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr
                      key={pkg.id}
                      className={clsx(
                        'border-b border-zinc-100 dark:border-zinc-800 last:border-0',
                        !pkg.is_active && 'opacity-50'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                        {pkg.name}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {pkg.credits}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        €{Number(pkg.price).toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        €{(Number(pkg.price) / Number(pkg.credits)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500">
                        {pkg.sort_order}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleActive(pkg.id, pkg.is_active)}>
                          {pkg.is_active
                            ? <ToggleRight size={20} className="text-green-500 mx-auto" />
                            : <ToggleLeft size={20} className="text-zinc-400 mx-auto" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditing(pkg); setShowModal(true); }}
                            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deletePackage(pkg.id, pkg.name)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PackageModal
          pkg={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchPackages(); }}
        />
      )}
    </Layout>
  );
};

// ─── Package Modal ──────────────────────────────────────────────────────────

const PackageModal: React.FC<{
  pkg: CreditPackage | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ pkg, onClose, onSaved }) => {
  const [name, setName] = useState(pkg?.name || '');
  const [credits, setCredits] = useState(pkg?.credits ?? 100);
  const [price, setPrice] = useState(pkg?.price ?? 100);
  const [sortOrder, setSortOrder] = useState(pkg?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (credits <= 0) { toast.error('Credits must be greater than 0'); return; }
    if (price <= 0) { toast.error('Price must be greater than 0'); return; }

    setSaving(true);

    const payload = {
      name: name.trim(),
      credits,
      price,
      bonus_credits: 0,
      sort_order: sortOrder,
    };

    try {
      if (pkg) {
        const { error } = await supabase.from('credit_packages').update(payload).eq('id', pkg.id);
        if (error) throw error;
        toast.success('Package updated');
      } else {
        const { error } = await supabase.from('credit_packages').insert(payload);
        if (error) throw error;
        toast.success('Package created');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{pkg ? 'Edit Package' : 'New Package'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Package Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Starter Pack"
          />
          <Input
            label="Credits *"
            type="number"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            placeholder="e.g. 100"
          />
          <Input
            label="Price (€) *"
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="e.g. 100"
          />

          {credits > 0 && price > 0 && (
            <div className="text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
              Price per credit: <span className="font-semibold text-zinc-900 dark:text-white">€{(price / credits).toFixed(2)}</span>
            </div>
          )}

          <Input
            label="Sort Order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : pkg ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
