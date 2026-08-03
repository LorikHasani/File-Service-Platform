import React, { useState, useEffect } from 'react';
import { Plus, X, KeyRound, Copy, Ban, Check, ExternalLink, Webhook, Play, Pause, RefreshCw } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Select, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/hooks/useSupabase';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// Partner API keys. Issuing and revoking go through /api/v1/keys (service
// role) rather than a direct table write, because only the server ever sees
// the plaintext key — the database stores nothing but its SHA-256 hash.

interface ApiKey {
  id: string;
  client_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  rate_limit_per_min: number;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
  revoked_at: string | null;
  client_email: string | null;
  client_name: string | null;
}

interface ClientOption {
  id: string;
  email: string;
  contact_name: string;
  company_name: string | null;
}

interface PartnerWebhook {
  id: string;
  client_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  consecutive_failures: number;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  client_email: string | null;
  client_name: string | null;
  pending_count: number;
  failed_count: number;
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Session expired — sign in again');

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'Request failed');
  return payload;
}

export const AdminApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);

  const fetchKeys = async () => {
    try {
      const data = await authedFetch('/api/v1/keys');
      setKeys(data.keys || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const revoke = async (key: ApiKey) => {
    if (!confirm(
      `Revoke "${key.name}"?\n\nThe partner portal using it will stop being able to send jobs immediately. This cannot be undone — you would have to issue a new key.`
    )) return;

    try {
      await authedFetch(`/api/v1/keys/${key.id}`, { method: 'DELETE' });
      toast.success('Key revoked');
      logAdminAction('revoke_api_key', 'api_key', key.id, { name: key.name });
      fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    }
  };

  const activeCount = keys.filter((k) => k.is_active).length;

  if (loading) {
    return (
      <Layout title="Partner API">
        <div className="flex justify-center py-20"><Spinner /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Partner API">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Partner API</h1>
            <p className="text-zinc-500 mt-1">
              {keys.length} keys ({activeCount} active) — each key lets a partner portal send jobs straight into your queue.
            </p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-2" />
            Issue Key
          </Button>
        </div>

        {/* Freshly created key — shown once */}
        {newKey && (
          <Card className="border-2 border-green-500">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-600/20 rounded-lg">
                <KeyRound size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-white">
                  Key for "{newKey.name}" created
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Copy it now and send it to the partner over a secure channel — it is stored hashed and can never be shown again.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-mono break-all">
                    {newKey.key}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(newKey.key);
                      toast.success('Key copied');
                    }}
                  >
                    <Copy size={14} className="mr-1.5" /> Copy
                  </Button>
                </div>
                <button
                  onClick={() => setNewKey(null)}
                  className="mt-3 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  I've saved it — hide this
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Keys */}
        {keys.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-zinc-500">
              <KeyRound size={48} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No API keys yet</p>
              <p className="mt-1 max-w-md mx-auto">
                Issue a key to a partner portal. Their jobs arrive in All Jobs like any other,
                and are paid from that partner's credit balance.
              </p>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Partner</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Key</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Req/min</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Requests</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Last used</th>
                    <th className="text-center px-4 py-3 text-zinc-500 font-medium">Status</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr
                      key={key.id}
                      className={clsx(
                        'border-b border-zinc-100 dark:border-zinc-800 last:border-0',
                        !key.is_active && 'opacity-50'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{key.name}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        <div>{key.client_name || '—'}</div>
                        <div className="text-xs text-zinc-500">{key.client_email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{key.key_prefix}…</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{key.rate_limit_per_min}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{key.request_count}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'never'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {key.is_active ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
                            <Check size={14} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                            <Ban size={14} /> Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {key.is_active && (
                            <button
                              onClick={() => revoke(key)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500"
                              title="Revoke key"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Webhooks */}
        <WebhookPanel />

        {/* Integration hint */}
        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">What the partner needs</h3>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc pl-5">
            <li>Their key, sent securely — it is shown only once, right after you issue it.</li>
            <li>The base URL <code className="font-mono text-xs">{window.location.origin}/api/v1</code></li>
            <li>Credits on their account here: every job they push is charged to that balance at their master/slave prices.</li>
            <li>The integration guide in <code className="font-mono text-xs">API.md</code> — endpoints, examples and error codes.</li>
          </ul>
          <a
            href="/admin/jobs"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Jobs from partners are marked <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">API</span> in All Jobs
            <ExternalLink size={14} />
          </a>
        </Card>
      </div>

      {showModal && (
        <IssueKeyModal
          onClose={() => setShowModal(false)}
          onIssued={(key, name) => {
            setShowModal(false);
            setNewKey({ key, name });
            fetchKeys();
          }}
        />
      )}
    </Layout>
  );
};

// ─── Webhook health ─────────────────────────────────────────────────────────
// Partners register their own callback URL through the API; this panel is for
// seeing whether delivery is actually working and switching off (or back on)
// an endpoint that misbehaves.

const WebhookPanel: React.FC = () => {
  const [webhooks, setWebhooks] = useState<PartnerWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);

  const fetchWebhooks = async () => {
    try {
      const data = await authedFetch('/api/v1/admin/webhooks');
      setWebhooks(data.webhooks || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const toggle = async (hook: PartnerWebhook) => {
    try {
      await authedFetch(`/api/v1/admin/webhooks/${hook.id}/toggle`, { method: 'POST' });
      toast.success(hook.is_active ? 'Endpoint paused' : 'Endpoint re-enabled');
      logAdminAction('toggle_partner_webhook', 'api_webhook', hook.id, { is_active: !hook.is_active });
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update endpoint');
    }
  };

  const retryNow = async () => {
    setDispatching(true);
    try {
      const result = await authedFetch('/api/v1/webhooks/dispatch', { method: 'POST' });
      toast.success(
        result.claimed === 0
          ? 'Nothing waiting to send'
          : `Sent ${result.delivered} of ${result.claimed} (${result.failed} failed)`
      );
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook size={18} className="text-zinc-500" />
          <h3 className="font-semibold text-zinc-900 dark:text-white">Webhook endpoints</h3>
        </div>
        {webhooks.length > 0 && (
          <Button variant="secondary" onClick={retryNow} disabled={dispatching}>
            <RefreshCw size={14} className={clsx('mr-1.5', dispatching && 'animate-spin')} />
            {dispatching ? 'Sending…' : 'Send pending now'}
          </Button>
        )}
      </div>

      {webhooks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No partner has registered a callback URL yet. Partners set their own with
          <code className="font-mono text-xs mx-1">POST /api/v1/webhooks</code>
          — until then they poll for updates, which works just as well.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-2 py-2 text-zinc-500 font-medium">Partner</th>
                <th className="text-left px-2 py-2 text-zinc-500 font-medium">Endpoint</th>
                <th className="text-right px-2 py-2 text-zinc-500 font-medium">Queued</th>
                <th className="text-right px-2 py-2 text-zinc-500 font-medium">Given up</th>
                <th className="text-left px-2 py-2 text-zinc-500 font-medium">Last delivery</th>
                <th className="text-center px-2 py-2 text-zinc-500 font-medium">Status</th>
                <th className="text-right px-2 py-2 text-zinc-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((hook) => (
                <tr
                  key={hook.id}
                  className={clsx(
                    'border-b border-zinc-100 dark:border-zinc-800 last:border-0',
                    !hook.is_active && 'opacity-60'
                  )}
                >
                  <td className="px-2 py-3">
                    <div className="text-zinc-900 dark:text-white">{hook.client_name || '—'}</div>
                    <div className="text-xs text-zinc-500">{hook.client_email}</div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400 max-w-[240px] truncate" title={hook.url}>
                      {hook.url}
                    </div>
                    <div className="text-[11px] text-zinc-500">{hook.events.join(', ')}</div>
                  </td>
                  <td className="px-2 py-3 text-right text-zinc-700 dark:text-zinc-300">{hook.pending_count}</td>
                  <td className={clsx('px-2 py-3 text-right', hook.failed_count > 0 ? 'text-red-500 font-semibold' : 'text-zinc-500')}>
                    {hook.failed_count}
                  </td>
                  <td className="px-2 py-3 text-zinc-500">
                    {hook.last_success_at ? new Date(hook.last_success_at).toLocaleString() : 'never'}
                    {hook.last_error && (
                      <div className="text-[11px] text-red-500 max-w-[200px] truncate" title={hook.last_error}>
                        {hook.last_error}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center">
                    {hook.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
                        <Check size={14} /> Active
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-zinc-500 text-xs font-semibold"
                        title={
                          hook.consecutive_failures >= 20
                            ? 'Switched off automatically after 20 failed deliveries in a row'
                            : 'Paused'
                        }
                      >
                        <Pause size={14} /> Paused
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => toggle(hook)}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"
                        title={hook.is_active ? 'Pause deliveries' : 'Re-enable deliveries'}
                      >
                        {hook.is_active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

// ─── Issue Key Modal ────────────────────────────────────────────────────────

const IssueKeyModal: React.FC<{
  onClose: () => void;
  onIssued: (key: string, name: string) => void;
}> = ({ onClose, onIssued }) => {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [rateLimit, setRateLimit] = useState(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, contact_name, company_name')
      .eq('role', 'client')
      .order('company_name', { nullsFirst: false })
      .then(({ data }) => setClients(data || []));
  }, []);

  const handleSave = async () => {
    if (!clientId) { toast.error('Pick the partner account'); return; }
    if (!name.trim()) { toast.error('Give the key a name'); return; }

    setSaving(true);
    try {
      const data = await authedFetch('/api/v1/keys', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          name: name.trim(),
          rate_limit_per_min: rateLimit,
        }),
      });
      logAdminAction('create_api_key', 'api_key', data.id, { name: name.trim(), client_id: clientId });
      onIssued(data.key, name.trim());
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Issue API Key</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <Select
            label="Partner account *"
            placeholder="Select the client this key belongs to"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={clients.map((c) => ({
              value: c.id,
              label: `${c.company_name || c.contact_name} — ${c.email}`,
            }))}
          />
          <p className="text-xs text-zinc-500 -mt-2">
            Jobs sent with this key are charged to this account's credit balance.
          </p>

          <Input
            label="Key name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. TuneShop production server"
          />

          <Input
            label="Rate limit (requests per minute)"
            type="number"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Issuing...' : 'Issue Key'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
