// ============================================================================
// Partner API v1 — server-to-server job intake for other tuning portals.
//
// A partner portal authenticates with an API key (ctf_live_…), pushes its
// customers' files here, and polls for the finished file. Jobs land in the
// normal admin queue and are paid from the partner's credit balance using the
// same master/slave pricing as the web upload flow.
//
// The whole surface lives in this one serverless function. Public paths are
// /api/v1/*, mapped here by a rewrite in vercel.json which passes the rest of
// the path as ?route= (see the handler for why it isn't a nested catch-all
// file). Routes:
//
//   GET    /                             API index
//   GET    /ping                         key check
//   GET    /account                      partner profile + credit balance
//   GET    /services                     catalog with the partner's prices
//   POST   /uploads                      signed URL for files > ~3 MB
//   POST   /jobs                         create + pay for a job
//   GET    /jobs                         list / poll (updated_since, status…)
//   GET    /jobs/:id                     one job with services and files
//   GET    /jobs/:id/files/:fileId/download   short-lived download URL
//   GET    /jobs/:id/messages            job chat
//   POST   /jobs/:id/messages            write to job chat
//   POST   /jobs/:id/revision            request a revision on a delivered file
//
// Key management (admin only, authenticated with a Supabase session token —
// used by /admin/api-keys in the portal, not by partners):
//   GET    /keys, POST /keys, DELETE /keys/:id
//
// See API.md for the partner-facing documentation.
// ============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import webpush from 'web-push';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.SITE_URL || 'https://chiptunefiles.com';
const BRAND_NAME = process.env.BRAND_NAME || 'ChipTuneFiles';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || `${BRAND_NAME} <onboarding@resend.dev>`;

const BUCKET = 'ecu-files';
const KEY_PREFIX = 'ctf_live_';
const STAGING_ROOT = 'api-staging';

// Vercel caps a serverless request body at ~4.5 MB, and base64 inflates by
// a third — anything larger has to go through POST /uploads.
const MAX_INLINE_BYTES = 3 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const BLOCKED_EXTENSIONS = ['zip', 'rar', '7z', 'php', 'exe', 'bat', 'sh', 'js'];

const DOWNLOAD_URL_TTL = 300; // seconds
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BNAlvOYedrfxmjCMP8eKO7f3cCkC_4zs9atkI8Lg7WFFxaXLfc4_ahI9cEjBS0JxtESSIfiF7JDhBid8KssIsBg';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kikzaperformance@gmail.com';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Errors are carried as values rather than thrown, so every route can return
// "either a payload or an ApiError". isApiError is the only discriminator —
// never sniff for a `status` field, job rows have one of their own.
type ApiError = { __apiError: true; status: number; code: string; message: string };

function fail(status: number, code: string, message: string): ApiError {
  return { __apiError: true, status, code, message };
}

function isApiError(value: unknown): value is ApiError {
  return !!value && typeof value === 'object' && (value as any).__apiError === true;
}

const JOB_STATUSES = [
  'pending',
  'in_progress',
  'waiting_for_info',
  'completed',
  'revision_requested',
  'rejected',
];

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function parseBody(req: VercelRequest): any {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function str(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

// Strip directories and anything that could escape the job folder.
function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/[^\w.\- ]/g, '_').slice(0, 120) || 'file.bin';
}

function extensionAllowed(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return !BLOCKED_EXTENSIONS.includes(ext);
}

function clientIp(req: VercelRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  if (Array.isArray(forwarded)) return forwarded[0] || null;
  return null;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

type PartnerAuth = {
  keyId: string;
  clientId: string;
  clientEmail: string;
  clientName: string;
  companyName: string | null;
  toolType: 'master' | 'slave';
  creditBalance: number;
  rateLimit: number;
};

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function authenticatePartner(req: VercelRequest): Promise<PartnerAuth | ApiError> {
  const token = bearerToken(req);
  if (!token) {
    return fail(401, 'missing_api_key', 'Send your key as: Authorization: Bearer ctf_live_…');
  }

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, client_id, is_active, revoked_at, rate_limit_per_min')
    .eq('key_hash', sha256(token))
    .maybeSingle();

  if (!key || !key.is_active || key.revoked_at) {
    return fail(401, 'invalid_api_key', 'This API key is unknown, revoked or disabled.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, contact_name, company_name, tool_type, credit_balance')
    .eq('id', key.client_id)
    .single();

  if (!profile) {
    return fail(401, 'invalid_api_key', 'The account behind this key no longer exists.');
  }

  // Per-key rate limit over a rolling minute.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('api_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', key.id)
    .gte('created_at', since);

  if ((count ?? 0) >= key.rate_limit_per_min) {
    return fail(429, 'rate_limited', `Rate limit of ${key.rate_limit_per_min} requests/minute exceeded.`);
  }

  return {
    keyId: key.id,
    clientId: profile.id,
    clientEmail: profile.email,
    clientName: profile.contact_name,
    companyName: profile.company_name ?? null,
    toolType: profile.tool_type === 'slave' ? 'slave' : 'master',
    creditBalance: Number(profile.credit_balance),
    rateLimit: key.rate_limit_per_min,
  };
}

// Any signed-in portal user, acting on their own account. Used by the partner's
// own API Access page, which holds a Supabase session rather than an API key.
async function authenticateSession(req: VercelRequest): Promise<{ userId: string } | ApiError> {
  const token = bearerToken(req);
  if (!token) return fail(401, 'unauthorized', 'Missing session token.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return fail(401, 'unauthorized', 'Invalid session token.');
  return { userId: data.user.id };
}

async function authenticateAdmin(req: VercelRequest): Promise<{ userId: string } | ApiError> {
  const token = bearerToken(req);
  if (!token) return fail(401, 'unauthorized', 'Missing session token.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return fail(401, 'unauthorized', 'Invalid session token.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return fail(403, 'forbidden', 'Admin access required.');
  }
  return { userId: data.user.id };
}

// ─── Admin notifications (mirrors the portal's upload flow) ─────────────────

async function pushToUsers(userIds: string[], payload: { title: string; body: string; url: string }) {
  if (!VAPID_PRIVATE_KEY || userIds.length === 0) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds);
    if (!subs?.length) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      })
    );
  } catch (err: any) {
    console.error('API push error:', err?.message || err);
  }
}

async function notifyAdmins(title: string, message: string, jobId: string) {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'superadmin']);
    if (!admins?.length) return;

    await supabase.from('notifications').insert(
      admins.map((admin: { id: string }) => ({
        user_id: admin.id,
        title,
        message,
        link_type: 'job',
        link_id: jobId,
      }))
    );

    await pushToUsers(admins.map((a: { id: string }) => a.id), {
      title,
      body: message,
      url: `/admin/jobs/${jobId}`,
    });
  } catch (err: any) {
    // Never let notification trouble fail a job that was already paid for.
    console.error('API notifyAdmins error:', err?.message || err);
  }
}

async function emailAdminNewApiJob(job: {
  reference: string;
  partner: string;
  vehicle: string;
  services: string;
  jobId: string;
  externalRef: string | null;
}) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return;
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:40px 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <h1 style="margin:0 0 8px;color:#2563eb;font-size:22px;font-weight:900;text-transform:uppercase;">New API request from ${job.partner}</h1>
        <p style="margin:0 0 24px;color:#666;font-size:13px;">Submitted through the partner API.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #eee;border-radius:8px;">
          <tr style="background:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;">REFERENCE</td><td style="padding:12px 16px;color:#333;font-size:14px;">${job.reference}</td></tr>
          <tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">VEHICLE</td><td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${job.vehicle}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">SERVICES</td><td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${job.services}</td></tr>
          ${job.externalRef ? `<tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">PARTNER REF</td><td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${job.externalRef}</td></tr>` : ''}
        </table>
        <a href="${SITE_URL}/admin/jobs/${job.jobId}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">&rarr; Open in portal</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `New API request ${job.reference} from ${job.partner} — ${BRAND_NAME}`,
        html,
      }),
    });
  } catch (err: any) {
    console.error('API admin email error:', err?.message || err);
  }
}

// ─── Serializers ────────────────────────────────────────────────────────────

function serializeJob(job: any, services?: any[], files?: any[]) {
  return {
    id: job.id,
    reference: job.reference_number,
    external_ref: job.external_ref ?? null,
    end_customer_ref: job.end_customer_ref ?? null,
    source: job.source ?? 'portal', // 'api' = sent by you, 'portal' = uploaded on our website
    status: job.status,
    job_type: job.job_type,
    vehicle: {
      brand: job.vehicle_brand,
      model: job.vehicle_model,
      generation: job.vehicle_year,
      engine: job.engine_type,
      ecu: job.ecu_type ?? null,
      gearbox: job.gearbox_type ?? null,
      vin: job.vin ?? null,
    },
    tool: {
      reading_tool: job.reading_tool ?? null,
      tool_type: job.tool_type ?? null,
      reading_method: job.car_notes ?? null,
      is_original: job.is_original ?? null,
    },
    notes: job.client_notes ?? null,
    price: Number(job.total_price),
    credits_used: Number(job.credits_used),
    revision_count: job.revision_count ?? 0,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at ?? null,
    ...(services ? { services: services.map((s) => ({ name: s.service_name, price: Number(s.price) })) } : {}),
    ...(files
      ? {
          files: files.map((f) => ({
            id: f.id,
            kind: f.file_type, // 'original' (yours) | 'modified' (tuned, ready)
            name: f.original_name,
            size: Number(f.file_size),
            version: f.version ?? 1,
            created_at: f.created_at,
            download_path: `/api/v1/jobs/${job.id}/files/${f.id}/download`,
          })),
        }
      : {}),
  };
}

// ─── Route handlers ─────────────────────────────────────────────────────────

async function getAccount(auth: PartnerAuth) {
  return {
    client_id: auth.clientId,
    email: auth.clientEmail,
    contact_name: auth.clientName,
    company_name: auth.companyName,
    pricing_tier: auth.toolType,
    credit_balance: auth.creditBalance,
    rate_limit_per_min: auth.rateLimit,
  };
}

async function getServices(auth: PartnerAuth) {
  const { data: categories } = await supabase
    .from('service_categories')
    .select('id, name, job_type, selection_type, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order');

  const { data: services } = await supabase
    .from('services')
    .select('id, category_id, code, name, description, base_price, slave_price, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  const priceFor = (s: any) =>
    auth.toolType === 'slave' ? Number(s.slave_price ?? s.base_price) : Number(s.base_price);

  return {
    pricing_tier: auth.toolType,
    categories: (categories || []).map((cat: any) => ({
      name: cat.name,
      job_type: cat.job_type || 'ecu',
      selection: cat.selection_type === 'single' ? 'single' : 'multi',
      services: (services || [])
        .filter((s: any) => s.category_id === cat.id)
        .map((s: any) => ({
          code: s.code,
          name: s.name,
          description: s.description ?? null,
          price: priceFor(s),
        })),
    })),
  };
}

async function createUpload(auth: PartnerAuth, body: any) {
  const rawName = str(body.filename, 200);
  if (!rawName) return fail(400, 'invalid_request', 'filename is required.');

  const name = safeFileName(rawName);
  if (!extensionAllowed(name)) {
    return fail(400, 'file_type_not_allowed', `Archives and executables are not accepted (${BLOCKED_EXTENSIONS.join(', ')}).`);
  }
  if (typeof body.size === 'number' && body.size > MAX_FILE_BYTES) {
    return fail(400, 'file_too_large', `Maximum file size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }

  const path = `${STAGING_ROOT}/${auth.clientId}/${crypto.randomUUID()}__${name}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('createSignedUploadUrl failed:', error);
    return fail(502, 'upload_url_failed', 'Could not create an upload URL. Try again.');
  }

  return {
    upload_id: path,
    upload_url: data.signedUrl,
    token: data.token,
    method: 'PUT',
    expires_in: 7200,
    note: 'PUT the raw file bytes to upload_url, then pass upload_id as file.upload_id when creating the job.',
  };
}

async function stagedFileExists(path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await supabase.storage.from(BUCKET).list(dir, { search: name, limit: 1 });
  return !!data?.length;
}

async function createJob(auth: PartnerAuth, body: any) {
  const vehicle = body.vehicle || {};
  const brand = str(vehicle.brand, 100);
  const model = str(vehicle.model, 100);
  const generation = str(vehicle.generation ?? vehicle.year, 100);
  const engine = str(vehicle.engine, 150);

  if (!brand || !model || !generation || !engine) {
    return fail(400, 'invalid_request', 'vehicle.brand, vehicle.model, vehicle.generation and vehicle.engine are required.');
  }

  const services: string[] = Array.isArray(body.services)
    ? body.services.filter((c: unknown) => typeof c === 'string' && c.trim()).map((c: string) => c.trim())
    : [];
  if (services.length === 0) {
    return fail(400, 'invalid_request', 'services must contain at least one service code (see GET /api/v1/services).');
  }

  const file = body.file || {};
  const uploadId = str(file.upload_id, 400);
  const inlineB64 = typeof file.content_base64 === 'string' ? file.content_base64 : null;

  if (!uploadId && !inlineB64) {
    return fail(400, 'invalid_request', 'file.upload_id (from POST /uploads) or file.content_base64 is required.');
  }

  // Resolve the incoming file BEFORE charging credits.
  let fileName: string;
  let stagedPath: string | null = null;
  let inlineBuffer: Buffer | null = null;

  if (uploadId) {
    // A partner may only attach files they staged themselves.
    const expectedPrefix = `${STAGING_ROOT}/${auth.clientId}/`;
    if (!uploadId.startsWith(expectedPrefix)) {
      return fail(403, 'invalid_upload', 'This upload_id does not belong to your account.');
    }
    if (!(await stagedFileExists(uploadId))) {
      return fail(400, 'upload_not_found', 'No uploaded file found for this upload_id. Did the PUT succeed?');
    }
    stagedPath = uploadId;
    // file.name may override the staged name, so re-check it here as well.
    fileName = safeFileName(str(file.name, 200) || uploadId.split('__').slice(1).join('__') || 'file.bin');
    if (!extensionAllowed(fileName)) {
      return fail(400, 'file_type_not_allowed', `Archives and executables are not accepted (${BLOCKED_EXTENSIONS.join(', ')}).`);
    }
  } else {
    fileName = safeFileName(str(file.name, 200) || 'file.bin');
    if (!extensionAllowed(fileName)) {
      return fail(400, 'file_type_not_allowed', `Archives and executables are not accepted (${BLOCKED_EXTENSIONS.join(', ')}).`);
    }
    inlineBuffer = Buffer.from(inlineB64!, 'base64');
    if (inlineBuffer.length === 0) {
      return fail(400, 'invalid_request', 'file.content_base64 did not decode to any data.');
    }
    if (inlineBuffer.length > MAX_INLINE_BYTES) {
      return fail(
        413,
        'file_too_large',
        `Inline files are limited to ${MAX_INLINE_BYTES / 1024 / 1024} MB. Use POST /api/v1/uploads for larger files.`
      );
    }
  }

  const jobType = body.job_type === 'tcu' ? 'tcu' : 'ecu';

  const { data: result, error } = await supabase.rpc('create_api_job', {
    p_client_id: auth.clientId,
    p_api_key_id: auth.keyId,
    p_vehicle_brand: brand,
    p_vehicle_model: model,
    p_vehicle_year: generation,
    p_engine_type: engine,
    p_service_codes: services,
    p_ecu_type: str(vehicle.ecu, 100),
    p_gearbox_type: str(vehicle.gearbox, 50),
    p_vin: str(vehicle.vin, 17),
    p_client_notes: str(body.notes, 2000),
    p_job_type: jobType,
    p_file_type: jobType === 'tcu' ? 'gearbox' : 'ecu',
    p_is_original: body.is_original !== false,
    p_reading_tool: str(body.reading_tool, 50),
    p_tool_type: body.tool_type === 'slave' ? 'slave' : 'master',
    p_car_notes: str(body.reading_method, 100),
    p_external_ref: str(body.external_ref, 100),
    p_end_customer_ref: str(body.end_customer_ref, 100),
  });

  if (error) {
    const message = error.message || 'Job creation failed.';
    if (message.includes('insufficient_credits')) {
      return fail(402, 'insufficient_credits', `Not enough credits. Your balance is €${auth.creditBalance}. Top up in the portal.`);
    }
    if (message.includes('unknown_service')) {
      return fail(400, 'unknown_service', 'One or more service codes are unknown or inactive. See GET /api/v1/services.');
    }
    if (message.includes('no_services')) {
      return fail(400, 'invalid_request', 'At least one service code is required.');
    }
    console.error('create_api_job failed:', error);
    return fail(500, 'job_create_failed', 'Could not create the job.');
  }

  const created = result as {
    result: 'created' | 'existing';
    job_id: string;
    reference_number: string;
    total_price: number;
    balance_after: number;
  };

  // A retried external_ref returns the original job untouched — no second
  // charge and no second file.
  if (created.result === 'existing') {
    const { data: job } = await supabase.from('jobs').select('*').eq('id', created.job_id).single();
    return {
      status: 200,
      body: {
        duplicate: true,
        message: 'A job with this external_ref already exists; returning the original.',
        job: job ? serializeJob(job) : { id: created.job_id, reference: created.reference_number },
        credit_balance: Number(created.balance_after),
      },
    };
  }

  const jobId = created.job_id;
  const destination = `${jobId}/original/v1_${Date.now()}_${fileName}`;
  let fileAttached = true;
  let fileSize = inlineBuffer?.length ?? 0;

  if (stagedPath) {
    const { error: moveError } = await supabase.storage.from(BUCKET).move(stagedPath, destination);
    if (moveError) {
      // Keep the staged object rather than losing the file: admins can read
      // any path in the bucket, so the job stays workable either way.
      console.error('Staged file move failed:', moveError);
      const { data: info } = await supabase.storage
        .from(BUCKET)
        .list(stagedPath.slice(0, stagedPath.lastIndexOf('/')), {
          search: stagedPath.slice(stagedPath.lastIndexOf('/') + 1),
          limit: 1,
        });
      fileSize = Number(info?.[0]?.metadata?.size ?? 0);
      await supabase.from('files').insert({
        job_id: jobId,
        file_type: 'original',
        original_name: fileName,
        storage_path: stagedPath,
        file_size: fileSize,
        uploaded_by: auth.clientId,
        version: 1,
      });
    } else {
      const { data: info } = await supabase.storage
        .from(BUCKET)
        .list(`${jobId}/original`, { search: destination.split('/').pop()!, limit: 1 });
      fileSize = Number(info?.[0]?.metadata?.size ?? 0);
      await supabase.from('files').insert({
        job_id: jobId,
        file_type: 'original',
        original_name: fileName,
        storage_path: destination,
        file_size: fileSize,
        uploaded_by: auth.clientId,
        version: 1,
      });
    }
  } else {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(destination, inlineBuffer!, { contentType: 'application/octet-stream', upsert: false });

    if (uploadError) {
      console.error('Inline upload failed:', uploadError);
      fileAttached = false;
      // The job is paid for, so don't throw it away — flag it so the admin
      // chases the file instead of silently working on nothing.
      await supabase
        .from('jobs')
        .update({
          status: 'waiting_for_info',
          admin_notes: 'API job created but the uploaded file could not be stored. Ask the partner to resend it.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } else {
      await supabase.from('files').insert({
        job_id: jobId,
        file_type: 'original',
        original_name: fileName,
        storage_path: destination,
        file_size: inlineBuffer!.length,
        uploaded_by: auth.clientId,
        version: 1,
      });
    }
  }

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  const { data: jobServices } = await supabase
    .from('job_services')
    .select('service_name, price')
    .eq('job_id', jobId);

  const partnerLabel = auth.companyName || auth.clientName;
  const vehicleLabel = `${brand} ${model} ${engine}`;
  const serviceLabel = (jobServices || []).map((s: any) => s.service_name).join(', ');

  await notifyAdmins(
    'New API File Request',
    `${partnerLabel} submitted a ${jobType.toUpperCase()} file via API for ${vehicleLabel}.`,
    jobId
  );
  await emailAdminNewApiJob({
    reference: created.reference_number,
    partner: partnerLabel,
    vehicle: vehicleLabel,
    services: serviceLabel || '—',
    jobId,
    externalRef: str(body.external_ref, 100),
  });

  return {
    status: 201,
    body: {
      job: job ? serializeJob(job, jobServices || []) : null,
      charged: Number(created.total_price),
      credit_balance: Number(created.balance_after),
      file_attached: fileAttached,
      ...(fileAttached
        ? {}
        : { warning: 'The job was created but the file could not be stored. Contact support before it is processed.' }),
    },
  };
}

async function listJobs(auth: PartnerAuth, query: Record<string, any>) {
  const limit = Math.min(Number(query.limit) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = Math.max(Number(query.offset) || 0, 0);

  let request = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('client_id', auth.clientId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Every job on the account is listed, whether it arrived through the API or
  // was uploaded on the website — each row carries `source` so the partner can
  // tell them apart. Filtering to source='api' here would hide a job they can
  // plainly see in the portal.
  const source = str(query.source, 20);
  if (source === 'api' || source === 'portal') request = request.eq('source', source);

  const status = str(query.status, 40);
  if (status) {
    // status is a Postgres enum: an unknown value would blow up as a 500.
    if (!JOB_STATUSES.includes(status)) {
      return fail(400, 'invalid_request', `status must be one of: ${JOB_STATUSES.join(', ')}.`);
    }
    request = request.eq('status', status);
  }

  const externalRef = str(query.external_ref, 100);
  if (externalRef) request = request.eq('external_ref', externalRef);

  const updatedSince = str(query.updated_since, 40);
  if (updatedSince) {
    const parsed = new Date(updatedSince);
    if (Number.isNaN(parsed.getTime())) {
      return fail(400, 'invalid_request', 'updated_since must be an ISO-8601 timestamp.');
    }
    request = request.gt('updated_at', parsed.toISOString());
  }

  const { data, count, error } = await request;
  if (error) {
    console.error('listJobs failed:', error);
    return fail(500, 'query_failed', 'Could not list jobs.');
  }

  const jobIds = (data || []).map((j: any) => j.id);
  const { data: files } = jobIds.length
    ? await supabase
        .from('files')
        .select('id, job_id, file_type, original_name, file_size, version, created_at')
        .in('job_id', jobIds)
    : { data: [] as any[] };

  return {
    jobs: (data || []).map((job: any) =>
      serializeJob(job, undefined, (files || []).filter((f: any) => f.job_id === job.id))
    ),
    total: count ?? 0,
    limit,
    offset,
  };
}

async function loadOwnedJob(auth: PartnerAuth, jobId: string) {
  if (!isUuid(jobId)) return fail(400, 'invalid_request', 'Job id must be a UUID.');
  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job || job.client_id !== auth.clientId) {
    return fail(404, 'not_found', 'Job not found.');
  }
  return job;
}

async function getJob(auth: PartnerAuth, jobId: string) {
  const job = await loadOwnedJob(auth, jobId);
  if (isApiError(job)) return job;

  const { data: jobServices } = await supabase
    .from('job_services')
    .select('service_name, price')
    .eq('job_id', jobId);
  const { data: files } = await supabase
    .from('files')
    .select('id, job_id, file_type, original_name, file_size, version, created_at')
    .eq('job_id', jobId)
    .order('created_at');

  return { job: serializeJob(job, jobServices || [], files || []) };
}

async function downloadFile(auth: PartnerAuth, jobId: string, fileId: string) {
  const job = await loadOwnedJob(auth, jobId);
  if (isApiError(job)) return job;
  if (!isUuid(fileId)) return fail(400, 'invalid_request', 'File id must be a UUID.');

  const { data: file } = await supabase
    .from('files')
    .select('id, job_id, original_name, storage_path, file_type')
    .eq('id', fileId)
    .maybeSingle();

  if (!file || file.job_id !== jobId) return fail(404, 'not_found', 'File not found on this job.');

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, DOWNLOAD_URL_TTL, { download: file.original_name });

  if (error || !data) {
    console.error('createSignedUrl failed:', error);
    return fail(502, 'download_failed', 'Could not create a download link.');
  }

  return {
    file_id: file.id,
    kind: file.file_type,
    name: file.original_name,
    url: data.signedUrl,
    expires_in: DOWNLOAD_URL_TTL,
  };
}

async function listMessages(auth: PartnerAuth, jobId: string) {
  const job = await loadOwnedJob(auth, jobId);
  if (isApiError(job)) return job;

  const { data: messages } = await supabase
    .from('job_messages')
    .select('id, sender_id, message, created_at')
    .eq('job_id', jobId)
    .eq('is_internal', false)
    .order('created_at');

  return {
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      from: m.sender_id === auth.clientId ? 'partner' : 'support',
      message: m.message,
      created_at: m.created_at,
    })),
  };
}

async function postMessage(auth: PartnerAuth, jobId: string, body: any) {
  const job = await loadOwnedJob(auth, jobId);
  if (isApiError(job)) return job;

  const message = str(body.message, 2000);
  if (!message) return fail(400, 'invalid_request', 'message is required.');

  const { data, error } = await supabase
    .from('job_messages')
    .insert({ job_id: jobId, sender_id: auth.clientId, message, is_internal: false })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('postMessage failed:', error);
    return fail(500, 'message_failed', 'Could not post the message.');
  }

  await notifyAdmins(
    'New API Message',
    `${auth.companyName || auth.clientName} wrote on job ${(job as any).reference_number}.`,
    jobId
  );

  return { status: 201, body: { id: data.id, created_at: data.created_at } };
}

async function requestRevision(auth: PartnerAuth, jobId: string, body: any) {
  const job = await loadOwnedJob(auth, jobId);
  if (isApiError(job)) return job;

  const reason = str(body.reason, 2000);
  if (!reason) return fail(400, 'invalid_request', 'reason is required.');
  if ((job as any).status !== 'completed') {
    return fail(409, 'not_revisable', 'Only completed jobs can be sent back for revision.');
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'revision_requested',
      revision_count: ((job as any).revision_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('requestRevision failed:', error);
    return fail(500, 'revision_failed', 'Could not request a revision.');
  }

  await supabase.from('job_messages').insert({
    job_id: jobId,
    sender_id: auth.clientId,
    message: `Revision requested (API): ${reason}`,
    is_internal: false,
  });

  await notifyAdmins(
    'API Revision Requested',
    `${auth.companyName || auth.clientName} requested a revision on ${(job as any).reference_number}.`,
    jobId
  );

  return { status: 'revision_requested', job_id: jobId };
}

// ─── Key management (admin, Supabase session token) ─────────────────────────

async function listKeys() {
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, client_id, name, key_prefix, is_active, rate_limit_per_min, last_used_at, request_count, created_at, revoked_at')
    .order('created_at', { ascending: false });

  const clientIds = [...new Set((keys || []).map((k: any) => k.client_id))];
  const { data: profiles } = clientIds.length
    ? await supabase.from('profiles').select('id, email, contact_name, company_name').in('id', clientIds)
    : { data: [] as any[] };

  return {
    keys: (keys || []).map((k: any) => {
      const profile = (profiles || []).find((p: any) => p.id === k.client_id);
      return {
        ...k,
        client_email: profile?.email ?? null,
        client_name: profile?.company_name || profile?.contact_name || null,
      };
    }),
  };
}

async function createKey(adminId: string, body: any) {
  const clientId = str(body.client_id, 40);
  const name = str(body.name, 80);
  if (!isUuid(clientId)) return fail(400, 'invalid_request', 'client_id must be a UUID.');
  if (!name) return fail(400, 'invalid_request', 'name is required.');

  const rateLimit = Math.min(Math.max(Number(body.rate_limit_per_min) || 60, 1), 600);

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', clientId).maybeSingle();
  if (!profile) return fail(404, 'not_found', 'No client with that id.');

  const secret = crypto.randomBytes(24).toString('base64url');
  const key = `${KEY_PREFIX}${secret}`;

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      client_id: clientId,
      name,
      key_prefix: key.slice(0, KEY_PREFIX.length + 8),
      key_hash: sha256(key),
      rate_limit_per_min: rateLimit,
      created_by: adminId,
    })
    .select('id, client_id, name, key_prefix, rate_limit_per_min, created_at')
    .single();

  if (error) {
    console.error('createKey failed:', error);
    return fail(500, 'key_create_failed', 'Could not create the key.');
  }

  // The only time the plaintext key ever leaves the server.
  return { status: 201, body: { ...data, key } };
}

async function revokeKey(keyId: string) {
  if (!isUuid(keyId)) return fail(400, 'invalid_request', 'Key id must be a UUID.');
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) {
    console.error('revokeKey failed:', error);
    return fail(500, 'key_revoke_failed', 'Could not revoke the key.');
  }
  return { revoked: true };
}

// ─── Webhooks: partner registration ─────────────────────────────────────────

const WEBHOOK_EVENTS = ['job.status_changed', 'job.file_ready', 'job.message'];

type WebhookOwner = { clientId: string };

// A webhook URL makes our server issue requests to an address the partner
// chooses, so it must not be usable to reach anything on our own side of the
// network (SSRF). Public HTTPS only.
async function validateWebhookUrl(raw: string): Promise<string | ApiError> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail(400, 'invalid_request', 'url must be a valid absolute URL.');
  }
  if (parsed.protocol !== 'https:') {
    return fail(400, 'invalid_request', 'Webhook URLs must use HTTPS.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '[::1]'
  ) {
    return fail(400, 'invalid_request', 'Webhook URLs must point at a public host.');
  }

  // Resolve the name: a public-looking hostname can still be pointed at a
  // private or link-local address.
  try {
    const { lookup } = await import('node:dns/promises');
    const addresses = await lookup(host, { all: true });
    for (const { address, family } of addresses) {
      if (family === 4) {
        const [a, b] = address.split('.').map(Number) as [number, number];
        const isPrivate =
          a === 10 ||
          a === 127 ||
          a === 0 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254) || // link-local, incl. cloud metadata
          (a === 100 && b >= 64 && b <= 127);
        if (isPrivate) {
          return fail(400, 'invalid_request', 'Webhook URLs must point at a public address.');
        }
      } else {
        const lower = address.toLowerCase();
        if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
          return fail(400, 'invalid_request', 'Webhook URLs must point at a public address.');
        }
      }
    }
  } catch {
    return fail(400, 'invalid_request', 'The webhook host could not be resolved.');
  }

  return parsed.toString();
}

// The webhook routes are reachable two ways — a partner's server holding an API
// key, and the partner themselves on the API Access page holding a portal
// session — so these take just the account they act on.
async function getWebhook(auth: WebhookOwner) {
  const { data } = await supabase
    .from('api_webhooks')
    .select('id, url, events, is_active, consecutive_failures, last_success_at, last_error, created_at')
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: false });

  return { webhooks: data || [], available_events: WEBHOOK_EVENTS };
}

async function registerWebhook(auth: WebhookOwner, body: any) {
  const rawUrl = str(body.url, 500);
  if (!rawUrl) return fail(400, 'invalid_request', 'url is required.');

  const validated = await validateWebhookUrl(rawUrl);
  if (isApiError(validated)) return validated;

  let events = WEBHOOK_EVENTS;
  if (Array.isArray(body.events)) {
    events = body.events.filter((e: unknown) => typeof e === 'string' && WEBHOOK_EVENTS.includes(e));
    if (events.length === 0) {
      return fail(400, 'invalid_request', `events must contain at least one of: ${WEBHOOK_EVENTS.join(', ')}.`);
    }
  }

  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

  // One endpoint per partner: registering again replaces the old one, which is
  // also how a partner rotates a leaked secret.
  await supabase.from('api_webhooks').delete().eq('client_id', auth.clientId);

  const { data, error } = await supabase
    .from('api_webhooks')
    .insert({ client_id: auth.clientId, url: validated, secret, events })
    .select('id, url, events, is_active, created_at')
    .single();

  if (error) {
    console.error('registerWebhook failed:', error);
    return fail(500, 'webhook_failed', 'Could not register the webhook.');
  }

  // The signing secret is shown once, here.
  return { status: 201, body: { ...data, secret } };
}

async function deleteWebhook(auth: WebhookOwner, webhookId: string) {
  if (!isUuid(webhookId)) return fail(400, 'invalid_request', 'Webhook id must be a UUID.');

  const { data } = await supabase
    .from('api_webhooks')
    .select('id, client_id')
    .eq('id', webhookId)
    .maybeSingle();

  if (!data || data.client_id !== auth.clientId) return fail(404, 'not_found', 'Webhook not found.');

  await supabase.from('api_webhooks').delete().eq('id', webhookId);
  return { deleted: true };
}

// ─── Webhooks: delivery ─────────────────────────────────────────────────────

// Retry schedule per attempt: 1 min, 5 min, 30 min, 2 h, 6 h, then give up.
const WEBHOOK_BACKOFF_SECONDS = [60, 300, 1800, 7200, 21600];
const WEBHOOK_MAX_ATTEMPTS = 6;
const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_BATCH = 20;

type ClaimedDelivery = {
  id: number;
  webhook_id: string;
  event: string;
  payload: any;
  attempts: number;
  url: string;
  secret: string;
};

async function dispatchWebhooks() {
  const { data: claimed, error } = await supabase.rpc('claim_webhook_deliveries', { p_limit: WEBHOOK_BATCH });

  if (error) {
    console.error('claim_webhook_deliveries failed:', error);
    return fail(500, 'dispatch_failed', 'Could not claim deliveries.');
  }

  const deliveries = (claimed || []) as ClaimedDelivery[];
  let delivered = 0;
  let failed = 0;

  await Promise.all(
    deliveries.map(async (delivery) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({
        id: String(delivery.id),
        event: delivery.event,
        created_at: new Date().toISOString(),
        attempt: delivery.attempts,
        data: delivery.payload,
      });

      // Signed over "<timestamp>.<body>" so a captured payload can't be
      // replayed later with a fresh timestamp.
      const signature = crypto
        .createHmac('sha256', delivery.secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      let ok = false;
      let responseStatus: number | null = null;
      let errorText: string | null = null;

      try {
        const response = await fetch(delivery.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `${BRAND_NAME}-Webhooks/1`,
            'X-CTF-Event': delivery.event,
            'X-CTF-Delivery': String(delivery.id),
            'X-CTF-Timestamp': timestamp,
            'X-CTF-Signature': `sha256=${signature}`,
          },
          body,
          signal: controller.signal,
        });
        responseStatus = response.status;
        ok = response.ok;
        if (!ok) errorText = `Endpoint returned HTTP ${response.status}`;
      } catch (err: any) {
        errorText = err?.name === 'AbortError' ? 'Timed out after 10s' : err?.message || 'Request failed';
      } finally {
        clearTimeout(timer);
      }

      ok ? delivered++ : failed++;

      const backoff =
        WEBHOOK_BACKOFF_SECONDS[Math.min(delivery.attempts - 1, WEBHOOK_BACKOFF_SECONDS.length - 1)] ?? 60;

      await supabase.rpc('record_webhook_result', {
        p_delivery_id: delivery.id,
        p_ok: ok,
        p_response_status: responseStatus,
        p_error: errorText,
        p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
        p_backoff_seconds: backoff,
      });
    })
  );

  return { claimed: deliveries.length, delivered, failed };
}

// The dispatcher is called by the admin panel right after a delivering action,
// and optionally by a scheduler for retries. Either a valid admin session or
// the shared cron secret gets in — never an API key.
function dispatchAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.WEBHOOK_DISPATCH_SECRET;
  if (!secret) return false;
  const header = req.headers['x-dispatch-secret'];
  if (typeof header === 'string' && header === secret) return true;
  return bearerToken(req) === secret;
}

async function listWebhooksForAdmin() {
  const { data: hooks } = await supabase
    .from('api_webhooks')
    .select('id, client_id, url, events, is_active, consecutive_failures, last_success_at, last_error, created_at')
    .order('created_at', { ascending: false });

  const clientIds = [...new Set((hooks || []).map((h: any) => h.client_id))];
  const { data: profiles } = clientIds.length
    ? await supabase.from('profiles').select('id, email, contact_name, company_name').in('id', clientIds)
    : { data: [] as any[] };

  const { data: pending } = await supabase
    .from('api_webhook_deliveries')
    .select('webhook_id, status')
    .in('status', ['pending', 'failed']);

  return {
    webhooks: (hooks || []).map((hook: any) => {
      const profile = (profiles || []).find((p: any) => p.id === hook.client_id);
      const rows = (pending || []).filter((d: any) => d.webhook_id === hook.id);
      return {
        ...hook,
        client_email: profile?.email ?? null,
        client_name: profile?.company_name || profile?.contact_name || null,
        pending_count: rows.filter((d: any) => d.status === 'pending').length,
        failed_count: rows.filter((d: any) => d.status === 'failed').length,
      };
    }),
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // The public paths are /api/v1/*, mapped here by a rewrite in vercel.json
  // that hands the rest of the path over as ?route=. (A nested catch-all file,
  // api/v1/[...route].ts, never became a routable function under this project's
  // SPA rewrite — every /api/v1/* request fell through to index.html.)
  // `route` therefore arrives as one slash-joined string; an array is accepted
  // too so the handler still works if it is ever mounted as a real catch-all.
  const routeParam = req.query.route;
  const rawPath = Array.isArray(routeParam) ? routeParam.join('/') : routeParam || '';
  const segments = rawPath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  const isAdminRoute = segments[0] === 'keys' || segments[0] === 'admin';
  const isBrowserRoute = isAdminRoute || segments[0] === 'portal';

  // Partner routes are called server-to-server, so a wildcard origin is safe:
  // authentication is a header, never a cookie. The screens inside the portal
  // (admin key management, a partner's own API Access page) are browser-called
  // and stay pinned to the portal's own origin.
  res.setHeader('Access-Control-Allow-Origin', isBrowserRoute ? SITE_URL : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const method = req.method || 'GET';
  const path = `/${segments.join('/')}`;
  const body = parseBody(req);

  const send = (status: number, payload: any) => res.status(status).json(payload);
  const sendError = (err: ApiError) => send(err.status, { error: { code: err.code, message: err.message } });

  try {
    // ── Webhook delivery ────────────────────────────────────────────────────
    // Called by the admin panel after a delivering action, and by a scheduler
    // for retries. Authenticated by admin session or the dispatch secret, and
    // deliberately checked before any API-key handling: a partner must never
    // be able to drive the outbound queue.
    if (segments[0] === 'webhooks' && segments[1] === 'dispatch' && segments.length === 2) {
      if (!dispatchAuthorized(req)) {
        const admin = await authenticateAdmin(req);
        if (isApiError(admin)) return sendError(admin);
      }
      const result = await dispatchWebhooks();
      if (isApiError(result)) return sendError(result);
      return send(200, result);
    }

    // ── Admin: keys and webhook health ──────────────────────────────────────
    if (isAdminRoute) {
      const admin = await authenticateAdmin(req);
      if (isApiError(admin)) return sendError(admin);
      const adminId = (admin as { userId: string }).userId;

      if (segments[0] === 'keys') {
        if (method === 'GET' && segments.length === 1) return send(200, await listKeys());
        if (method === 'POST' && segments.length === 1) {
          const result = await createKey(adminId, body);
          if (isApiError(result)) return sendError(result);
          return send((result as any).status, (result as any).body);
        }
        if (method === 'DELETE' && segments.length === 2) {
          const result = await revokeKey(segments[1]!);
          if (isApiError(result)) return sendError(result);
          return send(200, result);
        }
      }

      // GET /admin/webhooks — every partner's endpoint and its health.
      if (method === 'GET' && segments[1] === 'webhooks' && segments.length === 2) {
        return send(200, await listWebhooksForAdmin());
      }

      // POST /admin/webhooks/:id/toggle — switch an endpoint on or off, e.g.
      // to re-enable one that auto-disabled after a partner's outage.
      if (method === 'POST' && segments[1] === 'webhooks' && segments[3] === 'toggle' && segments.length === 4) {
        const hookId = segments[2]!;
        if (!isUuid(hookId)) return sendError(fail(400, 'invalid_request', 'Webhook id must be a UUID.'));

        const { data: hook } = await supabase
          .from('api_webhooks')
          .select('id, is_active')
          .eq('id', hookId)
          .maybeSingle();
        if (!hook) return sendError(fail(404, 'not_found', 'Webhook not found.'));

        const nextActive = !hook.is_active;
        await supabase
          .from('api_webhooks')
          .update({
            is_active: nextActive,
            // Re-enabling clears the strike count, otherwise the next single
            // failure would trip the auto-disable threshold again.
            ...(nextActive ? { consecutive_failures: 0, last_error: null } : {}),
          })
          .eq('id', hookId);

        return send(200, { id: hookId, is_active: nextActive });
      }

      return sendError(fail(404, 'not_found', `No route for ${method} /api/v1${path}`));
    }

    // ── Partner's own API Access page (portal session, not an API key) ──────
    // Reads on that page go straight to Supabase under RLS; only the webhook
    // writes need a server route, because the signing secret is generated here
    // and the URL has to be validated before we ever call it.
    if (segments[0] === 'portal') {
      const session = await authenticateSession(req);
      if (isApiError(session)) return sendError(session);
      const owner = { clientId: (session as { userId: string }).userId };

      if (segments[1] === 'webhooks') {
        if (method === 'GET' && segments.length === 2) {
          return send(200, await getWebhook(owner));
        }
        if (method === 'POST' && segments.length === 2) {
          const result = await registerWebhook(owner, body);
          if (isApiError(result)) return sendError(result);
          return send((result as any).status, (result as any).body);
        }
        if (method === 'DELETE' && segments.length === 3) {
          const result = await deleteWebhook(owner, segments[2]!);
          if (isApiError(result)) return sendError(result);
          return send(200, result);
        }
      }
      return sendError(fail(404, 'not_found', `No route for ${method} /api/v1${path}`));
    }

    // ── Unauthenticated index ───────────────────────────────────────────────
    if (segments.length === 0) {
      return send(200, {
        name: `${BRAND_NAME} Partner API`,
        version: '1',
        docs: `${SITE_URL}/api-docs`,
        auth: 'Authorization: Bearer ctf_live_…',
        endpoints: [
          'GET  /api/v1/ping',
          'GET  /api/v1/account',
          'GET  /api/v1/services',
          'POST /api/v1/uploads',
          'POST /api/v1/jobs',
          'GET  /api/v1/jobs',
          'GET  /api/v1/jobs/:id',
          'GET  /api/v1/jobs/:id/files/:fileId/download',
          'GET  /api/v1/jobs/:id/messages',
          'POST /api/v1/jobs/:id/messages',
          'POST /api/v1/jobs/:id/revision',
          'GET  /api/v1/webhooks',
          'POST /api/v1/webhooks',
          'DELETE /api/v1/webhooks/:id',
        ],
        webhook_events: WEBHOOK_EVENTS,
      });
    }

    // ── Partner routes ──────────────────────────────────────────────────────
    const auth = await authenticatePartner(req);
    if (isApiError(auth)) {
      const err = auth;
      // Log rate-limited hits too, otherwise a hammering key never cools down.
      if (err.code === 'rate_limited') res.setHeader('Retry-After', '60');
      return sendError(err);
    }
    const partner = auth as PartnerAuth;

    const finish = async (status: number, payload: any) => {
      await supabase.from('api_request_log').insert({
        api_key_id: partner.keyId,
        client_id: partner.clientId,
        method,
        path,
        status,
        ip: clientIp(req),
      });
      await supabase.rpc('touch_api_key', { p_key_id: partner.keyId });
      return send(status, payload);
    };

    // A route returns an ApiError, an explicit { status, body } envelope, or a
    // plain payload that goes out as 200.
    const respond = async (result: any) => {
      if (isApiError(result)) {
        return finish(result.status, { error: { code: result.code, message: result.message } });
      }
      if (result && typeof result === 'object' && typeof result.status === 'number' && 'body' in result) {
        return finish(result.status, result.body);
      }
      return finish(200, result);
    };

    // GET /ping
    if (method === 'GET' && segments[0] === 'ping' && segments.length === 1) {
      return respond({ ok: true, client: partner.companyName || partner.clientName, credit_balance: partner.creditBalance });
    }

    // GET /account
    if (method === 'GET' && segments[0] === 'account' && segments.length === 1) {
      return respond(await getAccount(partner));
    }

    // GET /services
    if (method === 'GET' && segments[0] === 'services' && segments.length === 1) {
      return respond(await getServices(partner));
    }

    // POST /uploads
    if (method === 'POST' && segments[0] === 'uploads' && segments.length === 1) {
      return respond(await createUpload(partner, body));
    }

    if (segments[0] === 'jobs') {
      // POST /jobs
      if (method === 'POST' && segments.length === 1) {
        return respond(await createJob(partner, body));
      }
      // GET /jobs
      if (method === 'GET' && segments.length === 1) {
        return respond(await listJobs(partner, req.query as Record<string, any>));
      }
      // GET /jobs/:id
      if (method === 'GET' && segments.length === 2) {
        return respond(await getJob(partner, segments[1]!));
      }
      // GET /jobs/:id/files/:fileId/download
      if (method === 'GET' && segments.length === 5 && segments[2] === 'files' && segments[4] === 'download') {
        return respond(await downloadFile(partner, segments[1]!, segments[3]!));
      }
      // GET|POST /jobs/:id/messages
      if (segments.length === 3 && segments[2] === 'messages') {
        if (method === 'GET') return respond(await listMessages(partner, segments[1]!));
        if (method === 'POST') return respond(await postMessage(partner, segments[1]!, body));
      }
      // POST /jobs/:id/revision
      if (method === 'POST' && segments.length === 3 && segments[2] === 'revision') {
        return respond(await requestRevision(partner, segments[1]!, body));
      }
    }

    if (segments[0] === 'webhooks') {
      // GET /webhooks
      if (method === 'GET' && segments.length === 1) {
        return respond(await getWebhook(partner));
      }
      // POST /webhooks — register or replace (also how a secret is rotated)
      if (method === 'POST' && segments.length === 1) {
        return respond(await registerWebhook(partner, body));
      }
      // DELETE /webhooks/:id
      if (method === 'DELETE' && segments.length === 2) {
        return respond(await deleteWebhook(partner, segments[1]!));
      }
    }

    return respond(fail(404, 'not_found', `No route for ${method} /api/v1${path}`));
  } catch (err: any) {
    console.error('Partner API error:', err?.message || err);
    return send(500, { error: { code: 'internal_error', message: 'Internal server error.' } });
  }
}
