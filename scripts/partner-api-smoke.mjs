#!/usr/bin/env node
/**
 * Partner API smoke test — exercises the API exactly as a partner portal would.
 *
 * Your API key stays on your machine: pass it in the environment, never as an
 * argument (arguments show up in shell history and process lists).
 *
 *   # read-only pass — safe, changes nothing, charges nothing
 *   CTF_KEY=ctf_live_xxx node scripts/partner-api-smoke.mjs
 *
 *   # full pass — creates a REAL job and CHARGES REAL CREDITS
 *   CTF_KEY=ctf_live_xxx node scripts/partner-api-smoke.mjs --create-job --services=stage1
 *
 *   # also register a webhook (try https://webhook.site for a throwaway URL)
 *   CTF_KEY=ctf_live_xxx node scripts/partner-api-smoke.mjs --webhook=https://webhook.site/your-id
 *
 * Options:
 *   --base=<url>        API base, default https://chiptunefiles.com/api/v1
 *   --create-job        run the paid job-creation flow (off by default)
 *   --services=a,b      service codes to order, required with --create-job
 *   --webhook=<url>     register this callback URL (replaces any existing one)
 *   --inline            send the file as base64 instead of a signed upload
 */

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const value = (name, fallback = null) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const KEY = process.env.CTF_KEY;
const BASE = value('base', 'https://chiptunefiles.com/api/v1').replace(/\/$/, '');
const CREATE_JOB = flag('create-job');
const SERVICES = (value('services', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const WEBHOOK_URL = value('webhook');
const INLINE = flag('inline');

if (!KEY) {
  console.error('Set CTF_KEY to your API key first:  CTF_KEY=ctf_live_xxx node scripts/partner-api-smoke.mjs');
  process.exit(1);
}
if (CREATE_JOB && SERVICES.length === 0) {
  console.error('--create-job charges credits, so it needs explicit codes: --services=stage1');
  process.exit(1);
}

let passed = 0;
let failed = 0;
const ok = (name, detail = '') => { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); };
const bad = (name, detail = '') => { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); };
const section = (title) => console.log(`\n── ${title} ──`);

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try { payload = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, payload };
}

console.log(`Partner API smoke test\nBase: ${BASE}\nMode: ${CREATE_JOB ? 'FULL (creates a real, paid job)' : 'read-only'}`);

// ─── 1. Authentication ───
section('Authentication');
const ping = await call('/ping');
if (ping.ok && ping.payload?.ok) ok('GET /ping', `${ping.payload.client}, balance €${ping.payload.credit_balance}`);
else { bad('GET /ping', JSON.stringify(ping.payload)); console.log('\nKey rejected — nothing else can work. Stopping.'); process.exit(1); }

const badKeyRes = await fetch(`${BASE}/ping`, { headers: { Authorization: 'Bearer ctf_live_not_a_real_key' } });
badKeyRes.status === 401
  ? ok('bad key rejected', '401')
  : bad('bad key rejected', `expected 401, got ${badKeyRes.status}`);

const noKeyRes = await fetch(`${BASE}/ping`);
noKeyRes.status === 401
  ? ok('missing key rejected', '401')
  : bad('missing key rejected', `expected 401, got ${noKeyRes.status}`);

// ─── 2. Account and catalog ───
section('Account and catalog');
const account = await call('/account');
account.ok
  ? ok('GET /account', `tier ${account.payload.pricing_tier}, €${account.payload.credit_balance}, ${account.payload.rate_limit_per_min}/min`)
  : bad('GET /account', JSON.stringify(account.payload));

const services = await call('/services');
if (services.ok) {
  const all = (services.payload.categories || []).flatMap((c) => c.services.map((s) => `${s.code} €${s.price}`));
  ok('GET /services', `${all.length} services — ${all.slice(0, 4).join(', ')}${all.length > 4 ? ' …' : ''}`);
  for (const code of SERVICES) {
    (services.payload.categories || []).some((c) => c.services.some((s) => s.code === code))
      ? ok(`service code "${code}" exists`)
      : bad(`service code "${code}" exists`, 'not in the catalog — the job would be rejected');
  }
} else bad('GET /services', JSON.stringify(services.payload));

// ─── 3. Reading jobs ───
section('Jobs');
const list = await call('/jobs?limit=3');
list.ok
  ? ok('GET /jobs', `${list.payload.total} job(s) on this account`)
  : bad('GET /jobs', JSON.stringify(list.payload));

const sinceNow = await call(`/jobs?updated_since=${new Date().toISOString()}`);
sinceNow.ok && (sinceNow.payload.jobs || []).length === 0
  ? ok('GET /jobs?updated_since=now', 'empty, as expected — this is the polling filter')
  : bad('GET /jobs?updated_since=now', JSON.stringify(sinceNow.payload).slice(0, 120));

const badSince = await call('/jobs?updated_since=not-a-date');
badSince.status === 400
  ? ok('bad updated_since rejected', '400')
  : bad('bad updated_since rejected', `expected 400, got ${badSince.status}`);

const badStatus = await call('/jobs?status=banana');
badStatus.status === 400
  ? ok('unknown status rejected', '400')
  : bad('unknown status rejected', `expected 400, got ${badStatus.status}`);

const foreign = await call('/jobs/00000000-0000-0000-0000-000000000000');
foreign.status === 404
  ? ok('unknown job id → 404')
  : bad('unknown job id → 404', `got ${foreign.status}`);

// ─── 4. Webhooks ───
section('Webhooks');
const hooks = await call('/webhooks');
hooks.ok
  ? ok('GET /webhooks', hooks.payload.webhooks?.length ? `registered: ${hooks.payload.webhooks[0].url}` : 'none registered')
  : bad('GET /webhooks', JSON.stringify(hooks.payload));

const httpHook = await call('/webhooks', { method: 'POST', body: { url: 'http://example.com/hook' } });
httpHook.status === 400
  ? ok('plain-HTTP webhook rejected', '400')
  : bad('plain-HTTP webhook rejected', `expected 400, got ${httpHook.status}`);

const localHook = await call('/webhooks', { method: 'POST', body: { url: 'https://localhost/hook' } });
localHook.status === 400
  ? ok('localhost webhook rejected', '400 (SSRF guard)')
  : bad('localhost webhook rejected', `expected 400, got ${localHook.status}`);

if (WEBHOOK_URL) {
  const registered = await call('/webhooks', { method: 'POST', body: { url: WEBHOOK_URL } });
  registered.status === 201
    ? ok('POST /webhooks', `registered, secret ${String(registered.payload.secret).slice(0, 14)}… (shown once)`)
    : bad('POST /webhooks', JSON.stringify(registered.payload));
}

// ─── 5. Creating a job ───
if (!CREATE_JOB) {
  section('Job creation');
  console.log('  SKIPPED — re-run with --create-job --services=<code> to test the paid flow.');
} else {
  section('Job creation (real job, real credits)');
  const externalRef = `SMOKE-${Date.now()}`;
  const bytes = Buffer.alloc(64 * 1024);
  bytes.write('SMOKE TEST FILE — safe to delete');

  let filePart;
  if (INLINE) {
    filePart = { name: 'smoke-test.bin', content_base64: bytes.toString('base64') };
    ok('using inline base64 upload');
  } else {
    const upload = await call('/uploads', { method: 'POST', body: { filename: 'smoke-test.bin', size: bytes.length } });
    if (!upload.ok) { bad('POST /uploads', JSON.stringify(upload.payload)); process.exit(1); }
    ok('POST /uploads', 'signed URL issued');

    const put = await fetch(upload.payload.upload_url, { method: 'PUT', body: bytes });
    put.ok ? ok('PUT file to signed URL', `${put.status}`) : bad('PUT file to signed URL', `${put.status}`);
    filePart = { upload_id: upload.payload.upload_id, name: 'smoke-test.bin' };
  }

  const jobBody = {
    external_ref: externalRef,
    end_customer_ref: 'API smoke test',
    vehicle: { brand: 'Volkswagen', model: 'Golf 7', generation: '2012-2017', engine: '2.0 TDI 150hp' },
    services: SERVICES,
    file: filePart,
    reading_tool: 'kess_v2',
    tool_type: 'master',
    reading_method: 'OBD',
    notes: 'Automated smoke test — safe to delete.',
  };

  const created = await call('/jobs', { method: 'POST', body: jobBody });
  if (created.status !== 201) { bad('POST /jobs', JSON.stringify(created.payload)); process.exit(1); }

  const job = created.payload.job;
  ok('POST /jobs', `${job.reference}, charged €${created.payload.charged}, balance €${created.payload.credit_balance}`);
  created.payload.file_attached ? ok('file attached to job') : bad('file attached to job', created.payload.warning || '');
  job.source === 'api' ? ok('job tagged source=api') : bad('job tagged source=api', `got ${job.source}`);

  // The important one: a retried request must not charge twice.
  const retry = await call('/jobs', { method: 'POST', body: jobBody });
  if (retry.status === 200 && retry.payload.duplicate && retry.payload.job?.id === job.id) {
    ok('idempotency', `same external_ref returned ${retry.payload.job.reference}, no second charge`);
    retry.payload.credit_balance === created.payload.credit_balance
      ? ok('balance unchanged on retry', `€${retry.payload.credit_balance}`)
      : bad('balance unchanged on retry', `${created.payload.credit_balance} → ${retry.payload.credit_balance}`);
  } else bad('idempotency', `expected duplicate:true, got ${retry.status} ${JSON.stringify(retry.payload).slice(0, 120)}`);

  const fetched = await call(`/jobs/${job.id}`);
  if (fetched.ok) {
    const original = (fetched.payload.job.files || []).find((f) => f.kind === 'original');
    ok('GET /jobs/:id', `status ${fetched.payload.job.status}, ${fetched.payload.job.files?.length || 0} file(s)`);
    if (original) {
      const dl = await call(`/jobs/${job.id}/files/${original.id}/download`);
      dl.ok ? ok('download link issued', `expires in ${dl.payload.expires_in}s`) : bad('download link issued', JSON.stringify(dl.payload));
    } else bad('original file listed on job');
  } else bad('GET /jobs/:id', JSON.stringify(fetched.payload));

  const message = await call(`/jobs/${job.id}/messages`, { method: 'POST', body: { message: 'Smoke test message — please ignore.' } });
  message.status === 201 ? ok('POST /jobs/:id/messages') : bad('POST /jobs/:id/messages', JSON.stringify(message.payload));

  const messages = await call(`/jobs/${job.id}/messages`);
  messages.ok && messages.payload.messages?.some((m) => m.from === 'partner')
    ? ok('GET /jobs/:id/messages', `${messages.payload.messages.length} message(s)`)
    : bad('GET /jobs/:id/messages', JSON.stringify(messages.payload).slice(0, 120));

  const revision = await call(`/jobs/${job.id}/revision`, { method: 'POST', body: { reason: 'smoke test' } });
  revision.status === 409
    ? ok('revision on a pending job rejected', '409, as it should be')
    : bad('revision on a pending job rejected', `expected 409, got ${revision.status}`);

  console.log(`\n  ⚠  Created ${job.reference} (${externalRef}) and charged €${created.payload.charged}.`);
  console.log('     Delete or refund it in the admin panel when you are done.');
  if (WEBHOOK_URL) {
    console.log(`     Now change its status in /admin/jobs/${job.id} — a callback should hit ${WEBHOOK_URL} within a second.`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
