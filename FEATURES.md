# ChipTuneFiles — File Service Platform

**A complete, ready-to-run web platform for ECU & TCU tuning file services.**
Everything a chiptuning business needs to receive files, sell services, get paid, and deliver tuned files back to customers — fully automated, on any device.

---

## 🚗 Client Portal

### File Upload & Job Ordering
- Guided **3-step upload wizard**: Upload file → Car info → Select services
- Supports both **ECU files and TCU/gearbox files**
- Drag & drop file upload
- Full vehicle details: VIN, gearbox type (manual, automatic, DSG/DCT, CVT, AMT), original/tuned file flag
- Built-in list of all popular **reading tools**: KESS, KTAG, Autotuner, CMD Flash, Flex, Trasdata, Dimsport, Magic Motorsport, BitBox, PCMFlash, MPPS, Galletto & more
- **Master / Slave tool support** with automatic per-tool pricing
- Reading method selection: OBD, BENCH, or custom
- **Saved vehicles ("My Garage")** — clients save their cars once and reorder in seconds

### Services & Pricing
- Configurable service catalog: **Stage 1 / Stage 2 / Stage 3**, DPF off, EGR off, AdBlue off, Pop & Bang, TCU services and any custom service you add
- **Dual pricing per service** — separate prices for master and slave tool users
- Public price list page for logged-in clients
- **Performance calculator** — clients preview potential HP & torque gains before ordering

### Job Tracking & Delivery
- Personal dashboard with live job overview
- Full job history with status tracking (submitted → in progress → completed)
- **Built-in chat on every job** — clients and staff communicate directly on the file, with unread message badges
- Instant download of finished tuned files
- **Revision requests** on delivered files
- **Job ratings & reviews** after completion

### Payments & Billing
- **Credit-based system** — clients buy credit packages, jobs are paid with credits
- **Stripe checkout** integration — cards, secure hosted payment page
- Automatic credit top-up after payment (webhook-verified, fraud-safe)
- **PDF invoices** generated automatically for every purchase, downloadable anytime
- Complete personal transaction history
- Refunds return credits to the client automatically

### Communication & Notifications
- **Real-time in-app notifications** (new file ready, message received, status change) — no page refresh needed
- **Branded email notifications** for every important event
- **Support ticket system** with threaded messaging
- Announcement banners and **promo banners** controlled by admin
- **Business hours display** — clients always know when you're available

### Account & Access
- Free client registration with email login
- Forgot-password / reset-password flow
- Client profile management
- **Dark mode** included
- Fully responsive — works on desktop, tablet and phone

---

## 🛠️ Admin Portal

### Job Management
- Central admin dashboard with everything at a glance
- Full job queue with filtering and detail view
- Upload finished tuned files directly to the job — client is notified instantly
- Change job status, chat with the client, manage revisions
- **Refund a job in one click** — credits automatically returned to the client
- Delete jobs with proper cleanup

### Customer Management
- Complete user list with per-user detail pages
- View each client's jobs, credits, transactions and activity
- Adjust credits manually
- Robust user deletion (all related data handled correctly)

### Business Configuration — no developer needed
- **Service & pricing editor** — add/edit services, categories, master & slave prices from the admin panel
- **Credit package editor** — define your own packages and prices
- **Business hours / schedule editor**
- **News & announcements** publisher
- **Promo banner manager** for campaigns and offers

### Sales & Insight
- **Statistics dashboard** — jobs, revenue, clients, trends
- Full transaction overview across all clients
- **Admin audit log** — every admin action is recorded for accountability

### Partner API — resell to other portals
- **Other tuning portals plug straight into yours** over a documented REST API
- Partners push their customers' files programmatically; jobs land in your normal queue, badged **API**
- Every partner job is **paid from that partner's credit balance** at their own master/slave prices — they buy credits from you, you never chase invoices
- Per-partner API keys, issued and revoked in the admin panel, stored only as hashes
- Built-in rate limiting, per-key usage stats and a full request log
- Safe retries: a repeated order reference never charges or duplicates a job
- Partners poll for status, download finished files, chat on the job and request revisions — all via API
- **Signed webhooks** push status changes and finished files to the partner's portal within a second — with automatic retries, health monitoring and one-click pause/resume in the admin panel

### Communication Tools
- **Bulk email tool** — send branded, styled emails (with images) to selected clients straight from the admin panel
- Manage and answer support tickets in one place

---

## 🔒 Security & Technology

- **Bank-grade payment security** — payments handled by Stripe; card data never touches the platform
- **Row-level and column-level database security** — clients can only ever see their own data
- Hardened file storage policies — files are private and access-controlled
- Full audit trail of admin actions
- Modern, fast tech stack: **React + Vite + Tailwind CSS**, **Supabase** (PostgreSQL, Auth, Storage, Realtime), **Vercel serverless**, **Stripe**
- SEO-optimized public pages (per-page meta, FAQ schema, JSON-LD) — ranks on Google out of the box
- Legal pages included: Terms of Service, Privacy Policy, Refund Policy

---

## 💡 Why It Sells Itself

- **Zero manual invoicing** — payments, credits and PDF invoices are fully automatic
- **Faster turnaround** — structured uploads mean no missing info, no email ping-pong
- **Professional image** — branded portal, branded emails, real invoices
- **Scales with you** — add services, change prices and run promotions without touching code
