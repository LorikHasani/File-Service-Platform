# ChipTuneFiles Partner API v1

Send tuning jobs from your own portal straight into ours. You upload the customer's
file, pick the services, and poll for the finished file — no manual e-mails, no
logging into the web portal.

**Base URL:** `https://chiptunefiles.com/api/v1`

Everything is JSON over HTTPS. All timestamps are ISO-8601 UTC. All prices and
balances are in credits (€1 = 1 credit).

---

## 1. How it works

1. You have a partner account with us and a **credit balance**. You top it up in
   the portal (or we top it up for you).
2. Every job you submit through the API is **charged to that balance immediately**,
   at your own price list (master or slave prices, whichever applies to your account).
3. The job appears in our tuning queue exactly like a job uploaded on the website.
4. When our tuner delivers, a `modified` file appears on the job and its status
   becomes `completed` — you download it and hand it to your customer.

If your balance runs out, job creation fails with `402 insufficient_credits` and
nothing is charged. Top up and retry.

---

## 2. Authentication

Every request carries your API key as a bearer token:

```
Authorization: Bearer ctf_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The key is issued by us and shown **once**. Store it as a server-side secret —
never in a browser, mobile app, or public repository. If it leaks, tell us and we
revoke it instantly.

Rate limit: **60 requests per minute** per key by default (ask if you need more).
Exceeding it returns `429` with a `Retry-After: 60` header.

Quick check that your key works:

```bash
curl https://chiptunefiles.com/api/v1/ping \
  -H "Authorization: Bearer $CTF_KEY"
```

```json
{ "ok": true, "client": "TuneShop BV", "credit_balance": 420 }
```

---

## 3. Errors

Non-2xx responses always look like this:

```json
{ "error": { "code": "insufficient_credits", "message": "Not enough credits. Your balance is €12. Top up in the portal." } }
```

| HTTP | code | meaning |
|------|------|---------|
| 400 | `invalid_request` | a required field is missing or malformed |
| 400 | `unknown_service` | a service code doesn't exist or is inactive |
| 400 | `upload_not_found` | `upload_id` has no uploaded bytes behind it |
| 400 | `file_type_not_allowed` | archives and executables are rejected |
| 401 | `invalid_api_key` | unknown, revoked or disabled key |
| 402 | `insufficient_credits` | balance too low — nothing was charged |
| 403 | `invalid_upload` | that `upload_id` belongs to another account |
| 404 | `not_found` | no such job/file *for your account* |
| 409 | `not_revisable` | the job isn't in a state that allows revisions |
| 413 | `file_too_large` | inline file over 3 MB — use `POST /uploads` |
| 429 | `rate_limited` | slow down, retry after 60 s |
| 5xx | `internal_error` | our fault — safe to retry |

---

## 4. Endpoints

### `GET /account`

Your account and current balance.

```json
{
  "client_id": "…", "email": "orders@tuneshop.example",
  "contact_name": "TuneShop", "company_name": "TuneShop BV",
  "pricing_tier": "master", "credit_balance": 420, "rate_limit_per_min": 60
}
```

### `GET /services`

The catalog **with your prices already applied**. Cache it, but refresh daily —
codes and prices change.

```json
{
  "pricing_tier": "master",
  "categories": [
    {
      "name": "Tuning Stage", "job_type": "ecu", "selection": "single",
      "services": [
        { "code": "stage1", "name": "Stage 1", "description": "Safe power increase…", "price": 150 },
        { "code": "stage2", "name": "Stage 2", "description": "…", "price": 200 }
      ]
    },
    {
      "name": "Additional Options", "job_type": "ecu", "selection": "multi",
      "services": [ { "code": "dpf_off", "name": "DPF OFF", "description": null, "price": 100 } ]
    }
  ]
}
```

`selection: "single"` means pick at most one code from that category (the stage);
`"multi"` means pick any number.

### `POST /uploads` — for files larger than ~3 MB

Ask for a signed upload URL, `PUT` the raw bytes to it, then reference the
`upload_id` when creating the job.

```bash
curl -X POST https://chiptunefiles.com/api/v1/uploads \
  -H "Authorization: Bearer $CTF_KEY" -H "Content-Type: application/json" \
  -d '{"filename":"golf7_original.bin","size":4194304}'
```

```json
{
  "upload_id": "api-staging/<your-id>/9f2c…__golf7_original.bin",
  "upload_url": "https://…supabase.co/storage/v1/object/upload/sign/…",
  "token": "…", "method": "PUT", "expires_in": 7200
}
```

```bash
curl -X PUT "$UPLOAD_URL" --data-binary @golf7_original.bin
```

The staged file is only usable by your account, and only until you attach it to a job.

### `POST /jobs` — create and pay for a job

```jsonc
{
  "external_ref": "ORDER-10231",          // your own id — makes retries safe
  "end_customer_ref": "Peter M. / VW Golf",// optional label, shown to our tuners
  "job_type": "ecu",                       // "ecu" (default) or "tcu"
  "vehicle": {
    "brand": "Volkswagen",
    "model": "Golf 7",
    "generation": "2012-2017",             // required — year range or generation
    "engine": "2.0 TDI 150hp",
    "ecu": "Bosch EDC17C64",               // optional
    "gearbox": "dsg",                      // optional: manual|automatic|dsg|cvt|robotic
    "vin": "WVWZZZAUZFW…"                  // optional
  },
  "services": ["stage1", "dpf_off"],       // codes from GET /services
  "file": { "upload_id": "api-staging/…" },// or: { "name": "x.bin", "content_base64": "…" }
  "is_original": true,                     // is this a virgin read?
  "reading_tool": "kess_v2",               // kess_v2|ktag|autotuner|cmd_flash|flex|…
  "tool_type": "master",                   // your tool: master|slave
  "reading_method": "OBD",                 // OBD|BENCH|free text
  "notes": "Customer wants soft throttle response."
}
```

Response `201`:

```json
{
  "job": {
    "id": "3f2a…", "reference": "TUN-20260801-0007", "external_ref": "ORDER-10231",
    "status": "pending", "job_type": "ecu",
    "vehicle": { "brand": "Volkswagen", "model": "Golf 7", "generation": "2012-2017", "engine": "2.0 TDI 150hp", "ecu": "Bosch EDC17C64", "gearbox": "dsg", "vin": null },
    "services": [ { "name": "Stage 1", "price": 150 }, { "name": "DPF OFF", "price": 100 } ],
    "price": 250, "credits_used": 250,
    "created_at": "2026-08-01T09:14:22Z", "updated_at": "2026-08-01T09:14:22Z"
  },
  "charged": 250,
  "credit_balance": 170,
  "file_attached": true
}
```

**Retries are safe when you send `external_ref`.** If a request times out and you
resend it, you get `200` with `"duplicate": true` and the original job — you are
never charged twice for the same `external_ref`.

Small files can skip `POST /uploads` entirely by sending base64 inline (max 3 MB
decoded):

```json
{ "file": { "name": "ecu.bin", "content_base64": "AAECAwQF…" } }
```

### `GET /jobs` — poll for progress

| query | meaning |
|-------|---------|
| `updated_since` | ISO timestamp — only jobs changed after it (use this to poll) |
| `status` | `pending`, `in_progress`, `waiting_for_info`, `completed`, `revision_requested`, `rejected` |
| `external_ref` | look up your own reference |
| `limit` / `offset` | paging, default 25, max 100 |

```bash
curl "https://chiptunefiles.com/api/v1/jobs?updated_since=2026-08-01T09:00:00Z" \
  -H "Authorization: Bearer $CTF_KEY"
```

Returns `{ "jobs": [...], "total": 12, "limit": 25, "offset": 0 }`, each job
carrying its `files` array. **Poll every 30–60 seconds** with `updated_since` set
to the newest `updated_at` you have seen; that is all you need to know when a file
is ready.

### `GET /jobs/:id`

One job with `services` and `files`.

```json
{ "job": { "…": "…", "status": "completed",
  "files": [
    { "id": "a1…", "kind": "original", "name": "golf7_original.bin", "size": 4194304, "version": 1,
      "created_at": "…", "download_path": "/api/v1/jobs/3f2a…/files/a1…/download" },
    { "id": "b2…", "kind": "modified", "name": "golf7_stage1.bin", "size": 4194304, "version": 1,
      "created_at": "…", "download_path": "/api/v1/jobs/3f2a…/files/b2…/download" }
  ] } }
```

`kind: "modified"` is the tuned file. A `version` above 1 is a redelivery after a revision.

### `GET /jobs/:id/files/:fileId/download`

Returns a **short-lived (5 minute) direct download URL** — don't store it, fetch it
when you need the bytes.

```json
{ "file_id": "b2…", "kind": "modified", "name": "golf7_stage1.bin",
  "url": "https://…?token=…", "expires_in": 300 }
```

### `GET|POST /jobs/:id/messages`

The job chat, same thread our tuners see in the portal.

```bash
curl -X POST https://chiptunefiles.com/api/v1/jobs/$JOB_ID/messages \
  -H "Authorization: Bearer $CTF_KEY" -H "Content-Type: application/json" \
  -d '{"message":"Customer reports a DTC after flashing — can you check?"}'
```

Each returned message has `from: "partner"` (you) or `"support"` (us).

### `POST /jobs/:id/revision`

Ask for a rework of a delivered file. Only valid while the job is `completed`.

```json
{ "reason": "Still throwing P2002 after flashing." }
```

---

## 5. Webhooks — get pushed instead of polling

Register a URL and we POST to it the moment something happens on one of your
jobs. Polling still works and stays supported; webhooks just save you the round
trips.

### Registering

```bash
curl -X POST https://chiptunefiles.com/api/v1/webhooks \
  -H "Authorization: Bearer $CTF_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://your-portal.example/hooks/chiptunefiles","events":["job.file_ready","job.status_changed","job.message"]}'
```

```json
{
  "id": "…", "url": "https://your-portal.example/hooks/chiptunefiles",
  "events": ["job.file_ready", "job.status_changed", "job.message"],
  "is_active": true, "secret": "whsec_xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

The **secret is shown once** — store it, you need it to verify signatures.
`GET /webhooks` shows your current registration (never the secret), and
`DELETE /webhooks/:id` removes it. Posting a new registration replaces the old
one, which is how you rotate a leaked secret or change URL.

You can do all of this without writing code: sign in to the portal and open
**API Access** in the sidebar. That page shows your keys and their usage, lets
you set the callback URL and pick events, and lists your last ten deliveries
with the response we got — the fastest way to see why a callback isn't arriving.

The URL must be public HTTPS. Private, loopback and link-local addresses are rejected.

### Events

| event | when |
|-------|------|
| `job.status_changed` | any status transition, including → `completed` |
| `job.file_ready` | a tuned file (or a revision) is available for download |
| `job.message` | our tuners wrote on the job — your own messages are not echoed back |

### What we send

```http
POST /hooks/chiptunefiles HTTP/1.1
Content-Type: application/json
X-CTF-Event: job.file_ready
X-CTF-Delivery: 41
X-CTF-Timestamp: 1785312000
X-CTF-Signature: sha256=6f1c…
```

```json
{
  "id": "41",
  "event": "job.file_ready",
  "created_at": "2026-08-02T11:20:00Z",
  "attempt": 1,
  "data": {
    "job_id": "3f2a…",
    "reference": "TUN-20260801-0007",
    "external_ref": "ORDER-10231",
    "status": "completed",
    "file_id": "b2…",
    "file_name": "golf7_stage1.bin",
    "version": 1,
    "download_path": "/api/v1/jobs/3f2a…/files/b2…/download"
  }
}
```

Payloads are deliberately thin. Treat a webhook as *"something changed, go
look"*: call `GET /jobs/:id` (or the `download_path`) for the authoritative
state. That way a delayed or duplicated delivery can never make you act on stale
data.

### Verifying the signature

Compute HMAC-SHA256 over `"<X-CTF-Timestamp>.<raw request body>"` using your
secret, and compare in constant time. **Use the raw body** — re-serialising the
JSON changes the bytes and breaks the signature.

```js
import crypto from 'node:crypto';

app.post('/hooks/chiptunefiles', express.raw({ type: 'application/json' }), (req, res) => {
  const timestamp = req.get('X-CTF-Timestamp');
  const signature = (req.get('X-CTF-Signature') || '').replace('sha256=', '');

  const expected = crypto
    .createHmac('sha256', process.env.CTF_WEBHOOK_SECRET)
    .update(`${timestamp}.${req.body}`)   // req.body is a Buffer here
    .digest('hex');

  const ok =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) return res.status(401).end();

  // Reject anything older than five minutes to kill replays.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return res.status(401).end();

  const event = JSON.parse(req.body);
  res.status(200).end();          // ack FIRST, then do the slow work
  queue.add(event);
});
```

### Delivery rules

- **Respond 2xx quickly.** Anything else — or no answer within 10 seconds —
  counts as a failure. Acknowledge first, process afterwards.
- **Retries:** 1 min, 5 min, 30 min, 2 h, 6 h, then the delivery is marked
  failed and dropped. Nothing is lost — polling still shows the true state.
- **Be idempotent.** A retry can arrive after your server actually did process
  the first delivery. De-duplicate on `id` (the `X-CTF-Delivery` value).
- **No ordering guarantee.** Deliveries go out in parallel; a `job.status_changed`
  can land before the `job.file_ready` that triggered it. Fetch the job if order matters.
- After **20 consecutive failures** your endpoint is switched off automatically
  and we fall back to you polling. Re-register (or ask us to re-enable it) once
  your server is healthy.

---

## 6. A complete integration

```js
const API = 'https://chiptunefiles.com/api/v1';
const KEY = process.env.CTF_KEY;
const call = async (path, init = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, ...init.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body;
};

// 1 — stage the file
const upload = await call('/uploads', {
  method: 'POST',
  body: JSON.stringify({ filename: 'golf7.bin', size: fileBuffer.length }),
});
await fetch(upload.upload_url, { method: 'PUT', body: fileBuffer });

// 2 — create the job (charged to your credits)
const { job } = await call('/jobs', {
  method: 'POST',
  body: JSON.stringify({
    external_ref: order.id,
    vehicle: { brand: 'Volkswagen', model: 'Golf 7', generation: '2012-2017', engine: '2.0 TDI 150hp' },
    services: ['stage1', 'dpf_off'],
    file: { upload_id: upload.upload_id },
    reading_tool: 'kess_v2',
    tool_type: 'master',
    reading_method: 'OBD',
  }),
});

// 3 — poll (a cron every 60 s beats a tight loop)
const { jobs } = await call(`/jobs?updated_since=${lastSeenTimestamp}`);
for (const j of jobs) {
  const tuned = (j.files || []).find((f) => f.kind === 'modified');
  if (j.status === 'completed' && tuned) {
    const { url } = await call(`/jobs/${j.id}/files/${tuned.id}/download`);
    await deliverToCustomer(j.external_ref, await fetch(url).then((r) => r.arrayBuffer()));
  }
}
```

---

## 7. Notes and limits

- **File size:** 50 MB max; inline base64 is capped at 3 MB — use `POST /uploads`
  above that.
- **File types:** archives and executables (`zip`, `rar`, `7z`, `php`, `exe`,
  `bat`, `sh`, `js`) are rejected. Send the raw `.bin`/read file.
- **Isolation:** a key only ever sees its own account's jobs and files. There is no
  way to reach another partner's data.
- **Job statuses:** `pending` → `in_progress` → `completed`, plus
  `waiting_for_info` (we need something from you — check the messages),
  `revision_requested` and `rejected`.
- **Refunds** (rejected jobs, agreed goodwill) return credits to your balance and
  show up in your transaction history in the portal.
- **Working hours** apply to the API as they do to the portal: files sent outside
  our opening hours stay queued until we reopen.

Questions or a bigger rate limit: kikzaperformance@gmail.com

---

## For the portal operator

Issue and revoke keys in the admin panel under **Partner API** (`/admin/api-keys`).
A key is shown once at creation and stored only as a SHA-256 hash. Jobs arriving
this way carry an **API** badge in All Jobs, along with the partner's own reference.

Partners get their own **API Access** page (`/api-access`) showing their keys,
webhook settings and recent deliveries. It appears in their sidebar only once
they have a key, so ordinary clients never see it.

Server requirements: `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` (already set
for the other functions). Migrations `022_partner_api.sql` and
`023_partner_webhooks.sql` must be run in the Supabase SQL editor before the
endpoints work.

**Webhook delivery.** Database triggers queue every event, so nothing is missed
regardless of how a job changed. The admin panel calls
`POST /api/v1/webhooks/dispatch` right after each delivering action, which is
what makes callbacks land within a second; the **Send pending now** button on the
Partner API page drains retries by hand.

For unattended retries, set a `CRON_SECRET` environment variable and add a
schedule to `vercel.json`:

```json
"crons": [{ "path": "/api/v1/webhooks/dispatch", "schedule": "*/5 * * * *" }]
```

Vercel sends that secret as a bearer token, which the dispatcher accepts in place
of an admin session. Note that Hobby-plan projects only run crons once a day —
on that plan the admin-action trigger stays the real delivery path, and retries
wait for the next admin action or a manual drain.
