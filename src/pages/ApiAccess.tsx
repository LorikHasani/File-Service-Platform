import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Copy, Check, Webhook, Trash2, Terminal, Ban,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Spinner, EmptyState } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// The partner's own view of their integration: which keys are live, where
// callbacks are sent, and whether recent deliveries actually arrived.
//
// Reads come straight from Supabase under RLS (a partner can only ever see
// their own rows). Registering a webhook goes through /api/v1/portal/webhooks
// instead, because the signing secret is generated server-side and the URL has
// to be validated before we ever call it.

const WEBHOOK_EVENTS = [
  { value: 'job.status_changed', label: 'Status changed', hint: 'Any status transition on your jobs' },
  { value: 'job.file_ready', label: 'File ready', hint: 'A tuned file or revision is downloadable' },
  { value: 'job.message', label: 'New message', hint: 'Our tuners wrote on one of your jobs' },
];

interface PartnerKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  rate_limit_per_min: number;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

interface PartnerWebhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  consecutive_failures: number;
  last_success_at: string | null;
  last_error: string | null;
}

interface Delivery {
  id: number;
  event: string;
  status: string;
  attempts: number;
  response_status: number | null;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

async function portalFetch(path: string, init: RequestInit = {}) {
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

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? 'Copied' : label || 'Copy'}
    </button>
  );
};

export const ApiAccessPage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const [keys, setKeys] = useState<PartnerKey[]>([]);
  const [webhook, setWebhook] = useState<PartnerWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = `${window.location.origin}/api/v1`;

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      // Explicit column lists: the hash column on api_keys and the signing
      // secret on api_webhooks are not granted to browser sessions at all, so
      // select('*') would be rejected outright.
      const [keyRes, hookRes] = await Promise.all([
        supabase
          .from('api_keys')
          .select('id, name, key_prefix, is_active, rate_limit_per_min, last_used_at, request_count, created_at')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('api_webhooks')
          .select('id, url, events, is_active, consecutive_failures, last_success_at, last_error')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      setKeys(keyRes.data || []);
      const hook = (hookRes.data || [])[0] || null;
      setWebhook(hook);

      if (hook) {
        const { data } = await supabase
          .from('api_webhook_deliveries')
          .select('id, event, status, attempts, response_status, last_error, created_at, delivered_at')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setDeliveries(data || []);
      } else {
        setDeliveries([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Layout title="API Access">
        <div className="flex justify-center py-20"><Spinner /></div>
      </Layout>
    );
  }

  const hasActiveKey = keys.some((k) => k.is_active);

  return (
    <Layout title="API Access">
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">API Access</h1>
          <p className="text-zinc-500 mt-1">
            Send jobs from your own portal straight into our queue, and get the tuned files back automatically.
          </p>
        </div>

        {/* Base URL */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-2">
                <Terminal size={15} /> Base URL
              </h3>
              <code className="block px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-mono text-sm break-all">
                {baseUrl}
              </code>
            </div>
            <CopyButton value={baseUrl} />
          </div>
        </Card>

        {/* Keys */}
        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
            <KeyRound size={17} /> Your API keys
          </h3>
          <p className="text-sm text-zinc-500 mb-4">
            Keys are issued by us and shown once, at creation. We only ever store a hash — nobody, including us,
            can read your key back. Lost it? Ask us to issue a new one.
          </p>

          {keys.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={40} />}
              title="No API key yet"
              description="Contact us and we'll issue a key for your portal. Jobs you send with it are paid from this account's credit balance."
            />
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className={clsx(
                    'flex flex-wrap items-center gap-3 p-3 rounded-lg border',
                    key.is_active
                      ? 'border-zinc-200 dark:border-zinc-700'
                      : 'border-zinc-200 dark:border-zinc-800 opacity-60'
                  )}
                >
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-medium text-zinc-900 dark:text-white">{key.name}</p>
                    <p className="font-mono text-xs text-zinc-500">{key.key_prefix}…</p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <p>{key.request_count} requests</p>
                    <p>{key.rate_limit_per_min}/min limit</p>
                  </div>
                  <div className="text-xs text-zinc-500 min-w-[140px]">
                    Last used:{' '}
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'never'}
                  </div>
                  {key.is_active ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
                      <Check size={14} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                      <Ban size={14} /> Revoked
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Webhook */}
        <WebhookCard
          webhook={webhook}
          deliveries={deliveries}
          disabled={!hasActiveKey}
          onChanged={load}
        />

        {/* Quick start */}
        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Quick start</h3>
          <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-3 list-decimal pl-5">
            <li>
              Check your key works:
              <pre className="mt-1.5 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs overflow-x-auto">
{`curl ${baseUrl}/ping \\
  -H "Authorization: Bearer YOUR_KEY"`}
              </pre>
            </li>
            <li>
              Fetch the service codes and <strong>your</strong> prices from{' '}
              <code className="font-mono text-xs">GET /services</code>.
            </li>
            <li>
              Upload a file and create the job with <code className="font-mono text-xs">POST /jobs</code>. It is charged
              to your credit balance immediately. Send your own order id as{' '}
              <code className="font-mono text-xs">external_ref</code> so retries can never double-charge you.
            </li>
            <li>
              Register a webhook below, or poll{' '}
              <code className="font-mono text-xs">GET /jobs?updated_since=…</code> for finished files.
            </li>
          </ol>
          <p className="text-sm text-zinc-500 mt-4">
            Full documentation — every endpoint, error code and a complete integration example — is in the
            API guide we sent with your key. Need another copy, a higher rate limit, or a hand integrating?
            Open a <a href="/tickets" className="text-blue-600 dark:text-blue-400 hover:underline">support ticket</a>.
          </p>
        </Card>
      </div>
    </Layout>
  );
};

// ─── Webhook card ───────────────────────────────────────────────────────────

const WebhookCard: React.FC<{
  webhook: PartnerWebhook | null;
  deliveries: Delivery[];
  disabled: boolean;
  onChanged: () => void;
}> = ({ webhook, deliveries, disabled, onChanged }) => {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(WEBHOOK_EVENTS.map((e) => e.value));
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const toggleEvent = (value: string) => {
    setEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]));
  };

  const save = async () => {
    if (!url.trim()) { toast.error('Enter your callback URL'); return; }
    if (events.length === 0) { toast.error('Pick at least one event'); return; }

    setSaving(true);
    try {
      const data = await portalFetch('/api/v1/portal/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), events }),
      });
      setNewSecret(data.secret);
      setUrl('');
      toast.success(webhook ? 'Endpoint replaced' : 'Endpoint registered');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save endpoint');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!webhook) return;
    if (!confirm('Remove this endpoint? We will stop sending callbacks and you go back to polling.')) return;
    try {
      await portalFetch(`/api/v1/portal/webhooks/${webhook.id}`, { method: 'DELETE' });
      toast.success('Endpoint removed');
      setNewSecret(null);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove endpoint');
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
        <Webhook size={17} /> Webhooks
      </h3>
      <p className="text-sm text-zinc-500 mb-4">
        Optional. Give us an HTTPS URL and we'll POST to it the moment a file is ready, instead of you polling.
      </p>

      {disabled && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          You'll need an active API key before webhooks are any use — callbacks are about jobs sent through the API.
        </div>
      )}

      {/* The secret, shown once */}
      {newSecret && (
        <div className="mb-4 p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-500/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Signing secret</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Save this now — it is shown only once. Use it to verify the{' '}
            <code className="font-mono text-xs">X-CTF-Signature</code> header on every callback, and reject
            anything that doesn't match.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 text-sm font-mono break-all">
              {newSecret}
            </code>
            <CopyButton value={newSecret} />
          </div>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-3 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            I've saved it — hide this
          </button>
        </div>
      )}

      {/* Current endpoint */}
      {webhook && (
        <div className="mb-5 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {webhook.is_active ? (
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
                    <CheckCircle2 size={14} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                    <Ban size={14} /> Disabled
                  </span>
                )}
                <span className="text-xs text-zinc-500">{webhook.events.join(', ')}</span>
              </div>
              <code className="block mt-1.5 font-mono text-sm text-zinc-700 dark:text-zinc-300 break-all">
                {webhook.url}
              </code>
              <p className="text-xs text-zinc-500 mt-1.5">
                Last successful delivery:{' '}
                {webhook.last_success_at ? new Date(webhook.last_success_at).toLocaleString() : 'never'}
              </p>
              {webhook.last_error && (
                <p className="text-xs text-red-500 mt-1">Last error: {webhook.last_error}</p>
              )}
            </div>
            <Button variant="secondary" onClick={remove}>
              <Trash2 size={14} className="mr-1.5" /> Remove
            </Button>
          </div>

          {!webhook.is_active && webhook.consecutive_failures >= 20 && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
              We switched this endpoint off after 20 failed deliveries in a row. Your jobs are unaffected —
              poll <code className="font-mono text-xs">GET /jobs</code> meanwhile. Register the endpoint again
              once your server is healthy.
            </div>
          )}
        </div>
      )}

      {/* Register / replace */}
      <div className="space-y-3">
        <Input
          label={webhook ? 'Replace endpoint' : 'Callback URL'}
          placeholder="https://your-portal.example/hooks/chiptunefiles"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="text-xs text-zinc-500 -mt-1">
          Must be public HTTPS. Saving a new URL replaces the old one and issues a fresh signing secret —
          that's also how you rotate a secret you think has leaked.
        </p>

        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Send me</p>
          <div className="space-y-2">
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event.value} className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={events.includes(event.value)}
                  onChange={() => toggleEvent(event.value)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">
                  <span className="text-zinc-900 dark:text-zinc-100">{event.label}</span>
                  <span className="text-zinc-500"> — {event.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : webhook ? 'Replace endpoint' : 'Register endpoint'}
          </Button>
        </div>
      </div>

      {/* Recent deliveries */}
      {deliveries.length > 0 && (
        <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Recent deliveries</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-2 py-2 text-zinc-500 font-medium">Event</th>
                  <th className="text-left px-2 py-2 text-zinc-500 font-medium">Sent</th>
                  <th className="text-center px-2 py-2 text-zinc-500 font-medium">Tries</th>
                  <th className="text-left px-2 py-2 text-zinc-500 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="px-2 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">{delivery.event}</td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {new Date(delivery.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-zinc-500">{delivery.attempts}</td>
                    <td className="px-2 py-2 text-xs">
                      {delivery.status === 'delivered' && (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 size={13} /> {delivery.response_status || 200}
                        </span>
                      )}
                      {delivery.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <Clock size={13} /> queued
                        </span>
                      )}
                      {delivery.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-red-500" title={delivery.last_error || ''}>
                          <AlertTriangle size={13} /> gave up
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};
